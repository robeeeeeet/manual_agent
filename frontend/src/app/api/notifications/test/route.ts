/**
 * BFF API Route: POST /api/notifications/test
 * Send a test notification to the authenticated user
 * Only allowed for specific users configured via environment variable
 */

import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:8000";

// Comma-separated list of allowed email addresses for test notifications
const ALLOWED_TEST_USERS = process.env.ALLOWED_TEST_NOTIFICATION_USERS || "";

interface TestNotificationResponse {
  success: number;
  failed: number;
  expired: number;
  errors: string[];
}

function isAllowedTestUser(email: string | undefined): boolean {
  if (!email) return false;
  if (!ALLOWED_TEST_USERS) return false;
  const allowedEmails = ALLOWED_TEST_USERS.split(",").map((e) => e.trim().toLowerCase());
  return allowedEmails.includes(email.toLowerCase());
}

export async function POST() {
  try {
    // Get authenticated user
    const supabase = await createClient();
    if (!supabase) {
      return NextResponse.json(
        { error: "Failed to create Supabase client", code: "SUPABASE_ERROR" },
        { status: 500 }
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

    // Check if user is allowed to send test notifications
    if (!isAllowedTestUser(user.email)) {
      return NextResponse.json(
        { error: "この機能はテストユーザーのみ利用可能です", code: "FORBIDDEN" },
        { status: 403 }
      );
    }

    // Call backend API
    const response = await fetch(`${BACKEND_URL}/api/v1/notifications/test`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-User-ID": user.id,
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return NextResponse.json(
        {
          error: errorData.detail?.error || "Failed to send test notification",
          code: errorData.detail?.code || "TEST_NOTIFICATION_ERROR",
        },
        { status: response.status }
      );
    }

    const data: TestNotificationResponse = await response.json();

    return NextResponse.json(data);
  } catch (error) {
    console.error("Error sending test notification:", error);
    return NextResponse.json(
      { error: "Internal server error", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}
