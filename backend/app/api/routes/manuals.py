"""Manual-related API routes"""

import json
import logging
from typing import Annotated

from fastapi import APIRouter, File, HTTPException, UploadFile, status
from fastapi.responses import StreamingResponse

from app.config import settings
from app.schemas.appliance import (
    ErrorResponse,
    ExistingPdfCheckRequest,
    ExistingPdfCheckResponse,
    MaintenanceExtractionResponse,
    MaintenanceSchedule,
    MaintenanceScheduleBulkCreate,
    ManualConfirmRequest,
    ManualConfirmResponse,
    ManualSearchRequest,
    SharedMaintenanceItemList,
)
from app.services.maintenance_cache_service import (
    get_or_extract_maintenance_items,
    register_maintenance_schedules,
)
from app.services.maintenance_extraction import extract_maintenance_items
from app.services.manual_search import (
    SearchProgress,
    search_manual_with_progress,
)
from app.services.qa_service import generate_qa_markdown, save_qa_markdown

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/manuals", tags=["manuals"])

# Type alias with metadata for PDF file upload
PdfFile = Annotated[
    UploadFile | None, File(description="Manual PDF file (alternative to URL)")
]


@router.post(
    "/search-stream",
    summary="Search for manual PDF with progress streaming",
    description="Search for manual PDF with real-time progress updates via SSE",
)
async def search_manual_pdf_stream(request: ManualSearchRequest):
    """
    Search for manual PDF with progress updates via Server-Sent Events (SSE).

    This endpoint streams progress updates during the search process,
    allowing the frontend to display real-time status information.

    Returns:
        StreamingResponse with SSE events
    """

    async def event_generator():
        try:
            async for event in search_manual_with_progress(
                manufacturer=request.manufacturer,
                model_number=request.model_number,
                official_domains=request.official_domains,
                excluded_urls=request.excluded_urls,
                skip_domain_filter=request.skip_domain_filter,
                cached_candidates=[c.model_dump() for c in request.cached_candidates]
                if request.cached_candidates
                else None,
            ):
                if isinstance(event, SearchProgress):
                    data = json.dumps(event.to_dict(), ensure_ascii=False)
                else:
                    # Final result
                    data = json.dumps(event, ensure_ascii=False)
                yield f"data: {data}\n\n"
        except Exception as e:
            error_data = json.dumps(
                {"type": "error", "message": str(e)}, ensure_ascii=False
            )
            yield f"data: {error_data}\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",  # Disable nginx buffering
        },
    )


@router.post(
    "/extract-maintenance",
    response_model=MaintenanceExtractionResponse,
    responses={
        400: {"model": ErrorResponse},
        413: {"model": ErrorResponse},
        500: {"model": ErrorResponse},
    },
    summary="Extract maintenance items from manual PDF",
    description="Extract maintenance items from manual PDF (URL or file upload)",
)
async def extract_maintenance(
    pdf_url: str = None,
    manufacturer: str = None,
    model_number: str = None,
    category: str = None,
    pdf_file: PdfFile = None,
):
    """
    Extract maintenance items from manual PDF.

    This endpoint accepts either:
    - A PDF URL (pdf_url parameter)
    - A PDF file upload (pdf_file parameter)

    The service will:
    1. Upload PDF to Gemini API
    2. Extract maintenance items with LLM
    3. Return structured maintenance schedule

    Args:
        pdf_url: URL of the PDF manual (optional)
        manufacturer: Manufacturer name (optional, helps extraction)
        model_number: Model number (optional, helps extraction)
        category: Product category (optional)
        pdf_file: Uploaded PDF file (alternative to URL)

    Returns:
        MaintenanceExtractionResponse with maintenance items

    Raises:
        HTTPException: If extraction fails or invalid input
    """
    # Validate input - need either URL or file
    if not pdf_url and not pdf_file:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "error": "Missing PDF source",
                "code": "MISSING_PDF_SOURCE",
                "details": "Provide either pdf_url or pdf_file",
            },
        )

    if pdf_url and pdf_file:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "error": "Multiple PDF sources",
                "code": "MULTIPLE_PDF_SOURCES",
                "details": "Provide only one of pdf_url or pdf_file",
            },
        )

    try:
        # Determine PDF source
        if pdf_file:
            # Validate file type
            if pdf_file.content_type != "application/pdf":
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail={
                        "error": "Invalid file type",
                        "code": "INVALID_FILE_TYPE",
                        "details": f"Expected application/pdf, got {pdf_file.content_type}",
                    },
                )

            # Check file size
            contents = await pdf_file.read()
            file_size_mb = len(contents) / (1024 * 1024)

            if file_size_mb > settings.max_upload_size_mb:
                raise HTTPException(
                    status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                    detail={
                        "error": "File too large",
                        "code": "FILE_TOO_LARGE",
                        "details": f"Max size: {settings.max_upload_size_mb}MB, got {file_size_mb:.2f}MB",
                    },
                )

            pdf_source = contents
            source_filename = pdf_file.filename or "manual.pdf"
        else:
            pdf_source = pdf_url
            source_filename = "manual.pdf"

        # Extract maintenance items
        result = await extract_maintenance_items(
            pdf_source=pdf_source,
            manufacturer=manufacturer,
            model_number=model_number,
            category=category,
            source_filename=source_filename,
        )

        # Check for extraction errors
        if "error" in result:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail={
                    "error": "Extraction failed",
                    "code": "EXTRACTION_ERROR",
                    "details": result.get("error"),
                },
            )

        return result

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={
                "error": "Maintenance extraction failed",
                "code": "EXTRACTION_ERROR",
                "details": str(e),
            },
        ) from e


