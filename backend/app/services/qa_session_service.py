"""QAセッション管理サービス

QA機能の会話履歴を管理するサービス。
- セッションの作成・取得・更新
- メッセージの保存・取得
- 履歴のプロンプト形式変換
- LLMによるセッション要約生成
"""

import asyncio
import logging
from datetime import UTC, datetime, timedelta

from google import genai

from app.config import settings
from app.schemas.qa import ChatHistoryMessage, QASessionDetail, QASessionSummary
from app.services.supabase_client import get_supabase_client

logger = logging.getLogger(__name__)

SESSION_TIMEOUT_HOURS = 6


async def generate_summary(question: str) -> str | None:
    """
    最初の質問をLLMで要約してセッションタイトルを生成.

    Args:
        question: ユーザーの最初の質問

    Returns:
        要約されたタイトル（最大30文字程度）、失敗時はNone
    """
    if not settings.gemini_api_key:
        logger.warning("Gemini API key not configured")
        return None

    try:
        client = genai.Client(api_key=settings.gemini_api_key)

        prompt = f"""以下の質問を15文字以内の短いタイトルに要約してください。
質問の核心を捉えた簡潔な表現にしてください。

【質問】
{question}

【指示】
- 15文字以内で回答
- 「〜について」「〜の質問」などは省略
- 具体的なキーワードを残す
- タイトルのみを出力（説明不要）"""

        response = await client.aio.models.generate_content(
            model="gemini-2.0-flash",
            contents=prompt,
        )

        summary = response.text.strip()
        # 長すぎる場合は切り詰め
        if len(summary) > 30:
            summary = summary[:27] + "..."
        return summary
    except Exception as e:
        logger.warning(f"Failed to generate summary: {e}")
        return None


async def update_session_summary(session_id: str, summary: str) -> None:
    """セッションのsummaryを更新."""
    client = get_supabase_client()
    if not client:
        return

    try:
        client.table("qa_sessions").update({"summary": summary}).eq(
            "id", session_id
        ).execute()
    except Exception as e:
        logger.error(f"Failed to update session summary: {e}")


async def _generate_and_save_summary(session_id: str, question: str) -> None:
    """バックグラウンドで要約を生成して保存."""
    try:
        summary = await generate_summary(question)
        if summary:
            await update_session_summary(session_id, summary)
    except Exception as e:
        logger.error(f"Error in _generate_and_save_summary: {e}")


