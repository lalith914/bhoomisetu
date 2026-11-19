import { NextRequest, NextResponse } from "next/server";
const EARTH_SEARCH = process.env.BHOOMISETU_EARTH_SEARCH_URL || "https://earth-search.aws.element84.com/v1/search";
const SOILGRIDS = process.env.BHOOMISETU_SOIL_API_URL || "https://rest.isric.org/soilgrids/v2.0/properties/query";
const ELEVATION = process.env.BHOOMISETU_ELEVATION_URL || "https://api.open-meteo.com/v1/elevation";

function finiteNumber(value: unknown) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function centroidFromGeometry(geometry: any) {
  const coords = geometry?.coordinates;
  if (!coords) return null;
  const ring = geometry.type === "Polygon" ? coords[0] : geometry.type === "MultiPolygon" ? coords[0]?.[0] : null;
  if (!Array.isArray(ring) || !ring.length) return null;
  let lng = 0;
  let lat = 0;
  for (const point of ring) {
    lng += Number(point[0]);
    lat += Number(point[1]);
  }
  return { lat: lat / ring.length, lng: lng / ring.length };
}

function bboxFromGeometry(geometry: any) {
  const points: number[][] = [];
  const walk = (value: any) => {
    if (Array.isArray(value) && value.length >= 2 && typeof value[0] === "number" && typeof value[1] === "number") {
      points.push(value);
      return;
    }
    if (Array.isArray(value)) value.forEach(walk);
  };
  walk(geometry?.coordinates);
  if (!points.length) return null;
  const lngs = points.map((p) => p[0]);
  const lats = points.map((p) => p[1]);
  return [Math.min(...lngs), Math.min(...lats), Math.max(...lngs), Math.max(...lats)];
}

async function searchSatellite(geometry: any, lat: number, lng: number) {
  const bbox = bboxFromGeometry(geometry) || [lng - 0.02, lat - 0.02, lng + 0.02, lat + 0.02];
  const now = new Date();
  const start = new Date(Date.UTC(now.getUTCFullYear() - 5, 0, 1));
  const body = {
    collections: ["sentinel-2-l2a"],
    intersects: geometry || undefined,
    bbox: geometry ? undefined : bbox,
    datetime: `${start.toISOString()}/${now.toISOString()}`,
    limit: 12,
    query: { "eo:cloud_cover": { lt: 25 } },
    sortby: [{ field: "properties.datetime", direction: "desc" }],
  };

  const response = await fetch(EARTH_SEARCH, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/geo+json" },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`Earth Search returned ${response.status}`);
  const data = await response.json();
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
      }))
    : [];
  return scenes;
}

async function fetchSoil(lat: number, lng: number) {
  const params = new URLSearchParams({ lon: String(lng), lat: String(lat), value: "mean" });
  for (const property of ["clay", "sand", "silt", "phh2o", "soc", "nitrogen", "cec"]) params.append("property", property);
  for (const depth of ["0-5cm", "5-15cm", "15-30cm", "0-30cm"]) params.append("depth", depth);

  const response = await fetch(`${SOILGRIDS}?${params.toString()}`, { cache: "no-store" });
  if (!response.ok) throw new Error(`Soil provider returned ${response.status}`);
  return response.json();
}

async function fetchElevation(lat: number, lng: number) {
  const url = new URL(ELEVATION);
  url.searchParams.set("latitude", String(lat));
  url.searchParams.set("longitude", String(lng));
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) throw new Error(`Elevation provider returned ${response.status}`);
  const data = await response.json();
  return Array.isArray(data.elevation) ? data.elevation[0] : null;
}

function flattenSoil(data: any) {
  const output: Record<string, unknown> = {};
  for (const layer of data?.properties?.layers || []) {
    const name = layer.name;
    const depth = layer.depths?.find((d: any) => d.label === "0-30cm") || layer.depths?.[0];
    if (!depth) continue;
    output[name] = {
      unit: layer.unit_measure?.mapped_units || layer.unit_measure?.target_units || null,
      value: depth.values?.mean ?? null,
    };
  }
  return output;
}

async function fetchRasterEvidence(input: {
  geometry: any;
  scene: any;
  centroid: { lat: number; lng: number };
}) {
  const url = process.env.BHOOMISETU_RASTER_API_URL || "http://127.0.0.1:3000/api/raster";
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({
      geometry: input.geometry,
      centroid: input.centroid,
      scene: {
        id: input.scene?.id,
        date: input.scene?.date,
        platform: input.scene?.platform,
        red: input.scene?.red,
        green: input.scene?.green,
        blue: input.scene?.blue,
        nir: input.scene?.nir,
      },
      requestedIndices: ["NDVI", "NDWI", "NIR", "NDMI", "NDBI"],
    }),
    cache: "no-store",
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new Error(data?.error || `Raster processor returned ${response.status}`);
  return data;
}

