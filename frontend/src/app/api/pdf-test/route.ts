import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

// テスト用：特定ユーザーのみアクセス可
const ALLOWED_EMAILS = ["notsuka0217@gmail.com"];

// テスト用PDFパス（日立 洗濯機）
const TEST_PDF_PATH = "mfr_fb358d01/BD-SX120JL/manual.pdf";

/**
 * GET /api/pdf-test
 * テスト用：署名付きPDF URLを取得
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();

    if (!supabase) {
      return NextResponse.json({ error: "Failed to create Supabase client" }, { status: 500 });
    }

    // 認証チェック
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 特定ユーザーのみアクセス可
    if (!ALLOWED_EMAILS.includes(user.email || "")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // 署名付きURLを生成（1時間有効）
    const { data: signedUrlData, error: signedUrlError } = await supabase.storage
      .from("manuals")
      .createSignedUrl(TEST_PDF_PATH, 3600);

    if (signedUrlError || !signedUrlData?.signedUrl) {
      console.error("Failed to create signed URL:", signedUrlError);
      return NextResponse.json(
        { error: "Failed to create signed URL" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      signed_url: signedUrlData.signedUrl,
      pdf_path: TEST_PDF_PATH,
      description: "日立 洗濯機 BD-SX120JL の取扱説明書",
    });
  } catch (error) {
    console.error("Error in pdf-test API:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
