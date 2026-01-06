import { NextRequest } from 'next/server';

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:8000';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ sharedApplianceId: string }> }
) {
  const { sharedApplianceId } = await params;
  const body = await request.json();

  const response = await fetch(
    `${BACKEND_URL}/api/v1/qa/${sharedApplianceId}/ask-stream`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    }
  );

  if (!response.ok) {
    return new Response(
      JSON.stringify({ error: 'Failed to connect to backend' }),
      { status: response.status }
    );
  }

  // Proxy the SSE stream from backend to client
  const readable = response.body;
  if (!readable) {
    return new Response(JSON.stringify({ error: 'No response body' }), {
      status: 500,
    });
  }

  return new Response(readable, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
