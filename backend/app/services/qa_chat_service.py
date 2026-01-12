"""Question answering service with multi-source search."""

import json
import logging
import re
from collections.abc import AsyncGenerator

from google import genai
from google.genai import types

from app.config import settings
from app.schemas.qa import QAStreamEvent, SelfCheckResult
from app.services.qa_rating_service import delete_invalid_qa_from_storage
from app.services.qa_service import append_qa_to_markdown, get_qa_markdown
from app.services.text_cache_service import get_or_create_text_cache

logger = logging.getLogger(__name__)

# Step definitions for progress display
STEP_DEFINITIONS = {
    1: "QAデータベースを検索中...",
    1.5: "回答を検証中...",
    2: "説明書テキストを検索中...",
    2.5: "回答を検証中...",
    3: "PDFを詳細分析中...",
    3.5: "回答を検証中...",
}

# Self-check prompt template
SELF_CHECK_PROMPT = """
以下の質問と回答の整合性を評価してください：

【質問】
{question}

【回答】
{answer}

【評価手順】

1. 質問タイプの判定:
   質問が以下のどのタイプか判定してください：
   - 方法: 「〜の方法」「やり方」「どうやって」「手順」「〜するには」
   - 頻度: 「いつ」「どのくらい」「頻度」「何回」「タイミング」
   - 理由: 「なぜ」「どうして」「原因」「理由」
   - トラブル: 「〜できない」「〜しない」「故障」「エラー」「動かない」
   - 仕様: 「何」「スペック」「対応」「サイズ」「重さ」

2. 回答タイプの判定:
   回答が主に何を説明しているか判定してください：
   - 手順: 具体的なステップ・操作方法の説明
   - 頻度: 時間・回数・周期・タイミングの説明
   - 理由: 原因・背景・メカニズムの説明
   - 解決方法: トラブルへの対処法の説明
   - 仕様: 製品情報・スペックの説明

3. 質問タイプと回答タイプの整合性を確認

【スコア判定の具体例】

◯ 高スコア (4-5) の例:
- 質問「お手入れの方法を教えてください」
  回答「1. 電源を切ります 2. フィルターを取り外します 3. 水で洗い、よく乾かします 4. 元に戻します」
  → 方法を聞かれて手順を回答している → score: 5

- 質問「どのくらいの頻度で掃除が必要ですか」
  回答「週に1回の掃除をおすすめします。使用頻度が高い場合は2〜3日に1回が理想的です」
  → 頻度を聞かれて頻度を回答している → score: 5

- 質問「電源が入らない原因は何ですか」
  回答「主な原因として、バッテリー切れ、電源コードの断線、内部の安全装置の作動が考えられます」
  → 原因を聞かれて原因を回答している → score: 5

✕ 低スコア (1-2) の例:
- 質問「お手入れの方法を教えてください」
  回答「使うたびにお手入れが必要です。お手入れが不充分だと、ごはんの食味低下やにおいの原因になります」
  → 方法を聞かれているのに頻度と理由を答えている → score: 2

- 質問「いつ掃除すればいいですか」
  回答「フィルターを外して水洗いします」
  → 頻度を聞かれているのに手順を答えている → score: 2

- 質問「なぜ電源が入らないのですか」
  回答「電源ボタンを3秒長押ししてください」
  → 原因を聞かれているのに操作方法を答えている → score: 2

【出力形式】
{{
  "question_type": "方法/頻度/理由/トラブル/仕様/その他",
  "answer_type": "手順/頻度/理由/解決方法/仕様/その他",
  "type_match": true/false（質問タイプと回答タイプが適切に対応しているか）,
  "score": 1-5の整数（1=全く整合性なし、5=完全に整合）,
  "is_acceptable": true/false（scoreが{threshold}以上ならtrue）,
  "reason": "評価理由（日本語で簡潔に）"
}}
"""


