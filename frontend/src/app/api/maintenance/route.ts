import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:8000";

/**
 * GET /api/maintenance
 * Get all maintenance schedules for the authenticated user
 *
 * Query params:
 * - status: comma-separated status filter (overdue,upcoming,scheduled,manual)
 * - importance: comma-separated importance filter (high,medium,low)
 * - appliance_id: filter by specific appliance
 */
export async function GET(request: NextRequest) {
  try {
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

    // Forward query params to backend
    const searchParams = request.nextUrl.searchParams;
    const backendUrl = new URL(`${BACKEND_URL}/api/v1/maintenance`);

    // Copy relevant query params
    const status = searchParams.get("status");
    const importance = searchParams.get("importance");
    const applianceId = searchParams.get("appliance_id");

    if (status) backendUrl.searchParams.set("status", status);
    if (importance) backendUrl.searchParams.set("importance", importance);
    if (applianceId) backendUrl.searchParams.set("appliance_id", applianceId);

    // Call backend API with user ID in header
    const response = await fetch(backendUrl.toString(), {
      method: "GET",
      headers: {
        "X-User-ID": user.id,
      },
    });

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json(data, { status: response.status });
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error("Failed to fetch maintenance list:", error);
    return NextResponse.json(
      {
        error: "Failed to fetch maintenance list",
        code: "INTERNAL_ERROR",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