@router.post(
    "/confirm",
    response_model=ManualConfirmResponse,
    responses={
        400: {"model": ErrorResponse},
        500: {"model": ErrorResponse},
    },
    summary="Confirm manual PDF and save domain",
    description="Confirm that the found PDF is correct, then save domain for future searches, store the PDF, and register shared appliance",
)
async def confirm_manual(request: ManualConfirmRequest):
    """
    Confirm a manual PDF after user verification.

    This endpoint should be called after the user has verified that the
    PDF found by search is correct. It performs:
    1. Domain learning - saves the domain for faster future searches
    2. PDF storage - downloads and stores the PDF in Supabase Storage
    3. Shared appliance registration - creates/updates the shared appliance master data

    Args:
        request: ManualConfirmRequest with manufacturer, model_number, category, and pdf_url

    Returns:
        ManualConfirmResponse with status of domain saving, PDF storage, and shared appliance ID
    """
    from app.services.appliance_service import get_or_create_shared_appliance
    from app.services.manufacturer_domain import ManufacturerDomainService
    from app.services.pdf_storage import get_pdf_public_url, save_pdf_from_url

    domain_service = ManufacturerDomainService()

    # 1. Save domain for future searches
    try:
        await domain_service.save_domain(request.manufacturer, request.pdf_url)
        domain_saved = True
    except Exception as e:
        logger.error(f"Domain save error: {e}")
        domain_saved = False

    # 2. Download and store PDF
    pdf_stored = False
    storage_path = None
    storage_url = None
    is_pdf_encrypted = False

    try:
        result = await save_pdf_from_url(
            manufacturer=request.manufacturer,
            model_number=request.model_number,
            pdf_url=request.pdf_url,
        )

        if result.get("success"):
            pdf_stored = True
            storage_path = result.get("storage_path")
            is_pdf_encrypted = result.get("is_encrypted", False)
            # Get public URL for the stored PDF
            if storage_path:
                storage_url = await get_pdf_public_url(storage_path)
    except Exception as e:
        logger.error(f"PDF storage error: {e}")
        pdf_stored = False

    # 3. Create/update shared appliance with PDF info
    shared_appliance_id = None
    try:
        shared_appliance = await get_or_create_shared_appliance(
            maker=request.manufacturer,
            model_number=request.model_number,
            category=request.category,
            manual_source_url=request.pdf_url,
            stored_pdf_path=storage_path,
            is_pdf_encrypted=is_pdf_encrypted,
        )
        shared_appliance_id = str(shared_appliance.id)
    except Exception as e:
        logger.error(f"Shared appliance creation error: {e}")

    # 4. Auto-generate QA markdown after successful PDF storage
    qa_generated = False
    if pdf_stored and shared_appliance_id:
        try:
            from app.services.pdf_storage import download_pdf

            logger.info(
                f"Starting auto QA generation for {request.manufacturer} {request.model_number}"
            )

            # Download PDF to get bytes
            pdf_bytes = await download_pdf(request.pdf_url)
            if pdf_bytes:
                # Generate QA markdown
                qa_content = await generate_qa_markdown(
                    pdf_bytes=pdf_bytes,
                    manufacturer=request.manufacturer,
                    model_number=request.model_number,
                    category=request.category or "",
                    shared_appliance_id=shared_appliance_id,
                )

                # Save QA markdown to storage
                await save_qa_markdown(
                    manufacturer=request.manufacturer,
                    model_number=request.model_number,
                    content=qa_content,
                )
                qa_generated = True
                logger.info(
                    f"QA markdown generated successfully for {request.manufacturer} {request.model_number}"
                )
            else:
                logger.warning(
                    f"Failed to download PDF for QA generation: {request.pdf_url}"
                )
        except Exception as e:
            # QA generation failure should not block the main flow
            logger.error(f"QA generation error (non-critical): {e}")

    # Build response message
    messages = []
    if domain_saved:
        messages.append("ドメインを保存しました")
    if pdf_stored:
        messages.append("PDFを保存しました")
    if shared_appliance_id:
        messages.append("家電マスターを登録しました")
    if qa_generated:
        messages.append("QA情報を生成しました")

    if not messages:
        message = "保存に失敗しました"
    else:
        message = "。".join(messages) + "。"

    return ManualConfirmResponse(
        success=domain_saved or pdf_stored or shared_appliance_id is not None,
        domain_saved=domain_saved,
        pdf_stored=pdf_stored,
        storage_path=storage_path,
        storage_url=storage_url,
        shared_appliance_id=shared_appliance_id,
        message=message,
    )


