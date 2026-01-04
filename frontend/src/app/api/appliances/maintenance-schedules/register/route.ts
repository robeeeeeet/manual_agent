import { NextRequest, NextResponse } from "next/server";

const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:8000";

interface RegisterRequest {
  user_appliance_id: string;
  selected_item_ids: string[];
}

/**
 * POST /api/appliances/maintenance-schedules/register
 *
 * Register maintenance schedules from selected shared maintenance items
 */
export async function POST(request: NextRequest) {
  try {
    const body: RegisterRequest = await request.json();

    // Validate request
    if (!body.user_appliance_id) {
      return NextResponse.json(
        {
          error: "Missing user_appliance_id",
          code: "VALIDATION_ERROR",
          details: "user_appliance_id is required",
        },
        { status: 400 }
      );
    }

    if (!body.selected_item_ids || body.selected_item_ids.length === 0) {
      return NextResponse.json(
        {
          error: "No items selected",
          code: "VALIDATION_ERROR",
          details: "At least one item must be selected",
        },
        { status: 400 }
      );
    }

    const response = await fetch(
      `${BACKEND_URL}/api/v1/manuals/maintenance-schedules/register`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(body),
      }
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return NextResponse.json(
        {
          error:
            errorData.detail?.error || "Failed to register maintenance schedules",
          code: errorData.detail?.code || "BACKEND_ERROR",
          details: errorData.detail?.details || response.statusText,
        },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error("Maintenance schedules register error:", error);
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
