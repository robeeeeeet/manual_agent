import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:8000";

interface CompleteRequest {
  notes?: string;
  done_at?: string; // ISO 8601 datetime string
}

/**
 * POST /api/appliances/maintenance-schedules/[id]/complete
 *
 * Mark a maintenance schedule as complete
 * Creates a maintenance log entry and updates next_due_at
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: scheduleId } = await params;
    const body: CompleteRequest = await request.json();

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
          details: "Please log in to complete maintenance tasks",
        },
        { status: 401 }
      );
    }

    // Call backend API with user ID in header
    const response = await fetch(
      `${BACKEND_URL}/api/v1/appliances/schedules/${scheduleId}/complete`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          "X-User-Id": user.id,
        },
        body: JSON.stringify(body),
      }
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return NextResponse.json(
        {
          error:
            errorData.detail?.error || "Failed to complete maintenance task",
          code: errorData.detail?.code || "BACKEND_ERROR",
          details: errorData.detail?.details || response.statusText,
        },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error("Maintenance completion error:", error);
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
