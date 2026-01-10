"""Pydantic schemas for appliance-related API operations"""

from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, Field


# ============================================================================
# Shared Appliance Schemas (家電マスター)
# ============================================================================
class SharedApplianceBase(BaseModel):
    """Base schema for shared appliance data"""

    maker: str = Field(..., description="Manufacturer name", min_length=1)
    model_number: str = Field(..., description="Model number", min_length=1)
    category: str = Field(..., description="Product category", min_length=1)
    manual_source_url: str | None = Field(
        None, description="Original source URL of the manual"
    )
    stored_pdf_path: str | None = Field(
        None, description="Path to stored PDF in Supabase Storage"
    )


class SharedApplianceCreate(SharedApplianceBase):
    """Schema for creating a new shared appliance"""

    pass


class SharedAppliance(SharedApplianceBase):
    """Schema for shared appliance response"""

    id: UUID = Field(..., description="Unique identifier")
    created_at: datetime = Field(..., description="Creation timestamp")
    updated_at: datetime = Field(..., description="Last update timestamp")

    model_config = {"from_attributes": True}


# ============================================================================
# User Appliance Schemas (ユーザー所有関係)
# ============================================================================
class UserApplianceBase(BaseModel):
    """Base schema for user appliance ownership"""

    name: str = Field(
        ..., description="User's display name for the appliance", min_length=1
    )
    image_url: str | None = Field(None, description="URL of user-uploaded image")


class UserApplianceCreate(UserApplianceBase):
    """Schema for registering a new user appliance"""

    # 家電マスター情報（新規作成または既存参照）
    maker: str = Field(..., description="Manufacturer name", min_length=1)
    model_number: str = Field(..., description="Model number", min_length=1)
    category: str = Field(..., description="Product category", min_length=1)
    manual_source_url: str | None = Field(
        None, description="Original source URL of the manual"
    )
    stored_pdf_path: str | None = Field(
        None, description="Path to stored PDF in Supabase Storage"
    )


class UserAppliance(UserApplianceBase):
    """Schema for user appliance response"""

    id: UUID = Field(..., description="Unique identifier")
    user_id: UUID = Field(..., description="Owner's user ID")
    shared_appliance_id: UUID = Field(..., description="Reference to shared appliance")
    created_at: datetime = Field(..., description="Creation timestamp")
    updated_at: datetime = Field(..., description="Last update timestamp")

    model_config = {"from_attributes": True}


class NextMaintenanceInfo(BaseModel):
    """Next maintenance information for an appliance"""

    task_name: str = Field(..., description="Task name")
    next_due_at: datetime = Field(..., description="Next due timestamp")
    importance: Literal["high", "medium", "low"] = Field(
        ..., description="Importance level"
    )
    days_until_due: int = Field(..., description="Days until due (negative if overdue)")


class UserApplianceWithDetails(UserAppliance):
    """User appliance with shared appliance details (joined view)"""

    # 家電マスター情報を展開
    maker: str = Field(..., description="Manufacturer name")
    model_number: str = Field(..., description="Model number")
    category: str = Field(..., description="Product category")
    manual_source_url: str | None = Field(None, description="Manual source URL")
    stored_pdf_path: str | None = Field(None, description="Stored PDF path")

    # 次回メンテナンス情報（最も近い期限）
    next_maintenance: NextMaintenanceInfo | None = Field(
        None, description="Next upcoming maintenance task (if any)"
    )


class UserApplianceUpdate(BaseModel):
    """Schema for updating user appliance"""

    name: str | None = Field(None, description="New display name", min_length=1)
    image_url: str | None = Field(None, description="New image URL")


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
class PdfCandidate(BaseModel):
    """PDF candidate found during manual search (for caching/retry)"""

    url: str = Field(..., description="PDF URL")
    source: Literal["google_search", "explore_link", "page_extract"] = Field(
        ..., description="Source where this candidate was discovered"
    )
    judgment: Literal["yes", "maybe", "no", "pending"] = Field(
        ..., description="Snippet-based judgment of whether this is the target manual"
    )
    title: str | None = Field(None, description="Title from search result")
    snippet: str | None = Field(None, description="Snippet from search result")
    verified: bool = Field(
        False, description="Whether verification was attempted (success or failure)"
    )
    verification_failed_reason: str | None = Field(
        None,
        description="Reason for verification failure (null if not verified or succeeded)",
    )
    priority: int = Field(
        0, description="Priority for processing (lower = higher priority)"
    )


