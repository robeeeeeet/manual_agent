import { NextRequest, NextResponse } from "next/server";

const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:8000";

/**
 * GET /api/appliances/maintenance-items/[sharedApplianceId]
 *
 * Get maintenance items for a shared appliance (from cache or extract from PDF)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ sharedApplianceId: string }> }
) {
  try {
    const { sharedApplianceId } = await params;
    const searchParams = request.nextUrl.searchParams;

    // Build query parameters
    const queryParams = new URLSearchParams();
    const pdfUrl = searchParams.get("pdf_url");
    const manufacturer = searchParams.get("manufacturer");
    const modelNumber = searchParams.get("model_number");
    const category = searchParams.get("category");

    if (pdfUrl) queryParams.set("pdf_url", pdfUrl);
    if (manufacturer) queryParams.set("manufacturer", manufacturer);
    if (modelNumber) queryParams.set("model_number", modelNumber);
    if (category) queryParams.set("category", category);

    const queryString = queryParams.toString();
    const url = `${BACKEND_URL}/api/v1/manuals/maintenance-items/${sharedApplianceId}${queryString ? `?${queryString}` : ""}`;

    const response = await fetch(url, {
      method: "GET",
      headers: {
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return NextResponse.json(
        {
          error: errorData.detail?.error || "Failed to get maintenance items",
          code: errorData.detail?.code || "BACKEND_ERROR",
          details: errorData.detail?.details || response.statusText,
        },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error("Maintenance items fetch error:", error);
    return NextResponse.json(
      {
        error: "Internal server error",
        code: "INTERNAL_ERROR",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
