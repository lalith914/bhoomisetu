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
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: land, error: landError } = await sb
    .from("lands")
    .select(
      "id,title,location,area,land_type,latitude,longitude,verified,verification_level,asking_price,created_at"
    )
    .eq("id", id)
    .maybeSingle();

  if (landError) {
    return NextResponse.json(
      { error: landError.message },
      { status: 502 }
    );
  }

  if (!land) {
    return NextResponse.json(
      { error: "Land record not found." },
      { status: 404 }
    );
  }

  const { data: boundary, error: boundaryError } = await sb.rpc(
    "get_land_boundary",
    { p_land_id: id }
  );

  return NextResponse.json({
    land,
    access: true,
    free: true,
    paymentRequired: false,
    geometry: boundaryError ? null : boundary || null,
  });
}
