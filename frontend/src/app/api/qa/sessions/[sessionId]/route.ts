import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:8000';

/**
 * GET /api/qa/sessions/[sessionId]
 * Get a specific QA session with its messages
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    // Get authenticated user
    const supabase = await createClient();
    if (!supabase) {
      return NextResponse.json(
        { error: 'Service unavailable', code: 'SERVICE_UNAVAILABLE' },
        { status: 503 }
      );
    }

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized', code: 'UNAUTHORIZED' },
        { status: 401 }
      );
    }

    const { sessionId } = await params;

    // Call backend API
    const response = await fetch(
      `${BACKEND_URL}/api/v1/qa/sessions/${sessionId}`,
      {
        headers: { 'X-User-ID': user.id },
      }
    );

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json(data, { status: response.status });
    }

    return NextResponse.json(data);
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
