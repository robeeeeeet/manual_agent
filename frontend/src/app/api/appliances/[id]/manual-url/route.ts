import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:8000";

/**
 * GET /api/appliances/[id]/manual-url
 * Get a signed URL for the manual PDF
 *
 * Returns a temporary URL (valid for 1 hour) to access the manual PDF.
 * This is required because the manuals bucket is private.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Get authenticated user
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

    // Call backend API
    const response = await fetch(
      `${BACKEND_URL}/api/v1/appliances/${id}/manual-url`,
      {
        method: "GET",
        headers: {
          "X-User-ID": user.id,
        },
      }
    );

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json(data, { status: response.status });
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error("Failed to get manual URL:", error);
    return NextResponse.json(
      {
        error: "Failed to get manual URL",
        code: "INTERNAL_ERROR",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
