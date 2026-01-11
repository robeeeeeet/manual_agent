/**
 * BFF API Route: Leave Group
 * POST /api/groups/[id]/leave - Leave a group
 */
import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:8000";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/groups/[id]/leave - Leave a group
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;

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

    // Read request body and convert keep_appliances to take_appliances query param
    const body = await request.json().catch(() => ({}));
    const takeAppliances = body.keep_appliances === true;

    // Backend expects take_appliances as query parameter, not body
    const url = new URL(`${BACKEND_URL}/api/v1/groups/${id}/leave`);
    url.searchParams.set("take_appliances", String(takeAppliances));

    const response = await fetch(url.toString(), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-User-ID": user.id,
      },
    });

    if (!response.ok) {
      const data = await response.json();
      return NextResponse.json(data, { status: response.status });
    }

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error("Leave group error:", error);
    return NextResponse.json(
      {
        error: "Failed to leave group",
        code: "INTERNAL_ERROR",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