class ManualSearchRequest(BaseModel):
    """Request for manual PDF search"""

    manufacturer: str = Field(..., description="Manufacturer name", min_length=1)
    model_number: str = Field(..., description="Model number", min_length=1)
    official_domains: list[str] | None = Field(
        None, description="List of official domains to search (e.g., ['hitachi.co.jp'])"
    )
    excluded_urls: list[str] | None = Field(
        None, description="List of PDF URLs to exclude from search results (for retry)"
    )
    skip_domain_filter: bool = Field(
        False, description="Skip domain-based filtering for broader search (for retry)"
    )
    cached_candidates: list[PdfCandidate] | None = Field(
        None, description="Cached PDF candidates from previous search (for retry)"
    )


class ManualConfirmRequest(BaseModel):
    """Request to confirm a manual PDF and trigger domain learning/storage/registration"""

    manufacturer: str = Field(..., description="Manufacturer name", min_length=1)
    model_number: str = Field(..., description="Model number", min_length=1)
    category: str = Field(..., description="Product category", min_length=1)
    pdf_url: str = Field(..., description="URL of the confirmed PDF")


class ManualConfirmResponse(BaseModel):
    """Response for manual confirmation"""

    success: bool = Field(..., description="Whether the confirmation was successful")
    domain_saved: bool = Field(
        False, description="Whether the domain was saved for future searches"
    )
    pdf_stored: bool = Field(False, description="Whether the PDF was stored")
    storage_path: str | None = Field(
        None, description="Path where PDF is stored in Supabase Storage"
    )
    storage_url: str | None = Field(
        None, description="Public URL to access the stored PDF"
    )
    shared_appliance_id: str | None = Field(
        None, description="ID of the created/updated shared appliance"
    )
    message: str | None = Field(None, description="Additional message")


class ExistingPdfCheckRequest(BaseModel):
    """Request to check for existing PDF by manufacturer and model number"""

    manufacturer: str = Field(..., description="Manufacturer name", min_length=1)
    model_number: str = Field(..., description="Model number", min_length=1)


class ExistingPdfCheckResponse(BaseModel):
    """Response for existing PDF check"""

    found: bool = Field(..., description="Whether an existing PDF was found")
    shared_appliance_id: str | None = Field(
        None, description="ID of the shared appliance record"
    )
    storage_path: str | None = Field(
        None, description="Path where PDF is stored in Supabase Storage"
    )
    storage_url: str | None = Field(
        None, description="Public URL to access the stored PDF"
    )
    source_url: str | None = Field(
        None, description="Original source URL where PDF was downloaded from"
    )
    message: str | None = Field(None, description="Additional message")


class ManualSearchResponse(BaseModel):
    """Response from manual search service"""

    success: bool = Field(..., description="Whether PDF was found")
    pdf_url: str | None = Field(None, description="URL of the PDF if found")
    method: str | None = Field(
        None,
        description="Method used to find PDF (e.g., 'direct_search', 'page_search_extract')",
    )
    reason: str | None = Field(None, description="Reason if not found")
    candidates: list[PdfCandidate] | None = Field(
        None, description="All PDF candidates found during search (for retry caching)"
    )


# ============================================================================
# Shared Maintenance Item Schemas (メンテナンス項目キャッシュ)
# ============================================================================
class SharedMaintenanceItemBase(BaseModel):
    """Base schema for shared maintenance item (LLM extraction cache)"""

    task_name: str = Field(..., description="Task name", min_length=1)
    description: str | None = Field(None, description="Detailed description")
    recommended_interval_type: Literal["days", "months", "manual"] = Field(
        ..., description="Recommended interval type"
    )
    recommended_interval_value: int | None = Field(
        None, description="Recommended interval value (null for manual)"
    )
    source_page: str | None = Field(None, description="Reference page in manual")
    importance: Literal["high", "medium", "low"] = Field(
        "medium", description="Importance level"
    )


