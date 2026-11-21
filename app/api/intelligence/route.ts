
import { NextRequest, NextResponse } from "next/server";

const EARTH_SEARCH =
  process.env.BHOOMISETU_EARTH_SEARCH_URL ||
  "https://earth-search.aws.element84.com/v1/search";

const SOILGRIDS =
  process.env.BHOOMISETU_SOIL_API_URL ||
  "https://rest.isric.org/soilgrids/v2.0/properties/query";

const ELEVATION =
  process.env.BHOOMISETU_ELEVATION_URL ||
  "https://api.open-meteo.com/v1/elevation";

function finiteNumber(value: unknown): number | null {
  if (
    value === null ||
    value === undefined ||
    String(value).trim() === ""
  ) {
    return null;
  }

  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function normaliseGeometry(input: any): any | null {
  if (!input) return null;

  if (input.type === "Feature") {
    return input.geometry || null;
  }

  if (input.type === "FeatureCollection") {
    return input.features?.[0]?.geometry || null;
  }

  if (
    input.type === "Polygon" ||
    input.type === "MultiPolygon"
  ) {
    return input;
  }

  return null;
}

function centroidFromGeometry(geometry: any) {
  const normalised = normaliseGeometry(geometry);
  const coords = normalised?.coordinates;

  if (!coords) return null;

  const ring =
    normalised.type === "Polygon"
      ? coords[0]
      : normalised.type === "MultiPolygon"
        ? coords[0]?.[0]
        : null;

  if (!Array.isArray(ring) || ring.length < 3) {
    return null;
  }

  // Ignore the repeated closing point of the polygon.
  const points =
    ring.length > 3 &&
    ring[0][0] === ring[ring.length - 1][0] &&
    ring[0][1] === ring[ring.length - 1][1]
      ? ring.slice(0, -1)
      : ring;

  let lng = 0;
  let lat = 0;

  for (const point of points) {
    lng += Number(point[0]);
    lat += Number(point[1]);
  }

  return {
    lat: lat / points.length,
    lng: lng / points.length,
  };
}

function bboxFromGeometry(geometry: any) {
  const normalised = normaliseGeometry(geometry);
  const points: number[][] = [];

  const walk = (value: any) => {
    if (
      Array.isArray(value) &&
      value.length >= 2 &&
      typeof value[0] === "number" &&
      typeof value[1] === "number"
    ) {
      points.push(value);
      return;
    }

    if (Array.isArray(value)) {
      value.forEach(walk);
    }
  };

  walk(normalised?.coordinates);

  if (!points.length) return null;

  const lngs = points.map((point) => point[0]);
  const lats = points.map((point) => point[1]);

  return [
    Math.min(...lngs),
    Math.min(...lats),
    Math.max(...lngs),
    Math.max(...lats),
  ];
}

function expandBbox(
  bbox: number[],
  factor = 0.25
): number[] {
  const [minLng, minLat, maxLng, maxLat] = bbox;

  const lngPadding = Math.max(
    (maxLng - minLng) * factor,
    0.01
  );

  const latPadding = Math.max(
    (maxLat - minLat) * factor,
    0.01
  );

  return [
    Math.max(-180, minLng - lngPadding),
    Math.max(-90, minLat - latPadding),
    Math.min(180, maxLng + lngPadding),
    Math.min(90, maxLat + latPadding),
  ];
}

function validCoordinates(lat: number, lng: number) {
  return (
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    lat >= -90 &&
    lat <= 90 &&
    lng >= -180 &&
    lng <= 180 &&
    !(lat === 0 && lng === 0)
  );
}

async function earthSearch(body: Record<string, any>) {
  const response = await fetch(EARTH_SEARCH, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/geo+json",
    },
    body: JSON.stringify(body),
    cache: "no-store",
  });

  if (!response.ok) {
    const details = await response.text();

    throw new Error(
      `Earth Search returned ${response.status}: ${details.slice(0, 300)}`
    );
  }

  return response.json();
}

