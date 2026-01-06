import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from 'next/server';

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:8000';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ sharedApplianceId: string }> }
) {
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

    const { sharedApplianceId } = await params;
    const body = await request.json();

    // Call backend API with user ID in header
    const response = await fetch(
      `${BACKEND_URL}/api/v1/qa/${sharedApplianceId}/ask-stream`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-User-ID': user.id,
        },
        body: JSON.stringify(body),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      let error;
      try {
        error = JSON.parse(errorText);
      } catch {
        error = { error: 'Failed to connect to backend', code: 'BACKEND_ERROR' };
      }
      return NextResponse.json(error, { status: response.status });
    }

    // Proxy the SSE stream from backend to client
    const readable = response.body;
    if (!readable) {
      return NextResponse.json(
        { error: 'No response body', code: 'NO_RESPONSE_BODY' },
        { status: 500 }
      );
    }

    return new Response(readable, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
        'X-Accel-Buffering': 'no',
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: 'Internal server error',
        code: 'INTERNAL_ERROR',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