async def check_answer_consistency(
    question: str,
    answer: str,
    threshold: int = 3,
) -> SelfCheckResult:
    """
    質問と回答の整合性をチェックする.

    Args:
        question: ユーザーの質問
        answer: 生成された回答
        threshold: 許容スコア閾値 (デフォルト: 3)

    Returns:
        SelfCheckResult: セルフチェック結果
    """
    client = genai.Client(api_key=settings.gemini_api_key)

    prompt = SELF_CHECK_PROMPT.format(
        question=question,
        answer=answer,
        threshold=threshold,
    )

    try:
        response = await client.aio.models.generate_content(
            model="gemini-2.5-flash",
            contents=prompt,
        )

        text = response.text.strip()

        # JSONパース
        json_match = re.search(r"\{.+\}", text, re.DOTALL)
        if json_match:
            data = json.loads(json_match.group())
            score = data.get("score", 3)
            return SelfCheckResult(
                score=score,
                is_acceptable=data.get("is_acceptable", score >= threshold),
                reason=data.get("reason", ""),
                question_type=data.get("question_type"),
                answer_type=data.get("answer_type"),
                type_match=data.get("type_match"),
            )
    except Exception as e:
        logger.warning(f"Failed to parse self-check response: {e}")

    # フォールバック: パース失敗時は許容とみなす
    return SelfCheckResult(
        score=3,
        is_acceptable=True,
        reason="セルフチェックの解析に失敗しました",
        question_type=None,
        answer_type=None,
        type_match=None,
    )


async def search_qa_markdown(qa_content: str, question: str) -> dict | None:
    """
    Search answer in QA markdown using LLM semantic search.

    Args:
        qa_content: QA markdown content
        question: User question

    Returns:
        Dict with "answer" and "reference" keys, or None if not found
    """
    client = genai.Client(api_key=settings.gemini_api_key)

    prompt = f"""
以下のFAQから、ユーザーの質問に対する回答を見つけてください。

【ユーザーの質問】
{question}

【FAQ内容】
{qa_content}

【質問タイプの判別】
まず、ユーザーの質問が以下のどのタイプか判断してください：
- 方法/手順型: 「〜の方法」「〜のやり方」「どうやって」「手順」「〜するには」
  → 具体的なステップ・操作手順を回答すること
- 頻度/タイミング型: 「いつ」「どのくらいの頻度」「何回」「タイミング」
  → 時間・回数・周期を回答すること
- 理由/原因型: 「なぜ」「どうして」「原因」「理由」
  → 理由・背景・メカニズムを回答すること
- トラブルシューティング型: 「〜できない」「〜しない」「故障」「エラー」
  → 解決方法・対処手順を回答すること
- 仕様/スペック型: 「何が」「どれくらい」「対応している」「サイズ」
  → 製品情報・仕様を回答すること

【回答の適合性チェック】
◯ 良い回答例:
- 質問「お手入れの方法を教えてください」
  → 「1. 電源を切る 2. フィルターを外す 3. 水洗いする 4. 乾かして戻す」
  （方法を聞かれて → 具体的な手順を回答 ✓）

- 質問「いつ掃除すればいいですか」
  → 「週に1回程度、または汚れが目立ってきたら掃除してください」
  （頻度を聞かれて → 頻度・タイミングを回答 ✓）

✕ 悪い回答例:
- 質問「お手入れの方法を教えてください」
  → 「使うたびにお手入れが必要です」
  （方法を聞かれて → 頻度だけを回答 ✗）

- 質問「いつ掃除すればいいですか」
  → 「フィルターを外して水洗いします」
  （頻度を聞かれて → 手順を回答 ✗）

【回答の構造】
質問タイプに応じて以下の構造で回答してください：
- 方法/手順型: 1. まず結論 2. 具体的な手順（ステップ1, 2, 3...） 3. 注意点
- 頻度/タイミング型: 1. 推奨頻度・タイミング 2. その理由（あれば）
- トラブル型: 1. 考えられる原因 2. 対処方法 3. 解決しない場合の対応

【重要な注意】
- 質問タイプと回答内容が一致していることを必ず確認してください
- 質問と関係のない情報は回答に含めないでください
- 部分的にしか回答できない場合は「NOT_FOUND」としてください
- 質問の意図から外れた回答は避けてください

【出力形式】
- 回答がある場合: {{"answer": "質問に対する具体的な回答（マークダウン記法は使用しない）", "reference": "P.XX"}}
- 回答がない場合: NOT_FOUND
"""

    response = await client.aio.models.generate_content(
        model="gemini-2.5-flash",
        contents=prompt,
    )

    text = response.text.strip()
    if "NOT_FOUND" in text:
        return None

    # Extract JSON part
    try:
        json_match = re.search(r"\{.+\}", text, re.DOTALL)
        if json_match:
            return json.loads(json_match.group())
    except Exception as e:
        logger.warning(f"Failed to parse QA search response: {e}")

    return None


