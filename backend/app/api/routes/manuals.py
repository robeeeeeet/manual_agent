"""Manual-related API routes"""

from fastapi import APIRouter, File, HTTPException, UploadFile, status

from app.schemas.appliance import (
    ErrorResponse,
    MaintenanceExtractionRequest,
    MaintenanceExtractionResponse,
    ManualSearchRequest,
    ManualSearchResponse,
)
from app.services.maintenance_extraction import extract_maintenance_items
from app.services.manual_search import search_manual
from app.config import settings

router = APIRouter(prefix="/manuals", tags=["manuals"])


@router.post(
    "/search",
    response_model=ManualSearchResponse,
    responses={
        400: {"model": ErrorResponse},
        500: {"model": ErrorResponse},
    },
    summary="Search for manual PDF",
    description="Search for manual PDF using manufacturer and model number"
)
async def search_manual_pdf(request: ManualSearchRequest):
    """
    Search for manual PDF by manufacturer and model number.

    This endpoint uses a two-step strategy:
    1. Direct PDF search using filetype:pdf
    2. Manual page search and extraction if direct search fails

    Args:
        request: Search parameters (manufacturer, model_number, optional domains)

    Returns:
        ManualSearchResponse with PDF URL if found

    Raises:
        HTTPException: If search fails
    """
    try:
        result = await search_manual(
            manufacturer=request.manufacturer,
            model_number=request.model_number,
            official_domains=request.official_domains
        )
        return result

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={
                "error": "Manual search failed",
                "code": "SEARCH_ERROR",
                "details": str(e)
            }
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
    description="Extract maintenance items from manual PDF (URL or file upload)"
)
async def extract_maintenance(
    pdf_url: str = None,
    manufacturer: str = None,
    model_number: str = None,
    category: str = None,
    pdf_file: UploadFile = File(None, description="Manual PDF file (alternative to URL)")
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
                "details": "Provide either pdf_url or pdf_file"
            }
        )

    if pdf_url and pdf_file:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "error": "Multiple PDF sources",
                "code": "MULTIPLE_PDF_SOURCES",
                "details": "Provide only one of pdf_url or pdf_file"
            }
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
                        "details": f"Expected application/pdf, got {pdf_file.content_type}"
                    }
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
                        "details": f"Max size: {settings.max_upload_size_mb}MB, got {file_size_mb:.2f}MB"
                    }
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
            source_filename=source_filename
        )

        # Check for extraction errors
        if "error" in result:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail={
                    "error": "Extraction failed",
                    "code": "EXTRACTION_ERROR",
                    "details": result.get("error")
                }
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
                "details": str(e)
            }
        )
