"""QA (Question & Answer) API routes."""

import logging
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Header, HTTPException
from fastapi.responses import JSONResponse, StreamingResponse

from app.schemas.qa import (
    QAAskRequest,
    QAAskResponse,
    QABatchGenerateRequest,
    QABatchGenerateResponse,
    QAFeedbackRequest,
    QAFeedbackResponse,
    QAGenerateRequest,
    QAGenerateResponse,
    QAGetResponse,
    QAResetSessionResponse,
    QASessionDetail,
    QASessionListResponse,
)
from app.schemas.qa_abuse import InvalidQuestionError, QABlockedError
from app.schemas.tier import TierLimitExceededError
from app.services.pdf_storage import MANUALS_BUCKET
from app.services.qa_abuse_service import (
    check_user_restriction,
    record_violation,
    update_restriction,
    validate_question,
)
from app.services.qa_chat_service import answer_question
from app.services.qa_rating_service import insert_rating
from app.services.qa_service import (
    count_qa_items,
    generate_qa_markdown,
    get_qa_markdown,
    parse_qa_metadata,
    save_qa_markdown,
)
from app.services.qa_session_service import (
    add_message,
    create_new_session,
    format_history_for_prompt,
    get_or_create_active_session,
    get_session_detail,
    get_sessions_for_appliance,
    reset_active_session,
)
from app.services.supabase_client import get_supabase_client
from app.services.tier_service import check_and_increment_qa_question

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/qa", tags=["qa"])


def _get_user_id_from_header(x_user_id: str | None) -> UUID:
    """
    Extract and validate user ID from header.

    Args:
        x_user_id: User ID from X-User-Id header

    Returns:
        Validated UUID

    Raises:
        HTTPException: If user ID is missing or invalid
    """
    if not x_user_id:
        raise HTTPException(status_code=401, detail="X-User-Id header is required")
    try:
        return UUID(x_user_id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail="Invalid user ID format") from e


async def get_shared_appliance(shared_appliance_id: str) -> dict:
    """
    Get shared appliance by ID.

    Args:
        shared_appliance_id: Shared appliance ID

    Returns:
        Shared appliance data

    Raises:
        HTTPException: If appliance not found
    """
    supabase = get_supabase_client()
    result = (
        supabase.table("shared_appliances")
        .select("*")
        .eq("id", shared_appliance_id)
        .single()
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=404, detail="Shared appliance not found")
    return result.data


async def get_pdf_bytes(stored_pdf_path: str) -> bytes:
    """
    Download PDF from Supabase Storage.

    Args:
        stored_pdf_path: Storage path of PDF

    Returns:
        PDF file bytes

    Raises:
        HTTPException: If PDF download fails
    """
    supabase = get_supabase_client()
    try:
        return supabase.storage.from_(MANUALS_BUCKET).download(stored_pdf_path)
    except Exception as e:
        logger.error(f"Failed to download PDF: {e}")
        raise HTTPException(status_code=500, detail="Failed to download PDF") from e


@router.post("/generate/{shared_appliance_id}", response_model=QAGenerateResponse)
async def generate_qa(shared_appliance_id: str, request: QAGenerateRequest):
    """
    Generate QA markdown for a shared appliance.

    Args:
        shared_appliance_id: Shared appliance ID
        request: Generation options

    Returns:
        Generation result
    """
    appliance = await get_shared_appliance(shared_appliance_id)

    # Check if QA already exists
    if not request.force_regenerate:
        existing = await get_qa_markdown(appliance["maker"], appliance["model_number"])
        if existing:
            return QAGenerateResponse(
                success=True,
                qa_path=f"{appliance['maker']}/{appliance['model_number']}/qa.md",
                item_count=count_qa_items(existing),
                message="QA already exists",
            )

    # PDF is required for generation
    if not appliance.get("stored_pdf_path"):
        raise HTTPException(status_code=400, detail="No PDF stored for this appliance")

    # Download PDF and generate QA
    pdf_bytes = await get_pdf_bytes(appliance["stored_pdf_path"])
    qa_content = await generate_qa_markdown(
        pdf_bytes,
        appliance["maker"],
        appliance["model_number"],
        appliance.get("category", ""),
        shared_appliance_id,
    )

    qa_path = await save_qa_markdown(
        appliance["maker"], appliance["model_number"], qa_content
    )

    return QAGenerateResponse(
        success=True,
        qa_path=qa_path,
        item_count=count_qa_items(qa_content),
        message="QA generated successfully",
    )