async def ask_text_cache(text_cache: str, question: str) -> dict | None:
    """
    Generate answer from text cache using LLM.

    Args:
        text_cache: Cached text content
        question: User question

    Returns:
        Dict with "answer" and "reference" keys, or None if not found
    """
    client = genai.Client(api_key=settings.gemini_api_key)

    # Truncate to avoid token limit
    truncated_cache = text_cache[:50000]

    prompt = f"""
以下の説明書テキストを参考に、ユーザーの質問に回答してください。

【ユーザーの質問】
{question}

【説明書内容】
{truncated_cache}

【質問タイプの判別】
まず、ユーザーの質問が以下のどのタイプか判断してください：
- 方法/手順型: 「〜の方法」「〜のやり方」「どうやって」「手順」「〜するには」
  → 具体的なステップ・操作手順を回答すること
- 頻度/タイミング型: 「いつ」「どのくらいの頻度」「何回」「タイミング」
  → 時間・回数・周期を回答すること
- 理由/原因型: 「なぜ」「どうして」「原因」「理由」
  → 理由・背景・メカニズムを回答すること
- トラブルシューティング型: 「〜できない」「〜しない」「故障」「エラー」
  → 解決方法・対処手順を回答すること
- 仕様/スペック型: 「何が」「どれくらい」「対応している」「サイズ」
  → 製品情報・仕様を回答すること

【回答の適合性チェック】
◯ 良い回答例:
- 質問「お手入れの方法を教えてください」
  → 「1. 電源を切る 2. フィルターを外す 3. 水洗いする 4. 乾かして戻す」
  （方法を聞かれて → 具体的な手順を回答 ✓）

- 質問「いつ掃除すればいいですか」
  → 「週に1回程度、または汚れが目立ってきたら掃除してください」
  （頻度を聞かれて → 頻度・タイミングを回答 ✓）

- 質問「なぜ電源が入らないのですか」
  → 「バッテリー切れ、電源コードの接続不良、または安全装置が作動している可能性があります」
  （原因を聞かれて → 考えられる原因を回答 ✓）

✕ 悪い回答例:
- 質問「お手入れの方法を教えてください」
  → 「使うたびにお手入れが必要です」
  （方法を聞かれて → 頻度だけを回答 ✗）

- 質問「いつ掃除すればいいですか」
  → 「フィルターを外して水洗いします」
  （頻度を聞かれて → 手順を回答 ✗）

- 質問「なぜ電源が入らないのですか」
  → 「電源ボタンを3秒長押ししてください」
  （原因を聞かれて → 操作方法を回答 ✗）

【回答の構造】
質問タイプに応じて以下の構造で回答してください：
- 方法/手順型: 1. まず結論 2. 具体的な手順（ステップ1, 2, 3...） 3. 注意点
- 頻度/タイミング型: 1. 推奨頻度・タイミング 2. その理由（あれば）
- 理由/原因型: 1. 考えられる原因（複数ある場合は列挙） 2. 補足説明
- トラブル型: 1. 考えられる原因 2. 対処方法 3. 解決しない場合の対応

【情報源について】
- メインは説明書の内容です
- 説明書に記載がない場合は、あなたの一般知識で補完してください
- 一般知識を使用した場合は、必ず "used_general_knowledge": true を設定してください

【重要な注意】
- 質問タイプと回答内容が一致していることを必ず確認してください
- 質問に直接関係する情報のみを回答してください
- 関係のない操作方法や機能の説明は含めないでください
- 完全に回答できない場合のみ「NOT_FOUND」と返してください

【出力形式】
{{
  "answer": "質問に対する具体的な回答（マークダウン記法は使用しない）",
  "reference": "P.XX（説明書から参照した場合）",
  "used_general_knowledge": true/false
}}
"""

    response = await client.aio.models.generate_content(
        model="gemini-2.5-flash",
        contents=prompt,
    )

    text = response.text.strip()
    if "NOT_FOUND" in text:
        return None

    try:
        json_match = re.search(r"\{.+\}", text, re.DOTALL)
        if json_match:
            return json.loads(json_match.group())
    except Exception as e:
        logger.warning(f"Failed to parse text cache response: {e}")

    return None


