import { NextRequest, NextResponse } from "next/server";

const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:8000";

export async function POST(request: NextRequest) {
  try {
    const contentType = request.headers.get("content-type") || "";

    // Handle file upload (multipart/form-data)
    if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData();
      const pdfFile = formData.get("pdf_file") as File | null;
      const manufacturer = formData.get("manufacturer") as string | null;
      const modelNumber = formData.get("model_number") as string | null;
      const category = formData.get("category") as string | null;

      if (!pdfFile) {
        return NextResponse.json(
          { error: "pdf_file is required" },
          { status: 400 }
        );
      }

      // Forward the file to the backend
      const backendFormData = new FormData();
      backendFormData.append("pdf_file", pdfFile);
      if (manufacturer) backendFormData.append("manufacturer", manufacturer);
      if (modelNumber) backendFormData.append("model_number", modelNumber);
      if (category) backendFormData.append("category", category);

      const response = await fetch(
        `${BACKEND_URL}/api/v1/manuals/extract-maintenance`,
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
    }

    // Handle JSON request (URL-based extraction)
    const body = await request.json();
    const { pdf_url, manufacturer, model_number, category } = body;

    if (!pdf_url) {
      return NextResponse.json(
        { error: "pdf_url is required" },
        { status: 400 }
      );
    }

    // Build form data for the backend request
    const params = new URLSearchParams();
    params.append("pdf_url", pdf_url);
    if (manufacturer) params.append("manufacturer", manufacturer);
    if (model_number) params.append("model_number", model_number);
    if (category) params.append("category", category);

    // Forward the request to the Python backend
    const response = await fetch(
      `${BACKEND_URL}/api/v1/manuals/extract-maintenance?${params.toString()}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
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
    console.error("Error in extract-maintenance API:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