async def get_sessions_for_appliance(
    user_id: str, shared_appliance_id: str, group_id: str | None = None
) -> list[QASessionSummary]:
    """家電のセッション一覧を取得（新しい順）

    グループ家電の場合、以下の両方を取得:
    1. group_idが設定されたセッション（離脱者含む）
    2. 現在のグループメンバーのセッション（後方互換性）
    """
    client = get_supabase_client()
    if not client:
        logger.error("Supabase client not available")
        return []

    # セッション一覧を取得
    try:
        if group_id:
            # グループ家電 - 2つの方法で取得
            # 1. group_idが設定されたセッション（新方式、離脱者含む）
            sessions_by_group = (
                client.table("qa_sessions")
                .select("*")
                .eq("group_id", group_id)
                .eq("shared_appliance_id", shared_appliance_id)
                .execute()
            )

            # 2. 現在のグループメンバーのセッション（後方互換性）
            members_result = (
                client.table("group_members")
                .select("user_id")
                .eq("group_id", group_id)
                .execute()
            )
            member_ids = [m["user_id"] for m in (members_result.data or [])]

            sessions_by_members = {"data": []}
            if member_ids:
                sessions_by_members = (
                    client.table("qa_sessions")
                    .select("*")
                    .in_("user_id", member_ids)
                    .eq("shared_appliance_id", shared_appliance_id)
                    .is_("group_id", "null")  # group_idが未設定のもの（旧方式）
                    .execute()
                )

            # マージして重複排除（IDで）
            all_sessions_map = {}
            for row in sessions_by_group.data or []:
                all_sessions_map[row["id"]] = row
            for row in sessions_by_members.data or []:
                if row["id"] not in all_sessions_map:
                    all_sessions_map[row["id"]] = row

            # last_activity_atで降順ソート
            all_sessions = sorted(
                all_sessions_map.values(),
                key=lambda x: x.get("last_activity_at", ""),
                reverse=True,
            )
            result_data = all_sessions
        else:
            # 個人家電 - 自分のセッションのみ
            result = (
                client.table("qa_sessions")
                .select("*")
                .eq("user_id", user_id)
                .eq("shared_appliance_id", shared_appliance_id)
                .order("last_activity_at", desc=True)
                .execute()
            )
            result_data = result.data or []
    except Exception as e:
        logger.error(f"Failed to get sessions: {e}")
        return []

    sessions = []
    for row in result_data:
        # 各セッションのメッセージ数と最初のユーザー質問を取得
        try:
            messages_result = (
                client.table("qa_session_messages")
                .select("id, role, content")
                .eq("session_id", row["id"])
                .order("created_at")
                .execute()
            )

            messages = messages_result.data or []
            message_count = len(messages)
            first_message = None
            for msg in messages:
                if msg["role"] == "user":
                    first_message = msg["content"][:50] + (
                        "..." if len(msg["content"]) > 50 else ""
                    )
                    break

            sessions.append(
                QASessionSummary(
                    id=row["id"],
                    shared_appliance_id=row["shared_appliance_id"],
                    is_active=row["is_active"],
                    message_count=message_count,
                    summary=row.get("summary"),
                    first_message=first_message,
                    created_at=row["created_at"],
                    last_activity_at=row["last_activity_at"],
                )
            )
        except Exception as e:
            logger.error(f"Failed to process session {row['id']}: {e}")
            continue

    return sessions


async def get_session_detail(session_id: str, user_id: str) -> QASessionDetail | None:
    """セッション詳細を取得（メッセージ含む）"""
    client = get_supabase_client()
    if not client:
        logger.error("Supabase client not available")
        return None

    try:
        result = (
            client.table("qa_sessions")
            .select("*")
            .eq("id", session_id)
            .eq("user_id", user_id)
            .single()
            .execute()
        )
    except Exception as e:
        logger.error(f"Failed to get session detail: {e}")
        return None

    if not result.data:
        return None

    row = result.data
    messages = await get_session_messages(session_id)

    return QASessionDetail(
        id=row["id"],
        user_id=row["user_id"],
        shared_appliance_id=row["shared_appliance_id"],
        is_active=row["is_active"],
        messages=messages,
        created_at=row["created_at"],
        last_activity_at=row["last_activity_at"],
    )


async def get_or_create_active_session(
    user_id: str, shared_appliance_id: str
) -> QASessionDetail:
    """アクティブセッションを取得、なければ作成"""
    client = get_supabase_client()
    if not client:
        logger.error("Supabase client not available")
        raise RuntimeError("Supabase client not available")

    # 6時間以内のアクティブセッションを検索
    timeout_threshold = datetime.now(UTC) - timedelta(hours=SESSION_TIMEOUT_HOURS)

    try:
        result = (
            client.table("qa_sessions")
            .select("*")
            .eq("user_id", user_id)
            .eq("shared_appliance_id", shared_appliance_id)
            .eq("is_active", True)
            .gte("last_activity_at", timeout_threshold.isoformat())
            .single()
            .execute()
        )

        if result.data:
            # 既存のアクティブセッションを返す
            return await get_session_detail(result.data["id"], user_id)
    except Exception as e:
        # single()でレコードが見つからない場合は例外が発生するが、想定内
        logger.debug(f"No active session found: {e}")

    # タイムアウトしたアクティブセッションがあれば非アクティブ化
    await _deactivate_user_active_sessions(user_id, shared_appliance_id)

    # 新規セッションを作成
    return await create_new_session(user_id, shared_appliance_id)