@router.get("/{shared_appliance_id}", response_model=QAGetResponse)
async def get_qa(shared_appliance_id: str):
    """
    Get QA markdown for a shared appliance.

    Args:
        shared_appliance_id: Shared appliance ID

    Returns:
        QA content and metadata
    """
    appliance = await get_shared_appliance(shared_appliance_id)

    content = await get_qa_markdown(appliance["maker"], appliance["model_number"])
    if not content:
        return QAGetResponse(exists=False)

    metadata = parse_qa_metadata(content)
    return QAGetResponse(exists=True, content=content, metadata=metadata)


@router.post("/{shared_appliance_id}/ask", response_model=QAAskResponse)
async def ask_question(
    shared_appliance_id: str,
    request: QAAskRequest,
    x_user_id: Annotated[str | None, Header()] = None,
):
    """
    Ask a question about a shared appliance (requires authentication).

    Args:
        shared_appliance_id: Shared appliance ID
        request: Question request
        x_user_id: User ID from header (required)

    Returns:
        Answer with source and reference

    Raises:
        401: If user is not authenticated
        403: If user is restricted from using QA
        400: If question is invalid (off-topic, inappropriate, etc.)
    """
    # 1. Require authentication
    user_id = _get_user_id_from_header(x_user_id)
    user_id_str = str(user_id)

    # 2. Check if user is restricted
    restriction = await check_user_restriction(user_id_str)
    if restriction:
        error_response = QABlockedError(
            error="QA機能は現在制限されています",
            code="QA_BLOCKED",
            restricted_until=restriction["restricted_until"],
            violation_count=restriction["violation_count"],
        )
        return JSONResponse(
            status_code=403,
            content=error_response.model_dump(mode="json"),
        )

    appliance = await get_shared_appliance(shared_appliance_id)

    # 3. Validate question
    is_valid, error_info = await validate_question(
        request.question,
        appliance["maker"],
        appliance["model_number"],
        appliance.get("category", ""),
    )

    if not is_valid and error_info:
        # Record violation and update restriction
        await record_violation(
            user_id_str,
            shared_appliance_id,
            request.question,
            error_info["violation_type"],
            error_info["detection_method"],
        )
        await update_restriction(user_id_str)

        error_response = InvalidQuestionError(
            error="この質問は製品に関連していないため回答できません",
            code="INVALID_QUESTION",
            violation_type=error_info["violation_type"],
            reason=error_info["reason"],
        )
        return JSONResponse(
            status_code=400,
            content=error_response.model_dump(mode="json"),
        )

    # 4. Get PDF bytes if available
    pdf_bytes = None
    if appliance.get("stored_pdf_path"):
        try:
            pdf_bytes = await get_pdf_bytes(appliance["stored_pdf_path"])
        except Exception as e:
            logger.warning(f"Failed to get PDF: {e}")

    # 5. Generate answer
    result = await answer_question(
        request.question,
        appliance["maker"],
        appliance["model_number"],
        pdf_bytes,
    )

    return QAAskResponse(
        answer=result["answer"],
        source=result["source"],
        reference=result.get("reference"),
        added_to_qa=result.get("added_to_qa", False),
    )