class SharedMaintenanceItemCreate(SharedMaintenanceItemBase):
    """Schema for creating a shared maintenance item"""

    shared_appliance_id: UUID = Field(..., description="Parent shared appliance ID")


class SharedMaintenanceItem(SharedMaintenanceItemBase):
    """Schema for shared maintenance item response"""

    id: UUID = Field(..., description="Unique identifier")
    shared_appliance_id: UUID = Field(..., description="Parent shared appliance ID")
    extracted_at: datetime = Field(
        ..., description="When this item was extracted by LLM"
    )
    created_at: datetime = Field(..., description="Creation timestamp")

    model_config = {"from_attributes": True}


class SharedMaintenanceItemList(BaseModel):
    """List of shared maintenance items for an appliance"""

    shared_appliance_id: UUID = Field(..., description="Shared appliance ID")
    items: list[SharedMaintenanceItem] = Field(
        ..., description="List of maintenance items"
    )
    extracted_at: datetime | None = Field(
        None, description="When items were extracted (null if not yet extracted)"
    )
    is_cached: bool = Field(
        ...,
        description="Whether items are from cache (True) or newly extracted (False)",
    )


# ============================================================================
# Maintenance Schedule Registration Schemas (ユーザー選択・登録)
# ============================================================================
class MaintenanceScheduleCreate(BaseModel):
    """Schema for creating a maintenance schedule from shared item"""

    user_appliance_id: UUID = Field(..., description="User's appliance ID")
    shared_item_id: UUID | None = Field(
        None, description="Reference to shared maintenance item (null for custom)"
    )
    task_name: str = Field(
        ..., description="Task name (can be customized)", min_length=1
    )
    description: str | None = Field(None, description="Task description")
    interval_type: Literal["days", "months", "manual"] = Field(
        ..., description="Interval type"
    )
    interval_value: int | None = Field(
        None, description="Interval value (null for manual)"
    )
    importance: Literal["high", "medium", "low"] = Field(
        "medium", description="Importance level"
    )


class MaintenanceScheduleBulkCreate(BaseModel):
    """Schema for bulk creating maintenance schedules from selected shared items"""

    user_appliance_id: UUID = Field(..., description="User's appliance ID")
    selected_item_ids: list[UUID] = Field(
        ..., description="List of shared maintenance item IDs to register"
    )


class MaintenanceSchedule(BaseModel):
    """Schema for maintenance schedule response"""

    id: UUID = Field(..., description="Unique identifier")
    user_appliance_id: UUID = Field(..., description="User's appliance ID")
    shared_item_id: UUID | None = Field(
        None, description="Reference to shared maintenance item"
    )
    task_name: str = Field(..., description="Task name")
    description: str | None = Field(None, description="Task description")
    interval_type: Literal["days", "months", "manual"] = Field(
        ..., description="Interval type"
    )
    interval_value: int | None = Field(None, description="Interval value")
    last_done_at: datetime | None = Field(None, description="Last completion timestamp")
    next_due_at: datetime | None = Field(None, description="Next due timestamp")
    source_page: str | None = Field(None, description="Reference page")
    importance: Literal["high", "medium", "low"] = Field(
        ..., description="Importance level"
    )
    created_at: datetime = Field(..., description="Creation timestamp")
    updated_at: datetime = Field(..., description="Last update timestamp")

    model_config = {"from_attributes": True}


# ============================================================================
# Maintenance Extraction Schemas
# ============================================================================
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


# ============================================================================
# Maintenance Log Schemas (完了記録)
# ============================================================================
class MaintenanceCompleteRequest(BaseModel):
    """Request to mark a maintenance schedule as complete"""

    notes: str | None = Field(None, description="Optional notes about the completion")
    done_at: datetime | None = Field(
        None, description="When the maintenance was done (defaults to now)"
    )