async def ask_pdf_directly(pdf_bytes: bytes, question: str) -> dict:
    """
    Generate answer by directly referencing PDF using Gemini API.

    Args:
        pdf_bytes: PDF file bytes
        question: User question

    Returns:
        Dict with "answer" and "reference" keys
    """
    client = genai.Client(api_key=settings.gemini_api_key)

    prompt = f"""
この製品の説明書PDFを読んで、ユーザーの質問に回答してください。

【質問】
{question}

【質問タイプの判別】
まず、ユーザーの質問が以下のどのタイプか判断してください：
- 方法/手順型: 「〜の方法」「〜のやり方」「どうやって」「手順」「〜するには」
  → 具体的なステップ・操作手順を回答すること
- 頻度/タイミング型: 「いつ」「どのくらいの頻度」「何回」「タイミング」
  → 時間・回数・周期を回答すること
- 理由/原因型: 「なぜ」「どうして」「原因」「理由」
  → 理由・背景・メカニズムを回答すること
- トラブルシューティング型: 「〜できない」「〜しない」「故障」「エラー」
  → 解決方法・対処手順を回答すること
- 仕様/スペック型: 「何が」「どれくらい」「対応している」「サイズ」
  → 製品情報・仕様を回答すること

【回答の適合性チェック】
◯ 良い回答例:
- 質問「お手入れの方法を教えてください」
  → 「1. 電源を切る 2. フィルターを外す 3. 水洗いする 4. 乾かして戻す」
  （方法を聞かれて → 具体的な手順を回答 ✓）

- 質問「いつ掃除すればいいですか」
  → 「週に1回程度、または汚れが目立ってきたら掃除してください」
  （頻度を聞かれて → 頻度・タイミングを回答 ✓）

- 質問「なぜ電源が入らないのですか」
  → 「バッテリー切れ、電源コードの接続不良、または安全装置が作動している可能性があります」
  （原因を聞かれて → 考えられる原因を回答 ✓）

✕ 悪い回答例:
- 質問「お手入れの方法を教えてください」
  → 「使うたびにお手入れが必要です」
  （方法を聞かれて → 頻度だけを回答 ✗）

- 質問「いつ掃除すればいいですか」
  → 「フィルターを外して水洗いします」
  （頻度を聞かれて → 手順を回答 ✗）

- 質問「なぜ電源が入らないのですか」
  → 「電源ボタンを3秒長押ししてください」
  （原因を聞かれて → 操作方法を回答 ✗）

【回答の構造】
質問タイプに応じて以下の構造で回答してください：
- 方法/手順型: 1. まず結論 2. 具体的な手順（ステップ1, 2, 3...） 3. 注意点
- 頻度/タイミング型: 1. 推奨頻度・タイミング 2. その理由（あれば）
- 理由/原因型: 1. 考えられる原因（複数ある場合は列挙） 2. 補足説明
- トラブル型: 1. 考えられる原因 2. 対処方法 3. 解決しない場合の対応

【情報源について】
- メインは説明書の内容です
- 説明書に記載がない場合は、あなたの一般知識で補完してください
- 一般知識を使用した場合は、必ず "used_general_knowledge": true を設定してください

【重要な注意】
- 質問タイプと回答内容が一致していることを必ず確認してください
- 質問に直接答える内容のみを回答してください
- 関連はあるが質問の答えではない情報は含めないでください
- 推測や一般論ではなく、説明書に記載された内容を優先してください

【出力形式】
{{
  "answer": "質問に対する具体的な回答（マークダウン記法は使用しない）",
  "reference": "P.XX（説明書から参照した場合）",
  "used_general_knowledge": true/false
}}
"""

    response = await client.aio.models.generate_content(
        model="gemini-2.5-flash",
        contents=[
            types.Content(
                role="user",
                parts=[
                    types.Part.from_bytes(data=pdf_bytes, mime_type="application/pdf"),
                    types.Part.from_text(text=prompt),
                ],
            ),
        ],
    )

    text = response.text.strip()

    try:
        json_match = re.search(r"\{.+\}", text, re.DOTALL)
        if json_match:
            return json.loads(json_match.group())
    except Exception as e:
        logger.warning(f"Failed to parse PDF response: {e}")

    # Fallback: return raw text as answer
    return {"answer": text, "reference": None}