@router.post("/{shared_appliance_id}/ask-stream")
async def ask_question_stream(
    shared_appliance_id: str,
    request: QAAskRequest,
    x_user_id: Annotated[str | None, Header()] = None,
):
    """
    Ask a question with streaming progress updates via SSE (requires authentication).

    Returns Server-Sent Events with step progress and final answer.
    Events:
    - step_start: Step is starting (includes step number and name)
    - step_complete: Step is complete
    - answer: Final answer (includes answer, source, reference)
    - error: Error occurred

    Args:
        shared_appliance_id: Shared appliance ID
        request: Question request
        x_user_id: User ID from header (required)

    Returns:
        StreamingResponse with SSE events

    Raises:
        401: If user is not authenticated
        403: If user is restricted from using QA
        400: If question is invalid (off-topic, inappropriate, etc.)
    """
    from app.services.qa_chat_service import answer_question_stream

    # 1. Require authentication
    user_id = _get_user_id_from_header(x_user_id)
    user_id_str = str(user_id)

    # 2. Check if user is restricted
    restriction = await check_user_restriction(user_id_str)
    if restriction:
        error_response = QABlockedError(
            error="QA機能は現在制限されています",
            code="QA_BLOCKED",
            restricted_until=restriction["restricted_until"],
            violation_count=restriction["violation_count"],
        )
        return JSONResponse(
            status_code=403,
            content=error_response.model_dump(mode="json"),
        )

    # Check tier limit for QA questions
    tier_check = check_and_increment_qa_question(user_id_str)
    if not tier_check["allowed"]:
        return JSONResponse(
            status_code=403,
            content=TierLimitExceededError(
                message="本日のQA質問回数が上限に達しました",
                current_usage=tier_check["current_usage"],
                limit=tier_check["limit"],
                tier=tier_check["tier_name"],
                tier_display_name=tier_check["tier_display_name"],
            ).model_dump(),
        )

    appliance = await get_shared_appliance(shared_appliance_id)

    # 3. Validate question
    is_valid, error_info = await validate_question(
        request.question,
        appliance["maker"],
        appliance["model_number"],
        appliance.get("category", ""),
    )

    if not is_valid and error_info:
        # Record violation and update restriction
        await record_violation(
            user_id_str,
            shared_appliance_id,
            request.question,
            error_info["violation_type"],
            error_info["detection_method"],
        )
        await update_restriction(user_id_str)

        error_response = InvalidQuestionError(
            error="この質問は製品に関連していないため回答できません",
            code="INVALID_QUESTION",
            violation_type=error_info["violation_type"],
            reason=error_info["reason"],
        )
        return JSONResponse(
            status_code=400,
            content=error_response.model_dump(mode="json"),
        )

    # 4. Session handling - Get or create session before PDF retrieval
    if request.session_id:
        session = await get_session_detail(request.session_id, user_id_str)
        if not session:
            session = await get_or_create_active_session(
                user_id_str, shared_appliance_id
            )
    else:
        session = await get_or_create_active_session(user_id_str, shared_appliance_id)

    # Format conversation history for prompt
    history_context = format_history_for_prompt(session.messages)

    # Add user's question to session
    await add_message(session.id, "user", request.question)

    # 5. Get PDF bytes if available
    pdf_bytes = None
    if appliance.get("stored_pdf_path"):
        try:
            pdf_bytes = await get_pdf_bytes(appliance["stored_pdf_path"])
        except Exception as e:
            logger.warning(f"Failed to get PDF: {e}")

    # 6. Generate streaming response
    async def generate():
        """Generate SSE events."""
        final_answer = None
        final_source = None
        final_reference = None
        try:
            async for event in answer_question_stream(
                request.question,
                appliance["maker"],
                appliance["model_number"],
                pdf_bytes,
                history_context=history_context,
                session_id=session.id,
            ):
                # Capture final answer and metadata for session storage
                if event.event == "answer" and event.answer:
                    final_answer = event.answer
                    final_source = event.source
                    final_reference = event.reference
                yield f"data: {event.model_dump_json()}\n\n"
        except Exception as e:
            logger.error(f"Error in ask-stream: {e}")
            from app.schemas.qa import QAStreamEvent

            error_event = QAStreamEvent(event="error", error=str(e))
            yield f"data: {error_event.model_dump_json()}\n\n"
        finally:
            # Add assistant's response to session with metadata
            if final_answer:
                await add_message(
                    session.id,
                    "assistant",
                    final_answer,
                    source=final_source,
                    reference=final_reference,
                )

    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@router.post("/{shared_appliance_id}/feedback", response_model=QAFeedbackResponse)
async def submit_feedback(
    shared_appliance_id: str,
    request: QAFeedbackRequest,
    x_user_id: Annotated[str | None, Header()] = None,
):
    """
    Submit feedback on a QA answer.

    Negative ratings accumulate; 3 or more negatives trigger auto-deletion
    of user-added QAs from the markdown file.

    Args:
        shared_appliance_id: Shared appliance ID
        request: Feedback data
        x_user_id: User ID from header (required for rating)

    Returns:
        Success response with deletion status
    """
    # Verify appliance exists
    await get_shared_appliance(shared_appliance_id)

    # Get user ID from header
    user_id = _get_user_id_from_header(x_user_id)

    # Insert rating and check for auto-deletion
    result = await insert_rating(
        shared_appliance_id=UUID(shared_appliance_id),
        user_id=user_id,
        question=request.question,
        is_helpful=request.is_helpful,
    )

    logger.info(
        f"Feedback received for {shared_appliance_id}: "
        f"helpful={request.is_helpful}, negative_count={result['negative_count']}"
    )

    if result["deleted"]:
        return QAFeedbackResponse(
            success=True,
            message="このQAは複数の低評価を受けたため削除されました。",
            deleted=True,
        )

    return QAFeedbackResponse(
        success=True,
        message="フィードバックを受け付けました。ありがとうございます！",
        deleted=False,
    )


