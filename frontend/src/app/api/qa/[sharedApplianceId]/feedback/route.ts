import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:8000";

/**
 * POST /api/qa/[sharedApplianceId]/feedback
 *
 * Submit feedback (helpful/not helpful) for a QA answer.
 * Negative ratings accumulate; 3 or more trigger auto-deletion.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ sharedApplianceId: string }> }
) {
  try {
    const { sharedApplianceId } = await params;
    const body = await request.json();

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
          details: "Please log in to submit feedback",
        },
        { status: 401 }
      );
    }

    // Call backend API with user ID in header
    const response = await fetch(
      `${BACKEND_URL}/api/v1/qa/${sharedApplianceId}/feedback`,
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
      const error = await response
        .json()
        .catch(() => ({ detail: "Unknown error" }));
      return NextResponse.json(error, { status: response.status });
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error("Error submitting feedback:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