async function askGeospatialAi(input: {
  geometry: any;
  scene: any;
  soil: any;
  elevation: number | null;
  raster: any;
  centroid: { lat: number; lng: number };
}) {
  const url = process.env.BHOOMISETU_GEO_AI_URL;
  if (!url) return null;
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({
      geometry: input.geometry,
      centroid: input.centroid,
      scene: input.scene,
      soil: input.soil,
      elevation: input.elevation,
      raster: input.raster,
      outputSchema: "BhoomiSetuLandIntelligenceV1",
    }),
    cache: "no-store",
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new Error(data?.error || `Geospatial AI processor returned ${response.status}`);
  return data?.analysis || data;
}

async function askOpenAI(input: {
  scene: any;
  soil: any;
  elevation: number | null;
  raster: any;
  centroid: { lat: number; lng: number };
}) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY is not configured.");

  const model = process.env.OPENAI_MODEL || "gpt-5";
  const content: any[] = [
    {
      type: "input_text",
      text: `You are BhoomiSetu's geospatial intelligence engine. Analyze a land parcel using ONLY the supplied evidence. Do not invent measurements. Distinguish remote-sensing inference from field/lab verification. Return STRICT JSON with keys: summary, soil, water, terrain, vegetation, agriculture, scores, risks, recommendedUses, confidence. scores must contain soil, water, terrain, vegetation, agriculture, overall as numbers 0-100 or null. soil/water/terrain/vegetation/agriculture must each be an object with status, evidence, limitations. recommendedUses must be an array of strings. confidence is 0-100. If soil provider data is missing, say unavailable rather than guessing. Overall score must be null if evidence is insufficient.

CENTROID: ${JSON.stringify(input.centroid)}
ELEVATION_M: ${input.elevation ?? "unavailable"}
SATELLITE_SCENE: ${JSON.stringify(input.scene)}
SOIL_PROVIDER_DATA: ${JSON.stringify(input.soil)}
RASTER_SPECTRAL_EVIDENCE: ${JSON.stringify(input.raster)}`,
    },
  ];
  if (input.scene?.thumbnail) {
    content.push({ type: "input_image", image_url: input.scene.thumbnail, detail: "high" });
  }

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model, input: [{ role: "user", content }] }),
    cache: "no-store",
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new Error(data?.error?.message || "OpenAI request failed.");
  const text = data?.output_text;
  if (!text) throw new Error("AI provider returned no analysis.");
  const cleaned = text.replace(/^```json\s*/i, "").replace(/```$/i, "").trim();
  return JSON.parse(cleaned);
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const reportId = String(body.reportId || "").trim();
    if (!reportId) {
      return NextResponse.json({ error: "Report ID is required." }, { status: 400 });
    }
    const geometry = body.geometry || null;
    let lat = finiteNumber(body.lat);
    let lng = finiteNumber(body.lng);
    const centroid = centroidFromGeometry(geometry);
    if (centroid) {
      lat = centroid.lat;
      lng = centroid.lng;
    }
    if (lat === null || lng === null || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
      return NextResponse.json({ error: "Valid parcel coordinates or polygon geometry are required." }, { status: 400 });
    }

    const [scenesResult, soilResult, elevationResult] = await Promise.allSettled([
      searchSatellite(geometry, lat, lng),
      fetchSoil(lat, lng),
      fetchElevation(lat, lng),
    ]);

    const scenes = scenesResult.status === "fulfilled" ? scenesResult.value : [];
    const soilRaw = soilResult.status === "fulfilled" ? soilResult.value : null;
    const elevation = elevationResult.status === "fulfilled" ? elevationResult.value : null;
    const soil = soilRaw ? flattenSoil(soilRaw) : { unavailable: soilResult.status === "rejected" ? soilResult.reason?.message : "No soil data" };
    const latestScene = scenes[0] || null;

    if (!latestScene) {
      return NextResponse.json({ error: "No usable Sentinel-2 scene was found for this parcel.", centroid: { lat, lng }, soil, elevation }, { status: 422 });
    }

    let raster: any = null;
    if (process.env.BHOOMISETU_RASTER_API_URL) {
      try {
        raster = await fetchRasterEvidence({ geometry, scene: latestScene, centroid: { lat, lng } });
      } catch (error) {
        raster = { unavailable: error instanceof Error ? error.message : "Raster processor unavailable" };
      }
    }

    let analysis: any = null;
    if (process.env.BHOOMISETU_GEO_AI_URL) {
      try {
        analysis = await askGeospatialAi({ geometry, scene: latestScene, soil, elevation, raster, centroid: { lat, lng } });
      } catch (error) {
        console.warn("BhoomiSetu geospatial AI provider failed; falling back to OpenAI:", error);
      }
    }

    if (!analysis) {
      analysis = await askOpenAI({
        scene: latestScene,
        soil,
        elevation,
        raster,
        centroid: { lat, lng },
      });
    }

    return NextResponse.json({
      success: true,
      source: "Sentinel-2 / Earth Search + SoilGrids-compatible soil + Open-Meteo elevation + optional raster indices + OpenAI/geospatial AI",
      raster,
      centroid: { lat, lng },
      elevation,
      soil,
      scenes,
      latestScene,
      analysis,
    });
  } catch (error) {
    console.error("BhoomiSetu intelligence error", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Unable to generate land intelligence." },
      { status: 502 }
    );
  }
}
