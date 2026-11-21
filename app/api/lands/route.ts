
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function GET(request: NextRequest) {
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

  const sb = createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  const params = request.nextUrl.searchParams;
  const state = params.get("state");
  const type = params.get("type");
  const listing = params.get("listing");
  const query = params.get("q");

  // Only verified properties are visible in the public Explore feed.
  let requestQuery = sb
    .from("lands")
    .select(
      "id,title,location,area,land_type,listing_type,lease_duration,asking_price,latitude,longitude,verified,verification_level,created_at"
    )
    .eq("verified", true)
    .order("created_at", { ascending: false })
    .limit(100);

  if (state) {
    requestQuery = requestQuery.ilike("location", `%${state}%`);
  }

  if (type && type !== "ALL") {
    requestQuery = requestQuery.eq("land_type", type);
  }

  if (listing && listing !== "ALL") {
    requestQuery = requestQuery.eq("listing_type", listing);
  }

  if (query) {
    requestQuery = requestQuery.or(
      `title.ilike.%${query}%,location.ilike.%${query}%`
    );
  }

  const { data, error } = await requestQuery;

  if (error) {
    return NextResponse.json(
      { error: error.message },
      { status: 502 }
    );
  }

  const lands = data || [];
  const ids = lands.map((land) => land.id);

  let photos: {
    land_id: string;
    public_url: string;
    sort_order: number;
    is_cover: boolean;
  }[] = [];

  if (ids.length > 0) {
    const photoResult = await sb
      .from("land_photos")
      .select("land_id,public_url,sort_order,is_cover")
      .in("land_id", ids)
      .order("sort_order", { ascending: true });

    if (!photoResult.error) {
      photos = photoResult.data || [];
    }
  }

  const coverByLand = new Map<string, string>();

  for (const photo of photos) {
    if (
      !coverByLand.has(photo.land_id) ||
      photo.is_cover
    ) {
      coverByLand.set(photo.land_id, photo.public_url);
    }
  }

  const listings = lands.map((land) => ({
    ...land,
    listing_type: land.listing_type || "SELL",
    lease_duration: land.lease_duration || null,
    cover_photo_url: coverByLand.get(land.id) || null,
  }));

  return NextResponse.json({
    lands: listings,
    count: listings.length,
  });
}
