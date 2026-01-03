/**
 * HEIC to JPEG converter utility
 * Uses server-side conversion via API for reliable cross-platform support
 */

export interface ConversionResult {
  success: boolean;
  dataUrl?: string;
  error?: string;
}

/**
 * Check if file is HEIC/HEIF format
 */
export function isHeicFile(file: File): boolean {
  const extension = file.name.toLowerCase();
  return extension.endsWith(".heic") || extension.endsWith(".heif");
}

/**
 * Convert HEIC file to JPEG for preview using server-side conversion
 *
 * @param file - HEIC/HEIF file to convert
 * @returns ConversionResult with dataUrl on success
 */
export async function convertHeicToJpeg(file: File): Promise<ConversionResult> {
  try {
    const formData = new FormData();
    formData.append("image", file);

    const response = await fetch("/api/appliances/convert-heic", {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error("HEIC conversion API error:", errorData);
      return {
        success: false,
        error: errorData.error || `Server error: ${response.status}`,
      };
    }

    const data = await response.json();

    if (data.success && data.dataUrl) {
      return {
        success: true,
        dataUrl: data.dataUrl,
      };
    }

    return {
      success: false,
      error: data.error || "Unknown conversion error",
    };
  } catch (error) {
    console.error("HEIC conversion failed:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Network error",
    };
  }
}
