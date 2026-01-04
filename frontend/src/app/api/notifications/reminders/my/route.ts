/**
 * BFF API Route: POST /api/notifications/reminders/my
 * Trigger maintenance reminder notifications for the current user
 */

import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:8000";

interface ReminderResponse {
  users_processed: number;
  notifications_sent: number;
  notifications_failed: number;
  errors: string[];
}

export async function POST(_request: NextRequest) {
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

    // Call backend API
    const response = await fetch(`${BACKEND_URL}/api/v1/notifications/reminders/my`, {
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
          error: errorData.detail?.error || "Failed to send reminders",
          code: errorData.detail?.code || "REMINDER_ERROR",
        },
        { status: response.status }
      );
    }

    const data: ReminderResponse = await response.json();

    return NextResponse.json(data);
  } catch (error) {
    console.error("Error sending my reminders:", error);
    return NextResponse.json(
      { error: "Internal server error", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}
