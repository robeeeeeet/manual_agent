import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:8000";

/**
 * GET /api/appliances/maintenance-schedules/[id]/logs
 *
 * Get completion history for a maintenance schedule
 * Supports pagination via limit and offset query parameters
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: scheduleId } = await params;
    const { searchParams } = new URL(request.url);

    // Get pagination parameters
    const limit = parseInt(searchParams.get("limit") || "10", 10);
    const offset = parseInt(searchParams.get("offset") || "0", 10);

    // Validate pagination parameters
    if (limit < 1 || limit > 100) {
      return NextResponse.json(
        {
          error: "Invalid limit",
          code: "VALIDATION_ERROR",
          details: "Limit must be between 1 and 100",
        },
        { status: 400 }
      );
    }

    if (offset < 0) {
      return NextResponse.json(
        {
          error: "Invalid offset",
          code: "VALIDATION_ERROR",
          details: "Offset must be non-negative",
        },
        { status: 400 }
      );
    }

    // Get user from Supabase session
    const supabase = await createClient();
    if (!supabase) {
      return NextResponse.json(
        {
          error: "Service unavailable",
          code: "SERVICE_UNAVAILABLE",
          details: "Supabase client is not available",
        },
        { status: 503 }
      );
    }

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        {
          error: "Unauthorized",
          code: "UNAUTHORIZED",
          details: "Please log in to view maintenance logs",
        },
        { status: 401 }
      );
    }

    // Call backend API with user ID in header
    const backendUrl = new URL(
      `/api/v1/appliances/schedules/${scheduleId}/logs`,
      BACKEND_URL
    );
    backendUrl.searchParams.set("limit", limit.toString());
    backendUrl.searchParams.set("offset", offset.toString());

    const response = await fetch(backendUrl.toString(), {
      method: "GET",
      headers: {
        Accept: "application/json",
        "X-User-Id": user.id,
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return NextResponse.json(
        {
          error:
            errorData.detail?.error || "Failed to get maintenance logs",
          code: errorData.detail?.code || "BACKEND_ERROR",
          details: errorData.detail?.details || response.statusText,
        },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error("Maintenance logs retrieval error:", error);
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
