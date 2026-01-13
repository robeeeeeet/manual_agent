/**
 * Contact Form BFF Layer
 * Handles authentication and forwards requests to backend
 */

import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:8000";

export async function POST(request: NextRequest) {
  try {
    // Authenticate user
    const supabase = await createClient();
    if (!supabase) {
      return NextResponse.json(
        { error: "Service unavailable", code: "SERVICE_UNAVAILABLE" },
        { status: 503 }
      );
    }

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "Unauthorized", code: "UNAUTHORIZED" },
        { status: 401 }
      );
    }

    // Parse FormData (supports file upload)
    const formData = await request.formData();

    const type = formData.get("type") as string;
    const screen = formData.get("screen") as string;
    const content = formData.get("content") as string;
    const reproductionSteps = formData.get("reproductionSteps") as string | null;
    const screenshot = formData.get("screenshot") as File | null;

    // Validate required fields
    if (!type || !screen || !content) {
      return NextResponse.json(
        { error: "Missing required fields", code: "VALIDATION_ERROR" },
        { status: 400 }
      );
    }

    // Convert screenshot to base64 if provided
    let screenshotBase64: string | null = null;
    let screenshotFilename: string | null = null;

    if (screenshot && screenshot.size > 0) {
      const buffer = await screenshot.arrayBuffer();
      screenshotBase64 = Buffer.from(buffer).toString("base64");
      screenshotFilename = screenshot.name;
    }

    // Call backend API
    const response = await fetch(`${BACKEND_URL}/api/v1/contact`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-User-ID": user.id,
        "X-User-Email": user.email || "",
      },
      body: JSON.stringify({
        type,
        screen,
        content,
        reproduction_steps: reproductionSteps || null,
        screenshot_base64: screenshotBase64,
        screenshot_filename: screenshotFilename,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("Backend error:", data);
      return NextResponse.json(data, { status: response.status });
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error("Contact submission error:", error);
    return NextResponse.json(
      {
        error: "Failed to submit contact",
        code: "INTERNAL_ERROR",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