async function searchSatellite(
  geometry: any,
  lat: number,
  lng: number
) {
  const now = new Date();

  // Search the previous five years.
  const start = new Date(
    Date.UTC(now.getUTCFullYear() - 5, 0, 1)
  );

  const datetime =
    `${start.toISOString()}/${now.toISOString()}`;

  const baseBody = {
    collections: ["sentinel-2-l2a"],
    datetime,
    limit: 30,
    query: {
      "eo:cloud_cover": {
        lt: 80,
      },
    },
    sortby: [
      {
        field: "properties.datetime",
        direction: "desc",
      },
    ],
  };

  const normalised = normaliseGeometry(geometry);
  const bbox = bboxFromGeometry(normalised);

  const searches: {
    name: string;
    body: Record<string, any>;
  }[] = [];

  // Attempt 1: exact property boundary.
  if (normalised) {
    searches.push({
      name: "EXACT PROPERTY BOUNDARY",
      body: {
        ...baseBody,
        intersects: normalised,
      },
    });
  }

  // Attempt 2: expanded property bounding box.
  if (bbox) {
    searches.push({
      name: "EXPANDED PROPERTY AREA",
      body: {
        ...baseBody,
        bbox: expandBbox(bbox),
      },
    });
  }

  // Attempt 3: coordinate-based search.
  searches.push({
    name: "COORDINATE SEARCH",
    body: {
      ...baseBody,
      bbox: [
        Math.max(-180, lng - 0.05),
        Math.max(-90, lat - 0.05),
        Math.min(180, lng + 0.05),
        Math.min(90, lat + 0.05),
      ],
    },
  });

  let lastError = "";

  for (const search of searches) {
    try {
      console.log(
        `BhoomiSetu satellite search: ${search.name}`
      );

      const data = await earthSearch(search.body);

      const scenes = Array.isArray(data.features)
        ? data.features.map((item: any) => ({
            id: item.id,
            date: item.properties?.datetime || null,
            cloudCover: Number(
              item.properties?.["eo:cloud_cover"] ?? 0
            ),
            platform:
              item.properties?.platform || "Sentinel-2",
            thumbnail:
              item.assets?.thumbnail?.href || null,
            visual:
              item.assets?.visual?.href || null,
            red: item.assets?.red?.href || null,
            green: item.assets?.green?.href || null,
            blue: item.assets?.blue?.href || null,
            nir: item.assets?.nir?.href || null,
          }))
        : [];

      if (scenes.length > 0) {
        console.log(
          `BhoomiSetu found ${scenes.length} Sentinel-2 scenes using ${search.name}`
        );

        return scenes;
      }
    } catch (error) {
      lastError =
        error instanceof Error
          ? error.message
          : "Satellite search failed.";

      console.warn(
        `BhoomiSetu ${search.name} failed:`,
        lastError
      );
    }
  }

  if (lastError) {
    console.warn("All satellite search attempts completed.");
  }

  return [];
}

async function fetchSoil(lat: number, lng: number) {
  const params = new URLSearchParams({
    lon: String(lng),
    lat: String(lat),
    value: "mean",
  });

  for (const property of [
    "clay",
    "sand",
    "silt",
    "phh2o",
    "soc",
    "nitrogen",
    "cec",
  ]) {
    params.append("property", property);
  }

  for (const depth of [
    "0-5cm",
    "5-15cm",
    "15-30cm",
    "0-30cm",
  ]) {
    params.append("depth", depth);
  }

  const response = await fetch(
    `${SOILGRIDS}?${params.toString()}`,
    { cache: "no-store" }
  );

  if (!response.ok) {
    throw new Error(
      `Soil provider returned ${response.status}`
    );
  }

  return response.json();
}

async function fetchElevation(
  lat: number,
  lng: number
) {
  const url = new URL(ELEVATION);

  url.searchParams.set("latitude", String(lat));
  url.searchParams.set("longitude", String(lng));

  const response = await fetch(url, {
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(
      `Elevation provider returned ${response.status}`
    );
  }

  const data = await response.json();

  return Array.isArray(data.elevation)
    ? data.elevation[0]
    : null;
}

function flattenSoil(data: any) {
  const output: Record<string, unknown> = {};

  for (const layer of data?.properties?.layers || []) {
    const name = layer.name;

    const depth =
      layer.depths?.find(
        (item: any) => item.label === "0-30cm"
      ) || layer.depths?.[0];

    if (!depth) continue;

    output[name] = {
      unit:
        layer.unit_measure?.mapped_units ||
        layer.unit_measure?.target_units ||
        null,
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
  const url =
    process.env.BHOOMISETU_RASTER_API_URL ||
    "http://127.0.0.1:3000/api/raster";

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
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
      requestedIndices: [
        "NDVI",
        "NDWI",
        "NIR",
        "NDMI",
        "NDBI",
      ],
    }),
    cache: "no-store",
  });

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(
      data?.error ||
        `Raster processor returned ${response.status}`
    );
  }

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
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
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

  if (!response.ok) {
    throw new Error(
      data?.error ||
        `Geospatial AI processor returned ${response.status}`
    );
  }

  return data?.analysis || data;
}

