/**
 * API Route: GHL Connections
 * Manages a user's connected GHL sub-accounts via Private Integration Tokens.
 *
 * POST { locationLabel, locationId, pitToken } — validates the PIT by calling
 *   GET https://services.leadconnectorhq.com/locations/{locationId} with it.
 *   On 200, upserts a ghl_connections row (auth_type='pit', refresh_token=null,
 *   expires_at=null).
 *
 * DELETE { id } — removes a connection.
 *
 * GET — lists the user's connections (id, label, location_id, created_at).
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/app/lib/supabase/server";
import { createAdminClient } from "@/app/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const GHL_LOCATIONS_URL = "https://services.leadconnectorhq.com/locations";
const GHL_API_VERSION = "2021-07-28";

async function getUserId(): Promise<string | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user?.id ?? null;
}

interface ValidationResult {
  ok: boolean;
  locationName?: string;
  error?: string;
}

async function validatePit(
  pitToken: string,
  locationId: string
): Promise<ValidationResult> {
  const res = await fetch(`${GHL_LOCATIONS_URL}/${locationId}`, {
    headers: {
      Authorization: `Bearer ${pitToken}`,
      Version: GHL_API_VERSION,
      Accept: "application/json",
    },
  });

  if (res.ok) {
    const data = await res.json().catch(() => ({}));
    const loc = data.location || data;
    return { ok: true, locationName: loc?.name || loc?.businessName };
  }

  if (res.status === 401) {
    return {
      ok: false,
      error:
        "Token rejected by GHL. Check that you copied the full token and that locations.readonly scope is enabled.",
    };
  }
  if (res.status === 403) {
    return {
      ok: false,
      error: "Token does not have access to this location. Check the location ID.",
    };
  }
  if (res.status === 404) {
    return {
      ok: false,
      error: "Location not found. Check the location ID.",
    };
  }
  const body = await res.text().catch(() => "");
  return {
    ok: false,
    error: `GHL returned ${res.status}: ${body.slice(0, 200) || "unknown error"}`,
  };
}

/**
 * Extract a GHL location ID from any input the user gives us. Accepts:
 *   - A bare 20-ish-char ID like "J6mQyg3y1eRegphsvYPU"
 *   - Any GHL URL containing /location/<id>/ (the URL of any page in their sub-account works)
 * Returns null if nothing recognisable.
 */
function extractLocationId(input: string): string | null {
  const trimmed = input.trim();
  // URL form
  const m = trimmed.match(/\/location\/([A-Za-z0-9]+)(?:[/?#]|$)/);
  if (m) return m[1];
  // Bare ID form (GHL location IDs are URL-safe alphanumerics, 18-24 chars)
  if (/^[A-Za-z0-9]{12,32}$/.test(trimmed)) return trimmed;
  return null;
}

export async function POST(request: NextRequest) {
  try {
    const userId = await getUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { locationLabel, locationInput, pitToken } = body;

    // locationLabel is optional — if the caller doesn't supply one (e.g. the
    // just-in-time connect modal), we use the resolved business name from GHL.
    if (!locationInput || !pitToken) {
      return NextResponse.json(
        { error: "GHL URL/location ID and token are both required." },
        { status: 400 }
      );
    }

    const locationId = extractLocationId(locationInput);
    if (!locationId) {
      return NextResponse.json(
        {
          error:
            "Couldn't read a location ID from that input. Paste the URL of any page in your GHL sub-account (it contains /location/<id>/) or the bare location ID.",
        },
        { status: 400 }
      );
    }

    // Validate token against the location before persisting.
    const v = await validatePit(pitToken, locationId);
    if (!v.ok) {
      return NextResponse.json({ error: v.error }, { status: 400 });
    }

    // Prefer the human label the user typed; otherwise use the business name GHL
    // resolved (so the connection shows "Acme HVAC", not a raw location ID).
    const resolvedLabel = (locationLabel?.trim() || v.locationName || locationId) as string;

    const admin = createAdminClient();
    const { data, error } = await admin
      .from("ghl_connections")
      .upsert(
        {
          user_id: userId,
          location_id: locationId,
          location_label: resolvedLabel,
          auth_type: "pit",
          access_token: pitToken,
          refresh_token: null,
          expires_at: null,
          scopes: "locations.readonly emails/builder.write",
        },
        { onConflict: "user_id,location_id" }
      )
      .select("id, location_id, location_label, created_at")
      .single();

    if (error) {
      console.error("ghl_connections upsert failed:", error);
      return NextResponse.json(
        { error: "Saved-token validation succeeded but database write failed. Try again." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      connection: data,
      locationName: v.locationName ?? null,
    });
  } catch (err: any) {
    console.error("GHL settings POST error:", err);
    return NextResponse.json(
      { error: err.message || "Failed to save GHL connection" },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    const userId = await getUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const admin = createAdminClient();
    const { data, error } = await admin
      .from("ghl_connections")
      .select("id, location_id, location_label, auth_type, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("ghl_connections list failed:", error);
      return NextResponse.json(
        { error: "Failed to list GHL connections" },
        { status: 500 }
      );
    }

    return NextResponse.json({ connections: data ?? [] });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to list GHL connections" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const userId = await getUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const id = request.nextUrl.searchParams.get("id");
    if (!id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }

    const admin = createAdminClient();
    const { error } = await admin
      .from("ghl_connections")
      .delete()
      .eq("id", id)
      .eq("user_id", userId); // belt + suspenders; RLS already enforces this

    if (error) {
      console.error("ghl_connections delete failed:", error);
      return NextResponse.json(
        { error: "Failed to delete GHL connection" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to delete" },
      { status: 500 }
    );
  }
}
