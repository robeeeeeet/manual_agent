"""QA rating service for feedback management and auto-deletion."""

import hashlib
import logging
import re
from uuid import UUID

from app.services.qa_service import get_qa_markdown, save_qa_markdown
from app.services.supabase_client import get_supabase_client

logger = logging.getLogger(__name__)

DELETION_THRESHOLD = 3  # 低評価3件で削除


def generate_question_hash(question: str) -> str:
    """
    質問テキストからハッシュを生成（正規化後）.

    Args:
        question: 質問テキスト

    Returns:
        32文字のハッシュ文字列
    """
    normalized = question.strip().lower()
    return hashlib.sha256(normalized.encode()).hexdigest()[:32]


async def insert_rating(
    shared_appliance_id: UUID,
    user_id: UUID,
    question: str,
    is_helpful: bool,
) -> dict:
    """
    評価を新規追加し、削除条件をチェック。

    Args:
        shared_appliance_id: 共有家電ID
        user_id: 評価ユーザーID
        question: 質問テキスト
        is_helpful: 有用性評価（True=役立った、False=役立たなかった）

    Returns:
        {"success": bool, "negative_count": int, "deleted": bool}
    """
    supabase = get_supabase_client()
    if not supabase:
        logger.error("Supabase client not available")
        return {"success": False, "negative_count": 0, "deleted": False}

    question_hash = generate_question_hash(question)

    # 1. 評価をDBに追加
    try:
        supabase.table("qa_ratings").insert(
            {
                "shared_appliance_id": str(shared_appliance_id),
                "user_id": str(user_id),
                "question_hash": question_hash,
                "question_text": question.strip(),
                "is_helpful": is_helpful,
            }
        ).execute()
        logger.info(
            f"Rating inserted: appliance={shared_appliance_id}, "
            f"helpful={is_helpful}, hash={question_hash}"
        )
    except Exception as e:
        logger.error(f"Failed to insert rating: {e}")
        return {"success": False, "negative_count": 0, "deleted": False}

    # 2. 低評価の合計をカウント
    negative_count = await count_negative_ratings(shared_appliance_id, question_hash)

    # 3. 閾値以上なら削除処理
    deleted = False
    if negative_count >= DELETION_THRESHOLD:
        logger.warning(
            f"Negative ratings reached threshold ({negative_count}): "
            f"Deleting QA for hash={question_hash}"
        )
        deleted = await delete_qa_from_markdown(shared_appliance_id, question)

        # 4. 削除成功したら関連評価も削除
        if deleted:
            await delete_ratings_for_question(shared_appliance_id, question_hash)

    return {"success": True, "negative_count": negative_count, "deleted": deleted}


async def count_negative_ratings(
    shared_appliance_id: UUID,
    question_hash: str,
) -> int:
    """
    指定QAの低評価合計をカウント.

    Args:
        shared_appliance_id: 共有家電ID
        question_hash: 質問ハッシュ

    Returns:
        低評価（is_helpful=False）の件数
    """
    supabase = get_supabase_client()
    if not supabase:
        return 0

    try:
        response = (
            supabase.table("qa_ratings")
            .select("id", count="exact")
            .eq("shared_appliance_id", str(shared_appliance_id))
            .eq("question_hash", question_hash)
            .eq("is_helpful", False)
            .execute()
        )
        return response.count or 0
    except Exception as e:
        logger.error(f"Failed to count negative ratings: {e}")
        return 0


