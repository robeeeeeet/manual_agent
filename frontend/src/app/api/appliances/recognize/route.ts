import { NextRequest, NextResponse } from "next/server";

const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:8000";

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const image = formData.get("image") as File;

    if (!image) {
      return NextResponse.json(
        { error: "Image file is required" },
        { status: 400 }
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
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error("Error in recognize API:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
