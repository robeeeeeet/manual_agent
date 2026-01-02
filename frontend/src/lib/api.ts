/**
 * API Client for the Manual Agent application
 */

const API_BASE = "/api";

export interface RecognizeResponse {
  status: "success" | "need_label_photo";
  manufacturer?: {
    ja: string;
    en: string;
  };
  model_number?: string | null;
  category?: string;
  confidence?: string;
  label_guide?: {
    locations: Array<{
      position: string;
      description: string;
      priority: number;
    }>;
    photo_tips: string;
  };
  error?: string;
}

export interface SearchManualRequest {
  manufacturer: string;
  model_number: string;
  official_domains?: string[];
}

export interface SearchManualResponse {
  success: boolean;
  pdf_url?: string;
  method?: string;
  reason?: string;
}

/**
 * Recognize appliance from image
 */
export async function recognizeAppliance(
  imageFile: File
): Promise<RecognizeResponse> {
  const formData = new FormData();
  formData.append("image", imageFile);

  const response = await fetch(`${API_BASE}/appliances/recognize`, {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    throw new Error(`API error: ${response.status}`);
  }

  return response.json();
}

/**
 * Search for manual PDF
 */
export async function searchManual(
  request: SearchManualRequest
): Promise<SearchManualResponse> {
  const response = await fetch(`${API_BASE}/appliances/search-manual`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    throw new Error(`API error: ${response.status}`);
  }

  return response.json();
}

/**
 * Health check
 */
export async function healthCheck(): Promise<{ status: string; timestamp: string }> {
  const response = await fetch(`${API_BASE}/health`);

  if (!response.ok) {
    throw new Error(`API error: ${response.status}`);
  }

  return response.json();
}