class MaintenanceLog(BaseModel):
    """Schema for maintenance log response"""

    id: UUID = Field(..., description="Unique identifier")
    schedule_id: UUID = Field(..., description="Maintenance schedule ID")
    done_at: datetime = Field(..., description="When maintenance was completed")
    done_by_user_id: UUID = Field(..., description="User who completed the maintenance")
    notes: str | None = Field(None, description="Notes about the completion")
    created_at: datetime = Field(..., description="Record creation timestamp")

    model_config = {"from_attributes": True}


class MaintenanceLogList(BaseModel):
    """List of maintenance logs with pagination info"""

    logs: list[MaintenanceLog] = Field(..., description="List of maintenance logs")
    total_count: int = Field(..., description="Total number of logs")


class MaintenanceCompleteResponse(BaseModel):
    """Response from completing a maintenance task"""

    success: bool = Field(..., description="Whether the completion was successful")
    log: MaintenanceLog | None = Field(None, description="The created maintenance log")
    schedule: MaintenanceSchedule | None = Field(
        None, description="The updated maintenance schedule"
    )
    message: str | None = Field(None, description="Additional message")
    error: str | None = Field(None, description="Error message if failed")


class UpcomingMaintenanceItem(BaseModel):
    """Maintenance schedule with appliance info for upcoming list"""

    id: UUID = Field(..., description="Schedule ID")
    task_name: str = Field(..., description="Task name")
    description: str | None = Field(None, description="Task description")
    next_due_at: datetime | None = Field(None, description="Next due date")
    importance: Literal["high", "medium", "low"] = Field(
        ..., description="Importance level"
    )
    appliance_name: str = Field(..., description="User's appliance name")
    appliance_id: UUID = Field(..., description="User appliance ID")
    maker: str = Field(..., description="Manufacturer name")
    model_number: str = Field(..., description="Model number")


# ============================================================================
# Maintenance List Schemas (メンテナンス一覧)
# ============================================================================
class MaintenanceWithAppliance(BaseModel):
    """Maintenance schedule with appliance info for list view"""

    id: UUID = Field(..., description="Schedule ID")
    task_name: str = Field(..., description="Task name")
    description: str | None = Field(None, description="Task description")
    next_due_at: datetime | None = Field(None, description="Next due date")
    last_done_at: datetime | None = Field(None, description="Last completion date")
    importance: Literal["high", "medium", "low"] = Field(
        ..., description="Importance level"
    )
    interval_type: Literal["days", "months", "manual"] = Field(
        ..., description="Interval type"
    )
    interval_value: int | None = Field(None, description="Interval value")
    source_page: str | None = Field(None, description="Reference page in manual")
    appliance_id: UUID = Field(..., description="User appliance ID")
    appliance_name: str = Field(..., description="User's appliance name")
    maker: str = Field(..., description="Manufacturer name")
    model_number: str = Field(..., description="Model number")
    category: str = Field(..., description="Product category")
    status: Literal["overdue", "upcoming", "scheduled", "manual"] = Field(
        ..., description="Current status based on due date"
    )
    days_until_due: int | None = Field(
        None, description="Days until due (negative if overdue, null for manual)"
    )


class MaintenanceCounts(BaseModel):
    """Count of maintenance items by status"""

    overdue: int = Field(0, description="Number of overdue items")
    upcoming: int = Field(0, description="Number of items due within 7 days")
    scheduled: int = Field(0, description="Number of items due later")
    manual: int = Field(0, description="Number of manual items")
    total: int = Field(0, description="Total number of items")


class MaintenanceListResponse(BaseModel):
    """Response for maintenance list API"""

    items: list[MaintenanceWithAppliance] = Field(
        ..., description="List of maintenance items"
    )
    counts: MaintenanceCounts = Field(..., description="Counts by status")


# Error Response Schema
class ErrorResponse(BaseModel):
    """Standard error response"""

    error: str = Field(..., description="Error message")
    code: str = Field(..., description="Error code")
    details: str | None = Field(None, description="Additional error details")