async def answer_question(
    question: str,
    manufacturer: str,
    model_number: str,
    pdf_bytes: bytes | None = None,
) -> dict:
    """
    Answer question using multi-source search: QA → text_cache → PDF.

    Args:
        question: User question
        manufacturer: Manufacturer name
        model_number: Model number
        pdf_bytes: PDF file bytes (optional, but needed for text_cache and PDF fallback)

    Returns:
        Dict with keys: answer, source, reference, added_to_qa
    """
    # Step 1: Search in QA markdown
    qa_content = await get_qa_markdown(manufacturer, model_number)
    if qa_content:
        result = await search_qa_markdown(qa_content, question)
        if result:
            logger.info(f"Answer found in QA for {manufacturer} {model_number}")
            return {
                "answer": result["answer"],
                "source": "qa",
                "reference": result.get("reference"),
                "added_to_qa": False,
            }

    # Step 2: Search in text cache
    if pdf_bytes:
        text_cache = await get_or_create_text_cache(
            manufacturer, model_number, pdf_bytes
        )
        result = await ask_text_cache(text_cache, question)
        if result:
            logger.info(f"Answer found in text cache for {manufacturer} {model_number}")
            # Append new QA to markdown
            added = False
            if qa_content:
                try:
                    await append_qa_to_markdown(
                        manufacturer,
                        model_number,
                        question,
                        result["answer"],
                        "text_cache",
                    )
                    added = True
                except Exception as e:
                    logger.error(f"Failed to append QA: {e}")

            return {
                "answer": result["answer"],
                "source": "text_cache",
                "reference": result.get("reference"),
                "added_to_qa": added,
            }

    # Step 3: Ask PDF directly
    if pdf_bytes:
        result = await ask_pdf_directly(pdf_bytes, question)
        logger.info(f"Answer generated from PDF for {manufacturer} {model_number}")

        # Append new QA to markdown
        added = False
        if qa_content:
            try:
                await append_qa_to_markdown(
                    manufacturer, model_number, question, result["answer"], "pdf"
                )
                added = True
            except Exception as e:
                logger.error(f"Failed to append QA: {e}")

        return {
            "answer": result["answer"],
            "source": "pdf",
            "reference": result.get("reference"),
            "added_to_qa": added,
        }

    # No source available
    return {
        "answer": (
            "申し訳ありませんが、この質問に回答するための情報が見つかりませんでした。"
        ),
        "source": "none",
        "reference": None,
        "added_to_qa": False,
    }