async def _deactivate_user_active_sessions(
    user_id: str, shared_appliance_id: str
) -> None:
    """ユーザーの該当家電のアクティブセッションを非アクティブ化"""
    client = get_supabase_client()
    if not client:
        return

    try:
        client.table("qa_sessions").update({"is_active": False}).eq(
            "user_id", user_id
        ).eq("shared_appliance_id", shared_appliance_id).eq("is_active", True).execute()
    except Exception as e:
        logger.error(f"Failed to deactivate sessions: {e}")


async def _get_group_id_for_shared_appliance(
    user_id: str, shared_appliance_id: str
) -> str | None:
    """ユーザーがアクセスしている家電のgroup_idを取得.

    user_appliancesテーブルを検索して、ユーザーがグループ経由で
    この家電にアクセスしている場合はそのgroup_idを返す。
    """
    client = get_supabase_client()
    if not client:
        return None

    try:
        # まずグループ家電を検索（group_idが設定されているもの）
        # ユーザーがグループメンバーである場合、group_membersを通じて確認
        group_members = (
            client.table("group_members")
            .select("group_id")
            .eq("user_id", user_id)
            .execute()
        )

        if not group_members.data:
            return None

        group_id = group_members.data[0]["group_id"]

        # このグループにこのshared_appliance_idの家電があるか確認
        group_appliance = (
            client.table("user_appliances")
            .select("id")
            .eq("shared_appliance_id", shared_appliance_id)
            .eq("group_id", group_id)
            .execute()
        )

        if group_appliance.data:
            return group_id

        return None
    except Exception as e:
        logger.error(f"Failed to get group_id for appliance: {e}")
        return None


async def create_new_session(user_id: str, shared_appliance_id: str) -> QASessionDetail:
    """新規セッションを作成（既存のアクティブセッションは非アクティブ化）

    グループ家電の場合、group_idを自動設定することで、
    グループ離脱後もセッション履歴がグループ内で保持される。
    """
    client = get_supabase_client()
    if not client:
        logger.error("Supabase client not available")
        raise RuntimeError("Supabase client not available")

    # 既存のアクティブセッションを非アクティブ化
    await _deactivate_user_active_sessions(user_id, shared_appliance_id)

    # グループ家電かどうか確認してgroup_idを取得
    group_id = await _get_group_id_for_shared_appliance(user_id, shared_appliance_id)

    # 新規セッション作成
    insert_data = {
        "user_id": user_id,
        "shared_appliance_id": shared_appliance_id,
        "is_active": True,
    }
    if group_id:
        insert_data["group_id"] = group_id

    try:
        result = client.table("qa_sessions").insert(insert_data).execute()
    except Exception as e:
        logger.error(f"Failed to create session: {e}")
        raise RuntimeError(f"Failed to create session: {e}") from e

    row = result.data[0]
    return QASessionDetail(
        id=row["id"],
        user_id=row["user_id"],
        shared_appliance_id=row["shared_appliance_id"],
        is_active=row["is_active"],
        messages=[],
        created_at=row["created_at"],
        last_activity_at=row["last_activity_at"],
    )


async def add_message(
    session_id: str,
    role: str,
    content: str,
    source: str | None = None,
    reference: str | None = None,
) -> None:
    """セッションにメッセージを追加し、last_activity_atを更新.

    最初のユーザーメッセージの場合はLLMで要約を生成してセッションタイトルとする。
    """
    client = get_supabase_client()
    if not client:
        logger.error("Supabase client not available")
        return

    # 最初のユーザーメッセージかチェック（要約生成用）
    is_first_user_message = False
    if role == "user":
        try:
            existing = (
                client.table("qa_session_messages")
                .select("id", count="exact")
                .eq("session_id", session_id)
                .eq("role", "user")
                .execute()
            )
            is_first_user_message = (existing.count or 0) == 0
        except Exception as e:
            logger.warning(f"Failed to check existing messages: {e}")

    try:
        # メッセージ追加
        message_data: dict = {
            "session_id": session_id,
            "role": role,
            "content": content,
        }
        if source:
            message_data["source"] = source
        if reference:
            message_data["reference"] = reference

        client.table("qa_session_messages").insert(message_data).execute()

        # last_activity_at更新
        client.table("qa_sessions").update(
            {"last_activity_at": datetime.now(UTC).isoformat()}
        ).eq("id", session_id).execute()

        # 最初のユーザーメッセージなら要約を生成（バックグラウンド）
        if is_first_user_message:
            asyncio.create_task(_generate_and_save_summary(session_id, content))
    except Exception as e:
        logger.error(f"Failed to add message: {e}")


