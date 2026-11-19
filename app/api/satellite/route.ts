import { NextRequest, NextResponse } from "next/server";
const EARTH_SEARCH = process.env.BHOOMISETU_EARTH_SEARCH_URL || "https://earth-search.aws.element84.com/v1/search";

const STATE_BBOX: Record<string, [number, number, number, number]> = {
  KARNATAKA: [74.0, 11.5, 78.6, 18.5],
  MAHARASHTRA: [72.6, 15.5, 80.9, 22.1],
  TELANGANA: [77.2, 15.8, 81.1, 19.9],
  "TAMIL NADU": [76.2, 8.0, 80.4, 13.6],
  KERALA: [74.8, 8.2, 77.4, 12.8],
  "ANDHRA PRADESH": [76.7, 12.6, 84.8, 19.1],
};

export async function GET(request: NextRequest) {
  try {
    const params = request.nextUrl.searchParams;
    const state = params.get("state")?.toUpperCase() || "KARNATAKA";
    const fromYear = Number(params.get("from")) || new Date().getUTCFullYear() - 5;
    const toYear = Number(params.get("to")) || new Date().getUTCFullYear();
    const limit = Math.min(50, Math.max(1, Number(params.get("limit")) || 24));

    const lat = Number(params.get("lat"));
    const lng = Number(params.get("lng"));
    const geometryParam = params.get("geometry");
    let geometry: any = null;

    if (geometryParam) {
      try {
        geometry = JSON.parse(geometryParam);
      } catch {
        return NextResponse.json({ error: "Invalid geometry JSON." }, { status: 400 });
      }
    }

    const start = new Date(Date.UTC(fromYear, 0, 1));
    const end = new Date(Date.UTC(toYear, 11, 31, 23, 59, 59));

    const body: Record<string, unknown> = {
      collections: ["sentinel-2-l2a"],
      datetime: `${start.toISOString()}/${end.toISOString()}`,
      limit,
      query: { "eo:cloud_cover": { lt: 30 } },
      sortby: [{ field: "properties.datetime", direction: "desc" }],
    };

    if (geometry) {
      body.intersects = geometry;
    } else if (Number.isFinite(lat) && Number.isFinite(lng)) {
      body.bbox = [lng - 0.02, lat - 0.02, lng + 0.02, lat + 0.02];
    } else {
      body.bbox = STATE_BBOX[state] || [68, 6, 98, 36];
    }

    const response = await fetch(EARTH_SEARCH, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/geo+json" },
      body: JSON.stringify(body),
      cache: "no-store",
    });

    const text = await response.text();
    if (!response.ok) {
      return NextResponse.json({ error: "Earth Search rejected the request.", status: response.status, details: text }, { status: 502 });
    }

    const data = JSON.parse(text);
    const scenes = Array.isArray(data.features)
      ? data.features.map((item: any) => ({
          id: item.id,
          date: item.properties?.datetime || null,
          cloudCover: Number(item.properties?.["eo:cloud_cover"] ?? 0),
          platform: item.properties?.platform || "Sentinel-2",
          thumbnail: item.assets?.thumbnail?.href || null,
          visual: item.assets?.visual?.href || null,
          red: item.assets?.red?.href || null,
          green: item.assets?.green?.href || null,
          blue: item.assets?.blue?.href || null,
          nir: item.assets?.nir?.href || null,
          geometry: item.geometry || null,
        }))
      : [];

    return NextResponse.json({
      success: true,
      source: "Element84 Earth Search",
      collection: "sentinel-2-l2a",
      state: geometry || Number.isFinite(lat) ? null : state,
      count: scenes.length,
      scenes,
      free: true,
      paymentRequired: false,
    });
  } catch (error) {
    console.error("Satellite API error:", error);
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : "Unable to contact Earth Search." }, { status: 500 });
  }
}
