import { NextResponse } from "next/server";

/**
 * GET /api/push/vapid-public-key
 * Get VAPID public key for push notifications
 */
export async function GET() {
  try {
    const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

    if (!publicKey) {
      return NextResponse.json(
        {
          error: "VAPID public key not configured",
          code: "CONFIG_ERROR",
        },
        { status: 500 }
      );
    }

    return NextResponse.json({ publicKey });
  } catch (error) {
    console.error("Failed to get VAPID public key:", error);
    return NextResponse.json(
      {
        error: "Failed to get VAPID public key",
        code: "INTERNAL_ERROR",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
