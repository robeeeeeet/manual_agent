"""Pydantic schemas for appliance-related API operations"""

from typing import Literal

from pydantic import BaseModel, Field


# Image Recognition Schemas
class ManufacturerName(BaseModel):
    """Manufacturer name in multiple languages"""

    ja: str = Field(..., description="Japanese name")
    en: str = Field(..., description="English name")


class LabelLocation(BaseModel):
    """Location guide for finding label"""

    position: str = Field(..., description="Position description")
    description: str = Field(..., description="Detailed description")
    priority: int = Field(..., ge=1, description="Priority (1=highest)")


class LabelGuide(BaseModel):
    """Guide for finding and photographing label"""

    locations: list[LabelLocation] = Field(..., description="Possible label locations")
    photo_tips: str = Field(..., description="Tips for taking photo")


class ImageRecognitionResponse(BaseModel):
    """Response from image recognition service"""

    status: Literal["success", "need_label_photo"] = Field(
        ..., description="Recognition status"
    )
    manufacturer: ManufacturerName = Field(..., description="Manufacturer name")
    model_number: str | None = Field(
        None, description="Model number (null if not readable)"
    )
    category: str = Field(..., description="Product category")
    is_new_category: bool = Field(
        False, description="Whether the category is newly suggested by AI"
    )
    confidence: Literal["high", "medium", "low"] = Field(
        ..., description="Confidence level"
    )
    label_guide: LabelGuide | None = Field(
        None, description="Guide if label not readable"
    )
    error: str | None = Field(None, description="Error message if failed")
    raw_response: str | None = Field(
        None, description="Raw LLM response if JSON parse failed"
    )


# Manual Search Schemas
class ManualSearchRequest(BaseModel):
    """Request for manual PDF search"""

    manufacturer: str = Field(..., description="Manufacturer name", min_length=1)
    model_number: str = Field(..., description="Model number", min_length=1)
    official_domains: list[str] | None = Field(
        None, description="List of official domains to search (e.g., ['hitachi.co.jp'])"
    )


class ManualSearchResponse(BaseModel):
    """Response from manual search service"""

    success: bool = Field(..., description="Whether PDF was found")
    pdf_url: str | None = Field(None, description="URL of the PDF if found")
    method: str | None = Field(
        None,
        description="Method used to find PDF (e.g., 'direct_search', 'page_search_extract')",
    )
    reason: str | None = Field(None, description="Reason if not found")


# Maintenance Extraction Schemas
class ProductInfo(BaseModel):
    """Product information"""

    manufacturer: str = Field(..., description="Manufacturer name")
    model_number: str = Field(..., description="Model number")
    category: str = Field(..., description="Product category")


class MaintenanceItem(BaseModel):
    """Single maintenance item"""

    item_name: str = Field(..., description="Item name")
    description: str = Field(..., description="Detailed description")
    frequency: str = Field(
        ..., description="Maintenance frequency (e.g., '週1回', '月1回')"
    )
    frequency_days: int = Field(..., ge=1, description="Frequency in days")
    category: Literal["cleaning", "inspection", "replacement", "safety"] = Field(
        ..., description="Item category"
    )
    importance: Literal["high", "medium", "low"] = Field(
        ..., description="Importance level"
    )
    page_reference: str | None = Field(None, description="Reference page in manual")


class MaintenanceExtractionRequest(BaseModel):
    """Request for maintenance extraction from URL"""

    pdf_url: str = Field(..., description="URL of the PDF manual")
    manufacturer: str | None = Field(None, description="Manufacturer name (optional)")
    model_number: str | None = Field(None, description="Model number (optional)")
    category: str | None = Field(None, description="Product category (optional)")


class MaintenanceExtractionResponse(BaseModel):
    """Response from maintenance extraction service"""

    product: ProductInfo = Field(..., description="Product information")
    maintenance_items: list[MaintenanceItem] = Field(
        ..., description="List of maintenance items"
    )
    notes: str = Field(..., description="Additional notes from extraction")
    error: str | None = Field(None, description="Error message if failed")
    raw_response: str | None = Field(
        None, description="Raw LLM response if JSON parse failed"
    )


# Error Response Schema
class ErrorResponse(BaseModel):
    """Standard error response"""

    error: str = Field(..., description="Error message")
    code: str = Field(..., description="Error code")
    details: str | None = Field(None, description="Additional error details")
