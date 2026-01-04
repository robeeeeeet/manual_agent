// API Response Types

// Image Recognition Types
export interface LabelLocation {
  position: string;
  description: string;
  priority: number;
}

export interface LabelGuide {
  locations: LabelLocation[];
  photo_tips: string;
}

export interface ManufacturerName {
  ja: string;
  en: string;
}

export interface ImageRecognitionResponse {
  status: "success" | "need_label_photo";
  manufacturer: ManufacturerName;
  model_number: string | null;
  category: string;
  is_new_category: boolean;
  confidence: "high" | "medium" | "low";
  label_guide: LabelGuide | null;
  error: string | null;
  raw_response: string | null;
}

export interface PdfCandidate {
  url: string;
  source: "google_search" | "explore_link" | "page_extract";
  judgment: "yes" | "maybe" | "no" | "pending";
  title: string | null;
  snippet: string | null;
  verified: boolean;
  verification_failed_reason: string | null;
  priority: number;
}

export interface ManualSearchResponse {
  success: boolean;
  pdf_url: string | null;
  method: string | null;
  reason: string | null;
  candidates?: PdfCandidate[];
}

export interface MaintenanceItem {
  item_name: string;
  description: string;
  frequency: string;
  frequency_days: number;
  category: "cleaning" | "inspection" | "replacement" | "safety";
  importance: "high" | "medium" | "low";
  page_reference: string | null;
}

export interface ProductInfo {
  manufacturer: string | null;
  model_number: string | null;
  product_name: string | null;
  category: string | null;
}

export interface MaintenanceExtractionResponse {
  product: ProductInfo;
  maintenance_items: MaintenanceItem[];
  notes: string;
  error: string | null;
  raw_response: string | null;
}

// Form Data Types

export interface ApplianceFormData {
  manufacturer: string;
  modelNumber: string;
  category: string;
  name: string;
}

// ============================================================================
// Shared Appliance Types (家電マスター)
// ============================================================================

export interface SharedAppliance {
  id: string;
  maker: string;
  model_number: string;
  category: string;
  manual_source_url: string | null;
  stored_pdf_path: string | null;
  created_at: string;
  updated_at: string;
}

// ============================================================================
// User Appliance Types (ユーザー所有関係)
// ============================================================================

export interface UserAppliance {
  id: string;
  user_id: string;
  shared_appliance_id: string;
  name: string;
  image_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface UserApplianceWithDetails extends UserAppliance {
  // Shared appliance details (joined)
  maker: string;
  model_number: string;
  category: string;
  manual_source_url: string | null;
  stored_pdf_path: string | null;
}

export interface UserApplianceCreate {
  name: string;
  maker: string;
  model_number: string;
  category: string;
  manual_source_url?: string;
  stored_pdf_path?: string;
  image_url?: string;
}

export interface UserApplianceUpdate {
  name?: string;
  image_url?: string;
}

// ============================================================================
// Shared Maintenance Item Types (メンテナンス項目キャッシュ)
// ============================================================================

export interface SharedMaintenanceItem {
  id: string;
  shared_appliance_id: string;
  task_name: string;
  description: string | null;
  recommended_interval_type: "days" | "months" | "manual";
  recommended_interval_value: number | null;
  source_page: string | null;
  importance: "high" | "medium" | "low";
  extracted_at: string;
  created_at: string;
}

export interface SharedMaintenanceItemList {
  shared_appliance_id: string;
  items: SharedMaintenanceItem[];
  extracted_at: string | null;
  is_cached: boolean;
}

export interface MaintenanceScheduleBulkCreate {
  user_appliance_id: string;
  selected_item_ids: string[];
}

// ============================================================================
// Maintenance Schedule Types
// ============================================================================

export interface MaintenanceSchedule {
  id: string;
  user_appliance_id: string;
  shared_item_id: string | null;
  task_name: string;
  description: string | null;
  interval_type: "days" | "months" | "manual";
  interval_value: number | null;
  last_done_at: string | null;
  next_due_at: string | null;
  source_page: string | null;
  importance: "high" | "medium" | "low";
  created_at: string;
  updated_at: string;
}

export interface MaintenanceScheduleInsert {
  user_appliance_id: string;
  task_name: string;
  description: string | null;
  interval_type: "days" | "months" | "manual";
  interval_value: number | null;
  next_due_at: string;
  source_page: string | null;
  importance: "high" | "medium" | "low";
}

// ============================================================================
// Legacy Types (Deprecated - for backwards compatibility)
// ============================================================================

/** @deprecated Use UserApplianceCreate instead */
export interface ApplianceInsert {
  user_id: string;
  name: string;
  maker: string;
  model_number: string;
  category: string;
  manual_source_url: string;
  stored_pdf_path?: string;
  image_url?: string;
}