@router.post(
    "/check-existing",
    response_model=ExistingPdfCheckResponse,
    responses={
        400: {"model": ErrorResponse},
        500: {"model": ErrorResponse},
    },
    summary="Check for existing stored PDF",
    description="Check if a PDF has already been stored for the given manufacturer and model number",
)
async def check_existing_pdf(request: ExistingPdfCheckRequest):
    """
    Check if a PDF already exists in storage for the given manufacturer and model number.

    This endpoint should be called before searching for a new manual to avoid
    unnecessary Google searches. If a PDF is found, its URL can be used directly.

    Args:
        request: ExistingPdfCheckRequest with manufacturer and model_number

    Returns:
        ExistingPdfCheckResponse with PDF info if found
    """
    from uuid import UUID

    from app.schemas.appliance import DuplicateAppliance, DuplicateInGroup
    from app.services.appliance_service import check_duplicate_in_group
    from app.services.pdf_storage import find_existing_pdf
    from app.services.supabase_client import get_supabase_client

    try:
        result = await find_existing_pdf(
            manufacturer=request.manufacturer, model_number=request.model_number
        )

        if result:
            shared_appliance_id = result.get("id")
            already_owned = False
            existing_appliance_id = None
            existing_appliance_name = None
            duplicate_in_group = None

            # Check if user already owns this appliance
            if request.user_id and shared_appliance_id:
                supabase = get_supabase_client()
                ownership_check = (
                    supabase.table("user_appliances")
                    .select("id, name")
                    .eq("user_id", request.user_id)
                    .eq("shared_appliance_id", shared_appliance_id)
                    .execute()
                )
                if ownership_check.data and len(ownership_check.data) > 0:
                    already_owned = True
                    existing_appliance_id = ownership_check.data[0].get("id")
                    existing_appliance_name = ownership_check.data[0].get("name")

                # Check for duplicates in group
                duplicate_result = await check_duplicate_in_group(
                    user_id=UUID(request.user_id),
                    maker=request.manufacturer,
                    model_number=request.model_number,
                )

                if duplicate_result and duplicate_result.get("exists"):
                    appliances = [
                        DuplicateAppliance(
                            id=app["id"],
                            name=app["name"],
                            owner_type=app["owner_type"],
                            owner_name=app["owner_name"],
                        )
                        for app in duplicate_result.get("appliances", [])
                    ]
                    duplicate_in_group = DuplicateInGroup(
                        exists=True, appliances=appliances
                    )

            return ExistingPdfCheckResponse(
                found=True,
                shared_appliance_id=shared_appliance_id,
                storage_path=result.get("storage_path"),
                storage_url=result.get("public_url"),
                source_url=result.get("source_url"),
                message="保存済みの説明書PDFが見つかりました",
                already_owned=already_owned,
                existing_appliance_id=existing_appliance_id,
                existing_appliance_name=existing_appliance_name,
                duplicate_in_group=duplicate_in_group,
            )
        else:
            # PDF not found, but still check for duplicates
            duplicate_in_group = None
            if request.user_id:
                duplicate_result = await check_duplicate_in_group(
                    user_id=UUID(request.user_id),
                    maker=request.manufacturer,
                    model_number=request.model_number,
                )

                if duplicate_result and duplicate_result.get("exists"):
                    appliances = [
                        DuplicateAppliance(
                            id=app["id"],
                            name=app["name"],
                            owner_type=app["owner_type"],
                            owner_name=app["owner_name"],
                        )
                        for app in duplicate_result.get("appliances", [])
                    ]
                    duplicate_in_group = DuplicateInGroup(
                        exists=True, appliances=appliances
                    )

            return ExistingPdfCheckResponse(
                found=False,
                message="保存済みの説明書PDFは見つかりませんでした",
                duplicate_in_group=duplicate_in_group,
            )

    except Exception as e:
        logger.error(f"Error checking existing PDF: {e}")
        return ExistingPdfCheckResponse(
            found=False,
            message=f"検索中にエラーが発生しました: {str(e)}",
        )


