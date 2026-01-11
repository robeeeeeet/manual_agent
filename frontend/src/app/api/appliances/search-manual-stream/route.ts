import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:8000";

interface ExistingPdfCheckResponse {
  found: boolean;
  storage_path?: string | null;
  storage_url?: string | null;
  source_url?: string | null;
  message?: string | null;
}

/**
 * Check for existing stored PDF
 */
async function checkExistingPdf(
  manufacturer: string,
  model_number: string
): Promise<ExistingPdfCheckResponse | null> {
  try {
    const response = await fetch(`${BACKEND_URL}/api/v1/manuals/check-existing`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ manufacturer, model_number }),
    });

    if (!response.ok) {
      return null;
    }

    return await response.json();
  } catch (error) {
    console.error("Error checking existing PDF:", error);
    return null;
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      manufacturer,
      model_number,
      skip_existing_check,
      excluded_urls,
      skip_domain_filter,
      cached_candidates,
    } = body;

    if (!manufacturer || !model_number) {
      return new Response(
        JSON.stringify({ error: "manufacturer and model_number are required" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // Get authenticated user
    const supabase = await createClient();
    if (!supabase) {
      return new Response(
        JSON.stringify({ error: "Service unavailable", code: "SERVICE_UNAVAILABLE" }),
        { status: 503, headers: { "Content-Type": "application/json" } }
      );
    }

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized", code: "UNAUTHORIZED" }),
        { status: 401, headers: { "Content-Type": "application/json" } }
      );
    }

    // Check tier limit before search
    const tierCheckResponse = await fetch(`${BACKEND_URL}/api/v1/tiers/check-manual-search`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-User-ID": user.id,
      },
    });

    if (!tierCheckResponse.ok) {
      const errorData = await tierCheckResponse.json();
      return new Response(JSON.stringify(errorData), {
        status: tierCheckResponse.status,
        headers: { "Content-Type": "application/json" },
      });
    }

    // First, check for existing stored PDF (unless explicitly skipped)
    if (!skip_existing_check) {
      const existingPdf = await checkExistingPdf(manufacturer, model_number);

      if (existingPdf?.found && existingPdf.storage_url) {
        // Return existing PDF as SSE stream with result event
        const encoder = new TextEncoder();
        const stream = new ReadableStream({
          start(controller) {
            // Send progress event
            const progressData = JSON.stringify({
              type: "progress",
              step: "existing_pdf_found",
              message: "保存済みの説明書PDFが見つかりました",
            });
            controller.enqueue(encoder.encode(`data: ${progressData}\n\n`));

            // Send result event with existing PDF
            const resultData = JSON.stringify({
              type: "result",
              pdf_url: existingPdf.storage_url,
              source_url: existingPdf.source_url,
              from_storage: true,
              storage_path: existingPdf.storage_path,
              message: "保存済みの説明書PDFを使用します",
            });
            controller.enqueue(encoder.encode(`data: ${resultData}\n\n`));

            controller.close();
          },
        });

        return new Response(stream, {
          headers: {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache, no-transform",
            Connection: "keep-alive",
            "X-Accel-Buffering": "no",
          },
        });
      }
    }

    // No existing PDF found, proceed with Google search
    const response = await fetch(`${BACKEND_URL}/api/v1/manuals/search-stream`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        manufacturer,
        model_number,
        excluded_urls: excluded_urls || null,
        skip_domain_filter: skip_domain_filter || false,
        cached_candidates: cached_candidates || null,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return new Response(
        JSON.stringify({ error: "Backend request failed", details: errorData }),
        { status: response.status, headers: { "Content-Type": "application/json" } }
      );
    }

    // Explicitly create a new ReadableStream to ensure proper streaming
    // This prevents Node.js fetch buffering issues
    const reader = response.body?.getReader();
    if (!reader) {
      return new Response(
        JSON.stringify({ error: "Failed to read backend response" }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    const stream = new ReadableStream({
      async start(controller) {
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) {
              controller.close();
              break;
            }
            // Immediately enqueue each chunk as it arrives
            controller.enqueue(value);
          }
        } catch (error) {
          controller.error(error);
        }
      },
      cancel() {
        reader.cancel();
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no", // Disable nginx buffering
      },
    });
  } catch (error) {
    console.error("Error in search-manual-stream API:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