async function askGemini(input: {
  scene: any;
  soil: any;
  elevation: number | null;
  raster: any;
  centroid: { lat: number; lng: number };
}) {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    throw new Error(
      "GEMINI_API_KEY is not configured."
    );
  }

  const prompt = `
You are BhoomiSetu's geospatial intelligence engine.

Analyze this land parcel using ONLY the supplied evidence.

Rules:
1. Never invent measurements or facts.
2. Distinguish satellite inference from field verification.
3. If soil data is missing, say unavailable.
4. If evidence is insufficient, return null for the overall score.
5. Do not make legal ownership or title claims.
6. Never claim satellite imagery proves ownership.

Return valid JSON only with these keys:
summary, soil, water, terrain, vegetation,
agriculture, scores, risks, recommendedUses, confidence.

scores must contain:
soil, water, terrain, vegetation, agriculture, overall.

Each score must be a number from 0 to 100 or null.

soil, water, terrain, vegetation and agriculture
must each be objects containing:
status, evidence, limitations.

recommendedUses must be an array of strings.
risks must be an array of strings.
confidence must be a number from 0 to 100.

CENTROID:
${JSON.stringify(input.centroid)}

ELEVATION IN METRES:
${input.elevation ?? "Unavailable"}

SATELLITE SCENE:
${JSON.stringify(input.scene)}

SOIL DATA:
${JSON.stringify(input.soil)}

RASTER EVIDENCE:
${JSON.stringify(input.raster)}
`;

  const response = await fetch(
    "https://generativelanguage.googleapis.com/v1beta/interactions",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey,
      },
      body: JSON.stringify({
        model: "gemini-3.8-flash",
        input: prompt,
      }),
      cache: "no-store",
    }
  );

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(
      data?.error?.message ||
        "Gemini analysis failed."
    );
  }

  const outputText = (data?.steps || [])
    .filter(
      (step: any) => step.type === "model_output"
    )
    .flatMap((step: any) => step.content || [])
    .filter(
      (part: any) => part.type === "text"
    )
    .map((part: any) => part.text || "")
    .join("\n")
    .trim();

  if (!outputText) {
    throw new Error("Gemini returned no analysis.");
  }

  try {
    const cleaned = outputText
      .replace(/^```json\s*/i, "")
      .replace(/^```\s*/i, "")
      .replace(/\s*```$/, "")
      .trim();

    return JSON.parse(cleaned);
  } catch {
    throw new Error("Gemini returned invalid JSON.");
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const reportId = String(body.reportId || "").trim();

    if (!reportId) {
      return NextResponse.json(
        { error: "Report ID is required." },
        { status: 400 }
      );
    }

    const geometry = normaliseGeometry(
      body.geometry
    );

    let lat = finiteNumber(body.lat);
    let lng = finiteNumber(body.lng);

    const centroid = centroidFromGeometry(geometry);

    if (centroid) {
      lat = centroid.lat;
      lng = centroid.lng;
    }

    if (
      lat === null ||
      lng === null ||
      !validCoordinates(lat, lng)
    ) {
      return NextResponse.json(
        {
          error:
            "Valid parcel coordinates or polygon geometry are required. Coordinates cannot be 0,0.",
        },
        { status: 400 }
      );
    }

    const [
      scenesResult,
      soilResult,
      elevationResult,
    ] = await Promise.allSettled([
      searchSatellite(geometry, lat, lng),
      fetchSoil(lat, lng),
      fetchElevation(lat, lng),
    ]);

    const scenes =
      scenesResult.status === "fulfilled"
        ? scenesResult.value
        : [];

    const soilRaw =
      soilResult.status === "fulfilled"
        ? soilResult.value
        : null;

    const elevation =
      elevationResult.status === "fulfilled"
        ? elevationResult.value
        : null;

    const soil = soilRaw
      ? flattenSoil(soilRaw)
      : {
          unavailable:
            soilResult.status === "rejected"
              ? soilResult.reason?.message
              : "No soil data",
        };

    const latestScene = scenes[0] || null;

    if (!latestScene) {
      return NextResponse.json(
        {
          error:
            "No Sentinel-2 scenes were found after searching the property boundary and surrounding area. Try again later or check the parcel coordinates.",
          centroid: { lat, lng },
          soil,
          elevation,
          scenes: [],
        },
        { status: 422 }
      );
    }

    let raster: any = null;

    if (process.env.BHOOMISETU_RASTER_API_URL) {
      try {
        raster = await fetchRasterEvidence({
          geometry,
          scene: latestScene,
          centroid: { lat, lng },
        });
      } catch (error) {
        raster = {
          unavailable:
            error instanceof Error
              ? error.message
              : "Raster processor unavailable",
        };
      }
    }

    let analysis: any = null;

    if (process.env.BHOOMISETU_GEO_AI_URL) {
      try {
        analysis = await askGeospatialAi({
          geometry,
          scene: latestScene,
          soil,
          elevation,
          raster,
          centroid: { lat, lng },
        });
      } catch (error) {
        console.warn(
          "BhoomiSetu geospatial AI provider failed:",
          error
        );
      }
    }

    if (!analysis) {
      analysis = await askGemini({
        scene: latestScene,
        soil,
        elevation,
        raster,
        centroid: { lat, lng },
      });
    }

    return NextResponse.json({
      success: true,
      source:
        "Sentinel-2 / Earth Search + SoilGrids-compatible soil + Open-Meteo elevation + optional raster indices + Gemini/geospatial AI",
      raster,
      centroid: { lat, lng },
      elevation,
      soil,
      scenes,
      latestScene,
      analysis,
    });
  } catch (error) {
    console.error(
      "BhoomiSetu intelligence error",
      error
    );

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Unable to generate land intelligence.",
      },
      { status: 502 }
    );
  }
}