async def delete_qa_from_markdown(
    shared_appliance_id: UUID,
    question: str,
) -> bool:
    """
    qa.mdからユーザー追加QAを削除。

    Args:
        shared_appliance_id: 共有家電ID
        question: 削除対象の質問テキスト

    Returns:
        削除成功した場合True、失敗した場合False
    """
    supabase = get_supabase_client()
    if not supabase:
        logger.error("Supabase client not available")
        return False

    # 1. shared_appliancesからmaker, model_numberを取得
    try:
        response = (
            supabase.table("shared_appliances")
            .select("maker, model_number")
            .eq("id", str(shared_appliance_id))
            .single()
            .execute()
        )
        if not response.data:
            logger.error(f"Shared appliance not found: {shared_appliance_id}")
            return False

        maker = response.data["maker"]
        model_number = response.data["model_number"]
    except Exception as e:
        logger.error(f"Failed to get shared appliance: {e}")
        return False

    # 2. get_qa_markdown() でマークダウン取得
    try:
        content = await get_qa_markdown(maker, model_number)
        if not content:
            logger.warning(f"QA markdown not found: {maker} {model_number}")
            return False
    except Exception as e:
        logger.error(f"Failed to get QA markdown: {e}")
        return False

    # 3. remove_qa_entry() で該当QAを削除
    updated_content = remove_qa_entry(content, question)

    # 削除が実行されたかチェック（内容が変わっているか）
    if updated_content == content:
        logger.warning(f"QA entry not found in markdown: {question[:50]}...")
        return False

    # 4. save_qa_markdown() で保存
    try:
        await save_qa_markdown(maker, model_number, updated_content)
        logger.info(f"QA entry deleted from markdown: {maker} {model_number}")
        return True
    except Exception as e:
        logger.error(f"Failed to save updated QA markdown: {e}")
        return False


def remove_qa_entry(content: str, question: str) -> str:
    """
    マークダウンから指定の質問に対応するQAエントリを削除。

    対象パターン:
    ### Q: {question} (追加: YYYY-MM-DD)
    **A**: ...
    **ソース**: ...

    Args:
        content: マークダウン全文
        question: 削除対象の質問テキスト

    Returns:
        削除後のマークダウン
    """
    escaped_question = re.escape(question.strip())

    # パターン: ### Q: ... (追加: YYYY-MM-DD)\n**A**: ...\n**ソース**: ...\n
    # 非貪欲マッチで次の ### または文末までを対象
    pattern = (
        rf"### Q: {escaped_question} \(追加: \d{{4}}-\d{{2}}-\d{{2}}\)\n"
        r"\*\*A\*\*: .+?\n"
        r"\*\*ソース\*\*: .+?\n"
    )

    updated = re.sub(pattern, "", content, flags=re.DOTALL)

    # 連続改行を整理（3つ以上の改行を2つに）
    updated = re.sub(r"\n{3,}", "\n\n", updated)

    return updated


async def delete_invalid_qa_from_storage(
    manufacturer: str,
    model_number: str,
    question: str,
) -> bool:
    """
    Storageから不整合QAエントリを削除.

    セルフチェックで整合性NGと判断されたQAを削除する。

    Args:
        manufacturer: メーカー名
        model_number: 型番
        question: 削除対象の質問テキスト

    Returns:
        削除成功した場合True、失敗した場合False
    """
    # 1. get_qa_markdown() でマークダウン取得
    try:
        content = await get_qa_markdown(manufacturer, model_number)
        if not content:
            logger.warning(f"QA markdown not found: {manufacturer} {model_number}")
            return False
    except Exception as e:
        logger.error(f"Failed to get QA markdown: {e}")
        return False

    # 2. remove_qa_entry() で該当QAを削除
    updated_content = remove_qa_entry(content, question)

    # 削除が実行されたかチェック（内容が変わっているか）
    if updated_content == content:
        logger.warning(f"QA entry not found in markdown: {question[:50]}...")
        return False

    # 3. save_qa_markdown() で保存
    try:
        await save_qa_markdown(manufacturer, model_number, updated_content)
        logger.info(
            f"Invalid QA entry deleted from markdown: {manufacturer} {model_number}"
        )
        return True
    except Exception as e:
        logger.error(f"Failed to save updated QA markdown: {e}")
        return False


async def delete_ratings_for_question(
    shared_appliance_id: UUID,
    question_hash: str,
) -> None:
    """
    QA削除後、関連する評価レコードも削除.

    Args:
        shared_appliance_id: 共有家電ID
        question_hash: 質問ハッシュ
    """
    supabase = get_supabase_client()
    if not supabase:
        return

    try:
        supabase.table("qa_ratings").delete().eq(
            "shared_appliance_id", str(shared_appliance_id)
        ).eq("question_hash", question_hash).execute()
        logger.info(
            f"Ratings deleted for appliance={shared_appliance_id}, hash={question_hash}"
        )
    except Exception as e:
        logger.error(f"Failed to delete ratings: {e}")