async def get_session_messages(
    session_id: str, limit: int = 20
) -> list[ChatHistoryMessage]:
    """セッションのメッセージを取得（古い順）"""
    client = get_supabase_client()
    if not client:
        logger.error("Supabase client not available")
        return []

    try:
        result = (
            client.table("qa_session_messages")
            .select("*")
            .eq("session_id", session_id)
            .order("created_at")
            .limit(limit)
            .execute()
        )

        return [
            ChatHistoryMessage(
                id=row["id"],
                role=row["role"],
                content=row["content"],
                source=row.get("source"),
                reference=row.get("reference"),
                created_at=row["created_at"],
            )
            for row in (result.data or [])
        ]
    except Exception as e:
        logger.error(f"Failed to get session messages: {e}")
        return []


def format_history_for_prompt(messages: list[ChatHistoryMessage]) -> str:
    """会話履歴をプロンプト用にフォーマット"""
    if not messages:
        return ""

    lines = ["【会話履歴】"]
    for msg in messages:
        role_label = "ユーザー" if msg.role == "user" else "アシスタント"
        lines.append(f"{role_label}: {msg.content}")
    return "\n".join(lines)


async def reset_active_session(user_id: str, shared_appliance_id: str) -> str | None:
    """アクティブセッションを非アクティブ化し、新セッションを作成して返す"""
    try:
        new_session = await create_new_session(user_id, shared_appliance_id)
        return new_session.id
    except Exception as e:
        logger.error(f"Failed to reset session: {e}")
        return None


async def deactivate_expired_sessions() -> int:
    """6時間以上アクティビティがないセッションを非アクティブ化"""
    client = get_supabase_client()
    if not client:
        logger.error("Supabase client not available")
        return 0

    timeout_threshold = datetime.now(UTC) - timedelta(hours=SESSION_TIMEOUT_HOURS)

    try:
        result = (
            client.table("qa_sessions")
            .update({"is_active": False})
            .eq("is_active", True)
            .lt("last_activity_at", timeout_threshold.isoformat())
            .execute()
        )

        count = len(result.data) if result.data else 0
        logger.info(f"Deactivated {count} expired QA sessions")
        return count
    except Exception as e:
        logger.error(f"Failed to deactivate expired sessions: {e}")
        return 0


async def resume_session(session_id: str, user_id: str) -> QASessionDetail | None:
    """過去のセッションを再開（アクティブ化）"""
    client = get_supabase_client()
    if not client:
        logger.error("Supabase client not available")
        return None

    # 指定セッションを取得
    try:
        result = (
            client.table("qa_sessions")
            .select("*")
            .eq("id", session_id)
            .eq("user_id", user_id)
            .single()
            .execute()
        )
    except Exception as e:
        logger.error(f"Failed to get session for resume: {e}")
        return None

    if not result.data:
        return None

    shared_appliance_id = result.data["shared_appliance_id"]

    # 他のアクティブセッションを非アクティブ化
    await _deactivate_user_active_sessions(user_id, shared_appliance_id)

    # 指定セッションをアクティブ化
    try:
        client.table("qa_sessions").update(
            {
                "is_active": True,
                "last_activity_at": datetime.now(UTC).isoformat(),
            }
        ).eq("id", session_id).execute()
    except Exception as e:
        logger.error(f"Failed to resume session: {e}")
        return None

    return await get_session_detail(session_id, user_id)