# ============================================================================
# Maintenance Items Cache Endpoints
# ============================================================================


@router.get(
    "/maintenance-items/{shared_appliance_id}",
    response_model=SharedMaintenanceItemList,
    responses={
        404: {"model": ErrorResponse},
        500: {"model": ErrorResponse},
    },
    summary="Get maintenance items for a shared appliance",
    description="Get cached maintenance items or extract from PDF if not cached",
)
async def get_maintenance_items(
    shared_appliance_id: str,
    pdf_url: str | None = None,
    manufacturer: str | None = None,
    model_number: str | None = None,
    category: str | None = None,
):
    """
    Get maintenance items for a shared appliance.

    This endpoint first checks the cache (shared_maintenance_items table).
    If cached items exist, they are returned immediately (no LLM call).
    If not cached and pdf_url is provided, items are extracted and cached.

    Args:
        shared_appliance_id: UUID of the shared appliance
        pdf_url: URL of the PDF manual (required if not cached)
        manufacturer: Manufacturer name (helps extraction)
        model_number: Model number (helps extraction)
        category: Product category (helps extraction)

    Returns:
        SharedMaintenanceItemList with items and cache status

    Note:
        When is_cached=True, items are from cache (fast, no LLM cost).
        When is_cached=False, items were just extracted (slower, costs LLM tokens).
    """
    try:
        result = await get_or_extract_maintenance_items(
            shared_appliance_id=shared_appliance_id,
            pdf_url=pdf_url,
            manufacturer=manufacturer,
            model_number=model_number,
            category=category,
        )

        if "error" in result:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail={
                    "error": "Failed to get maintenance items",
                    "code": "MAINTENANCE_ITEMS_ERROR",
                    "details": result.get("error"),
                },
            )

        return SharedMaintenanceItemList(
            shared_appliance_id=shared_appliance_id,
            items=result.get("items", []),
            extracted_at=result.get("extracted_at"),
            is_cached=result.get("is_cached", False),
        )

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={
                "error": "Failed to get maintenance items",
                "code": "MAINTENANCE_ITEMS_ERROR",
                "details": str(e),
            },
        ) from e


@router.post(
    "/maintenance-schedules/register",
    response_model=list[MaintenanceSchedule],
    responses={
        400: {"model": ErrorResponse},
        500: {"model": ErrorResponse},
    },
    summary="Register maintenance schedules from selected items",
    description="Create user's maintenance schedules from selected shared maintenance items",
)
async def register_schedules(request: MaintenanceScheduleBulkCreate):
    """
    Register maintenance schedules from selected shared items.

    This endpoint creates maintenance schedules for the user by copying
    selected items from shared_maintenance_items to maintenance_schedules.

    The user selects which items they want to track, and the system:
    1. Fetches the selected shared items
    2. Creates individual schedules for each selected item
    3. Calculates next_due_at based on recommended intervals

    Args:
        request: MaintenanceScheduleBulkCreate with user_appliance_id and selected_item_ids

    Returns:
        List of created MaintenanceSchedule objects
    """
    if not request.selected_item_ids:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "error": "No items selected",
                "code": "NO_ITEMS_SELECTED",
                "details": "At least one item must be selected",
            },
        )

    try:
        # Get purchased_at from user_appliance for maintenance scheduling
        from datetime import date

        from app.services.supabase_client import get_supabase_client

        client = get_supabase_client()
        purchased_at = None
        if client:
            result = (
                client.table("user_appliances")
                .select("purchased_at")
                .eq("id", str(request.user_appliance_id))
                .single()
                .execute()
            )
            if result.data and result.data.get("purchased_at"):
                purchased_at = date.fromisoformat(result.data["purchased_at"])

        created_schedules = await register_maintenance_schedules(
            user_appliance_id=str(request.user_appliance_id),
            selected_item_ids=[str(id) for id in request.selected_item_ids],
            purchased_at=purchased_at,
        )

        return created_schedules

    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "error": "Invalid request",
                "code": "INVALID_REQUEST",
                "details": str(e),
            },
        ) from e
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={
                "error": "Failed to register schedules",
                "code": "SCHEDULE_REGISTRATION_ERROR",
                "details": str(e),
            },
        ) from e
