
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!url || !key) {
    return NextResponse.json(
      { error: "Supabase is not configured." },
      { status: 503 }
    );
  }

  const { id } = await params;

  if (!id) {
    return NextResponse.json(
      { error: "Land ID is required." },
      { status: 400 }
    );
  }

  const sb = createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  // Fetch the property record.
  const { data: land, error: landError } = await sb
    .from("lands")
    .select(
      "id,title,location,area,land_type,listing_type,lease_duration,latitude,longitude,verified,verification_level,asking_price,created_at"
    )
    .eq("id", id)
    .maybeSingle();

  if (landError) {
    console.error("Land lookup failed:", landError.message);

    return NextResponse.json(
      { error: "Unable to retrieve land details." },
      { status: 502 }
    );
  }

  if (!land) {
    return NextResponse.json(
      { error: "Land record not found." },
      { status: 404 }
    );
  }

  // Do not expose pending or rejected properties publicly.
  if (land.verified !== true) {
    return NextResponse.json(
      { error: "This property is not publicly available yet." },
      { status: 404 }
    );
  }

  // Retrieve photos only after verification is confirmed.
  const { data: photos, error: photoError } = await sb
    .from("land_photos")
    .select("public_url,sort_order,is_cover")
    .eq("land_id", id)
    .order("sort_order", { ascending: true });

  if (photoError) {
    console.error("Property photo lookup failed:", photoError.message);

    return NextResponse.json(
      { error: "Unable to retrieve property photos." },
      { status: 502 }
    );
  }

  // Retrieve the saved property boundary.
  const { data: boundary, error: boundaryError } =
    await sb.rpc("get_land_boundary", {
      p_land_id: id,
    });

  if (boundaryError) {
    console.warn(
      "Property boundary unavailable:",
      boundaryError.message
    );
  }

  return NextResponse.json({
    land: {
      ...land,
      listing_type: land.listing_type || "SELL",
      lease_duration: land.lease_duration || null,
    },
    photos: photos || [],
    access: true,
    free: true,
    paymentRequired: false,
    geometry: boundaryError ? null : boundary || null,
  });
}
