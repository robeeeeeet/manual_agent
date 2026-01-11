import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:8000";

export interface ExistingPdfCheckRequest {
  manufacturer: string;
  model_number: string;
}

export interface DuplicateAppliance {
  id: string;
  name: string;
  owner_type: "group" | "personal";
  owner_name: string;
}

export interface DuplicateInGroup {
  exists: boolean;
  appliances: DuplicateAppliance[];
}

export interface ExistingPdfCheckResponse {
  found: boolean;
  shared_appliance_id?: string | null;
  storage_path?: string | null;
  storage_url?: string | null;
  source_url?: string | null;
  message?: string | null;
  already_owned?: boolean;
  existing_appliance_id?: string | null;
  existing_appliance_name?: string | null;
  duplicate_in_group?: DuplicateInGroup | null;
}

export async function POST(request: NextRequest) {
  try {
    const body: ExistingPdfCheckRequest = await request.json();

    const { manufacturer, model_number } = body;

    if (!manufacturer || !model_number) {
      return NextResponse.json(
        { error: "manufacturer and model_number are required" },
        { status: 400 }
      );
    }

    // Get user ID from Supabase auth
    const supabase = await createClient();
    if (!supabase) {
      return NextResponse.json(
        { error: "Failed to create Supabase client" },
        { status: 500 }
      );
    }
    const { data: { user } } = await supabase.auth.getUser();
    const userId = user?.id || null;

    // Forward the request to the Python backend
    const response = await fetch(`${BACKEND_URL}/api/v1/manuals/check-existing`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        manufacturer,
        model_number,
        user_id: userId,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return NextResponse.json(
        { error: "Backend request failed", details: errorData },
        { status: response.status }
      );
    }

    const data: ExistingPdfCheckResponse = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error("Error in check-existing API:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
