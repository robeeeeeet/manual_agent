import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:8000";

/**
 * POST /api/push/subscribe
 * Register push notification subscription
 */
export async function POST(request: Request) {
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

    // Parse request body
    const body = await request.json();
    const { endpoint, keys } = body;

    if (!endpoint || !keys || !keys.p256dh || !keys.auth) {
      return NextResponse.json(
        {
          error: "Missing required fields: endpoint, keys.p256dh, keys.auth",
          code: "VALIDATION_ERROR",
        },
        { status: 400 }
      );
    }

    // Transform browser format to backend format
    // Browser sends: { endpoint, keys: { p256dh, auth } }
    // Backend expects: { endpoint, p256dh_key, auth_key }
    const backendPayload = {
      endpoint,
      p256dh_key: keys.p256dh,
      auth_key: keys.auth,
    };

    // Call backend API
    const response = await fetch(`${BACKEND_URL}/api/v1/push/subscribe`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-User-ID": user.id,
      },
      body: JSON.stringify(backendPayload),
    });

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json(data, { status: response.status });
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error("Failed to subscribe to push notifications:", error);
    return NextResponse.json(
      {
        error: "Failed to subscribe to push notifications",
        code: "INTERNAL_ERROR",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
