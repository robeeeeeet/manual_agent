import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:8000";

/**
 * GET /api/user/settings
 * ユーザー設定取得
 */
export async function GET() {
  try {
    // 認証チェック
    const supabase = await createClient();
    if (!supabase) {
      return NextResponse.json(
        { error: "Service unavailable" },
        { status: 503 }
      );
    }

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // バックエンドAPIからプロファイル取得
    const response = await fetch(`${BACKEND_URL}/api/v1/users/me`, {
      method: "GET",
      headers: {
        "X-User-ID": user.id,
        "Content-Type": "application/json",
      },
    });

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json(data, { status: response.status });
    }

    // バックエンドは直接プロファイルオブジェクトを返す
    return NextResponse.json({
      display_name: data?.display_name || "",
      notify_time: data?.notify_time?.substring(0, 5) || "09:00", // "HH:MM:SS" -> "HH:MM"
      timezone: data?.timezone || "Asia/Tokyo",
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: "Internal server error",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/user/settings
 * ユーザー設定更新
 */
export async function PATCH(request: NextRequest) {
  try {
    // 認証チェック
    const supabase = await createClient();
    if (!supabase) {
      return NextResponse.json(
        { error: "Service unavailable" },
        { status: 503 }
      );
    }

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // リクエストボディ取得
    const body = await request.json();

    // バックエンドAPIにリクエスト転送
    const response = await fetch(`${BACKEND_URL}/api/v1/users/settings`, {
      method: "PATCH",
      headers: {
        "X-User-ID": user.id,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json(data, { status: response.status });
    }

    // バックエンドは { settings: {...} } を返すので、整形して返す
    const settings = data.settings;
    return NextResponse.json({
      display_name: settings?.display_name || "",
      notify_time: settings?.notify_time?.substring(0, 5) || "09:00", // "HH:MM:SS" -> "HH:MM"
      timezone: settings?.timezone || "Asia/Tokyo",
      updated_at: settings?.updated_at,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: "Internal server error",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
