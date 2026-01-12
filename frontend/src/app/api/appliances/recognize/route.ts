import { NextRequest, NextResponse } from "next/server";

const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:8000";

// Extend timeout for image recognition (Gemini API can take 10+ seconds)
// Vercel Pro: max 60s, Vercel Hobby: max 10s (this won't help on Hobby)
export const maxDuration = 60;

// Disable caching for this route
export const dynamic = "force-dynamic";

// Response headers to prevent caching
const noCacheHeaders = {
  "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
  Pragma: "no-cache",
  Expires: "0",
};

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const image = formData.get("image") as File;

    if (!image) {
      return NextResponse.json(
        { error: "Image file is required" },
        { status: 400, headers: noCacheHeaders }
      );
    }

    // Get categories if provided
    const categories = formData.get("categories") as string | null;

    // Forward the request to the Python backend
    const backendFormData = new FormData();
    backendFormData.append("image", image);
    if (categories) {
      backendFormData.append("categories", categories);
    }

    const response = await fetch(
      `${BACKEND_URL}/api/v1/appliances/recognize`,
      {
        method: "POST",
        body: backendFormData,
      }
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return NextResponse.json(
        { error: "Backend request failed", details: errorData },
        { status: response.status, headers: noCacheHeaders }
      );
    }

    const data = await response.json();
    return NextResponse.json(data, { headers: noCacheHeaders });
  } catch (error) {
    console.error("Error in recognize API:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500, headers: noCacheHeaders }
    );
  }
}