@router.post("/batch-generate", response_model=QABatchGenerateResponse)
async def batch_generate_qa(request: QABatchGenerateRequest):
    """
    Batch generate QA for multiple appliances.

    Args:
        request: Batch generation options

    Returns:
        Batch generation results
    """
    supabase = get_supabase_client()

    # Get target appliances
    query = (
        supabase.table("shared_appliances")
        .select("*")
        .not_.is_("stored_pdf_path", "null")
    )

    if request.shared_appliance_ids:
        query = query.in_("id", request.shared_appliance_ids)

    result = query.limit(request.max_count).execute()
    appliances = result.data or []

    processed = 0
    success = 0
    failed = 0
    errors = []

    for appliance in appliances:
        processed += 1
        try:
            # Skip if QA already exists
            existing = await get_qa_markdown(
                appliance["maker"], appliance["model_number"]
            )
            if existing:
                success += 1
                continue

            # Get PDF
            pdf_bytes = await get_pdf_bytes(appliance["stored_pdf_path"])

            # Generate QA
            qa_content = await generate_qa_markdown(
                pdf_bytes,
                appliance["maker"],
                appliance["model_number"],
                appliance.get("category", ""),
                appliance["id"],
            )

            await save_qa_markdown(
                appliance["maker"], appliance["model_number"], qa_content
            )

            success += 1
            logger.info(
                f"QA generated for {appliance['maker']} {appliance['model_number']}"
            )

        except Exception as e:
            failed += 1
            error_msg = f"{appliance['id']}: {str(e)}"
            errors.append(error_msg)
            logger.error(f"Failed to generate QA: {error_msg}")

    return QABatchGenerateResponse(
        processed=processed,
        success=success,
        failed=failed,
        errors=errors[:10],  # Return only first 10 errors
    )


@router.get("/{shared_appliance_id}/sessions")
async def get_sessions(
    shared_appliance_id: str,
    x_user_id: Annotated[str | None, Header()] = None,
) -> QASessionListResponse:
    """
    Get QA session list for a shared appliance.

    Args:
        shared_appliance_id: Shared appliance ID
        x_user_id: User ID from header (required)

    Returns:
        List of sessions

    Raises:
        401: If user is not authenticated
    """
    from app.services.supabase_client import get_supabase_client

    user_id = _get_user_id_from_header(x_user_id)

    # ユーザーが参加しているグループを取得
    group_id = None
    client = get_supabase_client()
    if client:
        try:
            membership = (
                client.table("group_members")
                .select("group_id")
                .eq("user_id", str(user_id))
                .maybe_single()
                .execute()
            )
            if membership.data:
                group_id = membership.data["group_id"]
        except Exception:
            pass  # グループ未参加の場合は個人セッションのみ

    sessions = await get_sessions_for_appliance(
        str(user_id), shared_appliance_id, group_id
    )
    return QASessionListResponse(sessions=sessions)


@router.get("/sessions/{session_id}")
async def get_session(
    session_id: str,
    x_user_id: Annotated[str | None, Header()] = None,
) -> QASessionDetail:
    """
    Get QA session details with messages.

    Args:
        session_id: Session ID
        x_user_id: User ID from header (required)

    Returns:
        Session details with messages

    Raises:
        401: If user is not authenticated
        404: If session not found
    """
    user_id = _get_user_id_from_header(x_user_id)
    session = await get_session_detail(session_id, str(user_id))
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    return session


@router.post("/{shared_appliance_id}/sessions")
async def create_session(
    shared_appliance_id: str,
    x_user_id: Annotated[str | None, Header()] = None,
) -> QASessionDetail:
    """
    Create a new QA session.

    Args:
        shared_appliance_id: Shared appliance ID
        x_user_id: User ID from header (required)

    Returns:
        New session details

    Raises:
        401: If user is not authenticated
    """
    user_id = _get_user_id_from_header(x_user_id)
    session = await create_new_session(str(user_id), shared_appliance_id)
    return session


@router.post("/{shared_appliance_id}/reset-session")
async def reset_session(
    shared_appliance_id: str,
    x_user_id: Annotated[str | None, Header()] = None,
) -> QAResetSessionResponse:
    """
    Reset active session and create a new one.

    Args:
        shared_appliance_id: Shared appliance ID
        x_user_id: User ID from header (required)

    Returns:
        Reset response with new session ID

    Raises:
        401: If user is not authenticated
    """
    user_id = _get_user_id_from_header(x_user_id)
    new_session_id = await reset_active_session(str(user_id), shared_appliance_id)
    return QAResetSessionResponse(
        success=True,
        message="セッションをリセットしました",
        new_session_id=new_session_id,
    )
