import { NextRequest, NextResponse } from "next/server";

const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:8000";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const { manufacturer, model_number, official_domains } = body;

    if (!manufacturer || !model_number) {
      return NextResponse.json(
        { error: "manufacturer and model_number are required" },
        { status: 400 }
      );
    }

    // Forward the request to the Python backend
    const response = await fetch(`${BACKEND_URL}/api/v1/manuals/search`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        manufacturer,
        model_number,
        official_domains,
      }),
    });

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
    console.error("Error in search-manual API:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
