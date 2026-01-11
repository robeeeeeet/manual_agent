"""Question answering service with multi-source search."""

import json
import logging
import re
from collections.abc import AsyncGenerator

from google import genai
from google.genai import types

from app.config import settings
from app.schemas.qa import QAStreamEvent
from app.services.qa_service import append_qa_to_markdown, get_qa_markdown
from app.services.text_cache_service import get_or_create_text_cache

logger = logging.getLogger(__name__)

# Step definitions for progress display
STEP_DEFINITIONS = {
    1: "QAデータベースを検索中...",
    2: "説明書テキストを検索中...",
    3: "PDFを詳細分析中...",
}


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
以下のFAQから、ユーザーの質問に最も関連する回答を見つけてください。

【ユーザーの質問】
{question}

【FAQ内容】
{qa_content}

【指示】
- 質問に対する回答がFAQにある場合は、その回答と参照ページを返してください
- 回答がない場合は「NOT_FOUND」とだけ返してください
- 回答がある場合は以下のJSON形式で返してください（answerフィールド内ではマークダウン記法を使用しない）:
{{"answer": "回答内容", "reference": "P.XX"}}
"""

    response = await client.aio.models.generate_content(
        model="gemini-2.0-flash",
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

【指示】
- 説明書の内容に基づいて回答してください
- 説明書に記載がない場合は「NOT_FOUND」とだけ返してください
- 回答がある場合は以下のJSON形式で返してください（answerフィールド内ではマークダウン記法を使用しない）:
{{"answer": "回答内容", "reference": "P.XX（該当ページがあれば）"}}
"""

    response = await client.aio.models.generate_content(
        model="gemini-2.0-flash",
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
この製品の説明書PDFを読んで、以下の質問に回答してください。

【質問】
{question}

【指示】
- 説明書の内容に基づいて正確に回答してください
- 該当するページ番号を含めてください
- 以下のJSON形式で回答してください（answerフィールド内ではマークダウン記法を使用しない）:
{{"answer": "回答内容", "reference": "P.XX"}}
"""

    response = await client.aio.models.generate_content(
        model="gemini-2.0-flash",
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
    Answer question with streaming progress updates.

    Yields SSE events for each step of the search process.

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