async def answer_question_stream(
    question: str,
    manufacturer: str,
    model_number: str,
    pdf_bytes: bytes | None = None,
    history_context: str = "",
    session_id: str | None = None,
) -> AsyncGenerator[QAStreamEvent, None]:
    """
    Answer question with streaming progress updates and self-check.

    Yields SSE events for each step of the search process.
    Performs consistency check after each answer and falls back to next source if needed.

    Args:
        question: User question
        manufacturer: Manufacturer name
        model_number: Model number
        pdf_bytes: PDF file bytes (optional)
        history_context: Formatted chat history context (optional)
        session_id: Session ID for continuity (optional)

    Yields:
        QAStreamEvent for each step and final answer
    """
    # Build full question with history context if provided
    if history_context:
        full_question = f"{history_context}\n\n【現在の質問】\n{question}\n\n【指示】\n会話の文脈を考慮して回答してください。「それ」「これ」などの指示語は、会話履歴から何を指しているか推測してください。"
    else:
        full_question = question

    # Get self-check settings
    self_check_enabled = settings.qa_self_check_enabled
    self_check_threshold = settings.qa_self_check_threshold

    # Step 1: Search in QA markdown
    yield QAStreamEvent(
        event="step_start",
        step=1,
        step_name=STEP_DEFINITIONS[1],
    )

    qa_content = await get_qa_markdown(manufacturer, model_number)
    if qa_content:
        result = await search_qa_markdown(qa_content, full_question)
        if result:
            logger.info(f"Answer found in QA for {manufacturer} {model_number}")

            # Self-check for QA result
            if self_check_enabled:
                yield QAStreamEvent(
                    event="step_start",
                    step=1.5,
                    step_name=STEP_DEFINITIONS[1.5],
                )
                check = await check_answer_consistency(
                    question, result["answer"], self_check_threshold
                )
                yield QAStreamEvent(
                    event="step_complete",
                    step=1.5,
                    step_name="回答検証完了",
                    self_check_score=check.score,
                )

                if check.is_acceptable:
                    yield QAStreamEvent(
                        event="step_complete",
                        step=1,
                        step_name="QAデータベースで回答を発見",
                    )
                    yield QAStreamEvent(
                        event="answer",
                        answer=result["answer"],
                        source="qa",
                        reference=result.get("reference"),
                        added_to_qa=False,
                        session_id=session_id,
                        self_check_score=check.score,
                        used_general_knowledge=False,
                    )
                    return
                else:
                    # NG: Delete invalid QA and fallback to Step 2
                    deleted = await delete_invalid_qa_from_storage(
                        manufacturer, model_number, question
                    )
                    logger.warning(
                        f"Deleted invalid QA entry (score={check.score}): "
                        f"{question[:50]}... deleted={deleted}"
                    )
            else:
                # Self-check disabled: return QA result directly
                yield QAStreamEvent(
                    event="step_complete",
                    step=1,
                    step_name="QAデータベースで回答を発見",
                )
                yield QAStreamEvent(
                    event="answer",
                    answer=result["answer"],
                    source="qa",
                    reference=result.get("reference"),
                    added_to_qa=False,
                    session_id=session_id,
                    used_general_knowledge=False,
                )
                return

    yield QAStreamEvent(
        event="step_complete",
        step=1,
        step_name="QAデータベースに該当なし",
    )

    # Step 2: Search in text cache
    if pdf_bytes:
        yield QAStreamEvent(
            event="step_start",
            step=2,
            step_name=STEP_DEFINITIONS[2],
        )

        text_cache = await get_or_create_text_cache(
            manufacturer, model_number, pdf_bytes
        )
        result = await ask_text_cache(text_cache, full_question)

        if result:
            logger.info(f"Answer found in text cache for {manufacturer} {model_number}")
            used_general_knowledge = result.get("used_general_knowledge", False)

            # Self-check for text cache result
            if self_check_enabled:
                yield QAStreamEvent(
                    event="step_start",
                    step=2.5,
                    step_name=STEP_DEFINITIONS[2.5],
                )
                check = await check_answer_consistency(
                    question, result["answer"], self_check_threshold
                )
                yield QAStreamEvent(
                    event="step_complete",
                    step=2.5,
                    step_name="回答検証完了",
                    self_check_score=check.score,
                )

                if check.is_acceptable:
                    # OK: Append to QA and return
                    added = False
                    if qa_content:
                        try:
                            await append_qa_to_markdown(
                                manufacturer,
                                model_number,
                                question,
                                result["answer"],
                                "text_cache",
                            )
                            added = True
                        except Exception as e:
                            logger.error(f"Failed to append QA: {e}")

                    yield QAStreamEvent(
                        event="step_complete",
                        step=2,
                        step_name="テキストキャッシュで回答を発見",
                    )
                    yield QAStreamEvent(
                        event="answer",
                        answer=result["answer"],
                        source="text_cache",
                        reference=result.get("reference"),
                        added_to_qa=added,
                        session_id=session_id,
                        self_check_score=check.score,
                        used_general_knowledge=used_general_knowledge,
                    )
                    return
                else:
                    # NG: Fallback to Step 3 (no FAQ append)
                    logger.warning(
                        f"Text cache answer failed consistency check "
                        f"(score={check.score}): {check.reason}"
                    )
            else:
                # Self-check disabled: return text cache result directly
                added = False
                if qa_content:
                    try:
                        await append_qa_to_markdown(
                            manufacturer,
                            model_number,
                            question,
                            result["answer"],
                            "text_cache",
                        )
                        added = True
                    except Exception as e:
                        logger.error(f"Failed to append QA: {e}")

                yield QAStreamEvent(
                    event="step_complete",
                    step=2,
                    step_name="テキストキャッシュで回答を発見",
                )
                yield QAStreamEvent(
                    event="answer",
                    answer=result["answer"],
                    source="text_cache",
                    reference=result.get("reference"),
                    added_to_qa=added,
                    session_id=session_id,
                    used_general_knowledge=used_general_knowledge,
                )
                return

        yield QAStreamEvent(
            event="step_complete",
            step=2,
            step_name="テキストキャッシュに該当なし",
        )

    # Step 3: Ask PDF directly
    if pdf_bytes:
        yield QAStreamEvent(
            event="step_start",
            step=3,
            step_name=STEP_DEFINITIONS[3],
        )

        result = await ask_pdf_directly(pdf_bytes, full_question)
        logger.info(f"Answer generated from PDF for {manufacturer} {model_number}")
        used_general_knowledge = result.get("used_general_knowledge", False)

        # Self-check for PDF result
        if self_check_enabled:
            yield QAStreamEvent(
                event="step_start",
                step=3.5,
                step_name=STEP_DEFINITIONS[3.5],
            )
            check = await check_answer_consistency(
                question, result["answer"], self_check_threshold
            )
            yield QAStreamEvent(
                event="step_complete",
                step=3.5,
                step_name="回答検証完了",
                self_check_score=check.score,
            )

            if check.is_acceptable:
                # OK: Append to QA and return
                added = False
                if qa_content:
                    try:
                        await append_qa_to_markdown(
                            manufacturer,
                            model_number,
                            question,
                            result["answer"],
                            "pdf",
                        )
                        added = True
                    except Exception as e:
                        logger.error(f"Failed to append QA: {e}")

                yield QAStreamEvent(
                    event="step_complete",
                    step=3,
                    step_name="PDFから回答を生成",
                )
                yield QAStreamEvent(
                    event="answer",
                    answer=result["answer"],
                    source="pdf",
                    reference=result.get("reference"),
                    added_to_qa=added,
                    session_id=session_id,
                    self_check_score=check.score,
                    used_general_knowledge=used_general_knowledge,
                )
            else:
                # NG: Return with warning (no FAQ append)
                logger.warning(
                    f"PDF answer failed consistency check "
                    f"(score={check.score}): {check.reason}"
                )
                yield QAStreamEvent(
                    event="step_complete",
                    step=3,
                    step_name="PDFから回答を生成",
                )
                yield QAStreamEvent(
                    event="answer",
                    answer=result["answer"],
                    source="pdf",
                    reference=result.get("reference"),
                    added_to_qa=False,
                    session_id=session_id,
                    self_check_score=check.score,
                    needs_verification=True,
                    used_general_knowledge=used_general_knowledge,
                )
        else:
            # Self-check disabled: return PDF result directly
            added = False
            if qa_content:
                try:
                    await append_qa_to_markdown(
                        manufacturer, model_number, question, result["answer"], "pdf"
                    )
                    added = True
                except Exception as e:
                    logger.error(f"Failed to append QA: {e}")

            yield QAStreamEvent(
                event="step_complete",
                step=3,
                step_name="PDFから回答を生成",
            )
            yield QAStreamEvent(
                event="answer",
                answer=result["answer"],
                source="pdf",
                reference=result.get("reference"),
                added_to_qa=added,
                session_id=session_id,
                used_general_knowledge=used_general_knowledge,
            )
        return

    # No source available
    yield QAStreamEvent(
        event="answer",
        answer="申し訳ありませんが、この質問に回答するための情報が見つかりませんでした。",
        source="none",
        reference=None,
        added_to_qa=False,
        session_id=session_id,
    )
