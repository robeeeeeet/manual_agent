import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:8000";

/**
 * GET /api/groups/verify-invite/[code]
 * 招待コードの有効性を検証
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  try {
    const { code } = await params;

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

    // バックエンドAPIに検証リクエスト
    const response = await fetch(
      `${BACKEND_URL}/api/v1/groups/verify-invite/${encodeURIComponent(code)}`,
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      }
    );

    const data = await response.json();

    if (!response.ok) {
      // バックエンドからのエラーをユーザーフレンドリーなメッセージに変換
      return NextResponse.json(
        {
          valid: false,
          error: "この招待コードは無効です。コードを確認してください。",
        },
        { status: 404 }
      );
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error("Error verifying invite code:", error);
    return NextResponse.json(
      {
        valid: false,
        error: "招待コードの検証に失敗しました",
      },
      { status: 500 }
    );
  }
}
