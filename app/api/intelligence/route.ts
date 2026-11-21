
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

  if (input.type === "Feature") return input.geometry || null;

  if (input.type === "FeatureCollection") {
    return input.features?.[0]?.geometry || null;
  }

  if (input.type === "Polygon" || input.type === "MultiPolygon") {
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

  if (!Array.isArray(ring) || ring.length < 3) return null;

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

    if (Array.isArray(value)) value.forEach(walk);
  };

  walk(normalised?.coordinates);

  if (!points.length) return null;

  const lngs = points.map((p) => p[0]);
  const lats = points.map((p) => p[1]);

  return [
    Math.min(...lngs),
    Math.min(...lats),
    Math.max(...lngs),
    Math.max(...lats),
  ];
}

function expandBbox(bbox: number[], factor = 0.5): number[] {
  const [minLng, minLat, maxLng, maxLat] = bbox;

  const lngPadding = Math.max((maxLng - minLng) * factor, 0.01);
  const latPadding = Math.max((maxLat - minLat) * factor, 0.01);

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

// REAL SENTINEL-2 SATELLITE DISCOVERY
async function searchSatellite(
  geometry: any,
  lat: number,
  lng: number
) {
  const now = new Date();

  const start = new Date(
    Date.UTC(now.getUTCFullYear() - 5, 0, 1)
  );

  const datetime = `${start.toISOString()}/${now.toISOString()}`;

  const normalised = normaliseGeometry(geometry);
  const bbox = bboxFromGeometry(normalised);

  const searches: {
    name: string;
    body: Record<string, any>;
  }[] = [];

  if (normalised) {
    searches.push({
      name: "EXACT PARCEL",
      body: { intersects: normalised },
    });
  }

  if (bbox) {
    searches.push({
      name: "EXPANDED PARCEL",
      body: { bbox: expandBbox(bbox) },
    });
  }

  searches.push({
    name: "COORDINATE SEARCH",
    body: {
      bbox: [
        Math.max(-180, lng - 0.05),
        Math.max(-90, lat - 0.05),
        Math.min(180, lng + 0.05),
        Math.min(90, lat + 0.05),
      ],
    },
  });

  const collections = [
    "sentinel-2-l2a",
    "sentinel-2-c1-l2a",
  ];

  for (const search of searches) {
    for (const collection of collections) {
      try {
        console.log(
          `BhoomiSetu satellite search: ${collection} / ${search.name}`
        );

        const result = await earthSearch({
          ...search.body,
          collections: [collection],
          datetime,
          limit: 100,
        });

        const features = Array.isArray(result.features)
          ? result.features
          : [];

        const scenes = features.map((item: any) => {
          const assets = item.assets || {};
          const properties = item.properties || {};

          return {
            id: item.id,
            date: properties.datetime || null,
            cloudCover: Number(
              properties["eo:cloud_cover"] ?? 100
            ),
            platform: properties.platform || "Sentinel-2",
            thumbnail:
              assets.thumbnail?.href ||
              assets.visual?.href ||
              null,
            visual: assets.visual?.href || null,
            red: assets.red?.href || null,
            green: assets.green?.href || null,
            blue: assets.blue?.href || null,
            nir: assets.nir?.href || null,
          };
        });

        scenes.sort((a: any, b: any) => {
          const dateDifference =
            new Date(b.date || 0).getTime() -
            new Date(a.date || 0).getTime();

          if (dateDifference !== 0) {
            return dateDifference;
          }

          return a.cloudCover - b.cloudCover;
        });

        if (scenes.length > 0) {
          console.log(
            `BhoomiSetu found ${scenes.length} scenes`
          );

          return scenes;
        }
      } catch (error) {
        console.error(
          `Satellite search failed (${collection}/${search.name}):`,
          error instanceof Error ? error.message : error
        );
      }
    }
  }

  console.warn("No Sentinel-2 scenes found for this parcel.");

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

async function fetchElevation(lat: number, lng: number) {
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
    const depth =
      layer.depths?.find(
        (item: any) => item.label === "0-30cm"
      ) || layer.depths?.[0];

    if (!depth) continue;

    output[layer.name] = {
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
  const url = process.env.BHOOMISETU_RASTER_API_URL;

  if (!url) return null;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
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

// GEMINI AI WITH AUTOMATIC RETRIES
async function askGemini(input: {
  scene: any;
  soil: any;
  elevation: number | null;
  raster: any;
  centroid: { lat: number; lng: number };
}) {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not configured.");
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
summary, soil, water, terrain, vegetation, agriculture,
scores, risks, recommendedUses, confidence.

scores must contain soil, water, terrain, vegetation,
agriculture and overall. Each score must be 0-100 or null.

soil, water, terrain, vegetation and agriculture must
each be objects containing status, evidence, limitations.

recommendedUses and risks must be arrays of strings.
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

  let lastError = "Gemini analysis failed.";

  for (let attempt = 0; attempt < 3; attempt++) {
    let response: Response | null = null;

    try {
      response = await fetch(
        "https://generativelanguage.googleapis.com/v1beta/interactions",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-goog-api-key": apiKey,
          },
          body: JSON.stringify({
            model:
              process.env.GEMINI_MODEL ||
              "gemini-3.8-flash",
            input: prompt,
          }),
          cache: "no-store",
          signal: AbortSignal.timeout(25000),
        }
      );

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        lastError =
          data?.error?.message ||
          `Gemini returned HTTP ${response.status}.`;

        const retryable = [
          408,
          429,
          500,
          502,
          503,
          504,
        ].includes(response.status);

        if (retryable && attempt < 2) {
          await new Promise((resolve) =>
            setTimeout(resolve, 1500 * (attempt + 1))
          );

          continue;
        }

        throw new Error(lastError);
      }

      const outputText = (data?.steps || [])
        .filter(
          (step: any) => step.type === "model_output"
        )
        .flatMap(
          (step: any) => step.content || []
        )
        .filter(
          (part: any) => part.type === "text"
        )
        .map(
          (part: any) => part.text || ""
        )
        .join("\n")
        .trim();

      if (!outputText) {
        throw new Error("Gemini returned no analysis.");
      }

      const cleaned = outputText
        .replace(/^```json\s*/i, "")
        .replace(/^```\s*/i, "")
        .replace(/\s*```$/, "")
        .trim();

      return JSON.parse(cleaned);
    } catch (error) {
      lastError =
        error instanceof Error
          ? error.message
          : lastError;

      const retryable =
        !response ||
        [408, 429, 500, 502, 503, 504].includes(
          response.status
        );

      if (retryable && attempt < 2) {
        await new Promise((resolve) =>
          setTimeout(resolve, 1500 * (attempt + 1))
        );

        continue;
      }

      throw new Error(lastError);
    }
  }

  throw new Error(lastError);
}

// SAFE FALLBACK WHEN GEMINI IS UNAVAILABLE
// Does not fabricate land scores or measurements.
function buildEvidenceFallback(input: {
  scene: any;
  soil: any;
  elevation: number | null;
  raster: any;
}) {
  const hasSoil =
    input.soil &&
    typeof input.soil === "object" &&
    Object.keys(input.soil).some(
      (key) =>
        key !== "unavailable" &&
        input.soil[key]?.value != null
    );

  const hasElevation =
    typeof input.elevation === "number" &&
    Number.isFinite(input.elevation);

  const hasRaster =
    input.raster &&
    typeof input.raster === "object" &&
    !input.raster.unavailable;

  return {
    summary:
      "Automated AI interpretation is temporarily unavailable. Available source data is retained without generating unsupported land suitability scores. Please retry the analysis later.",

    soil: {
      status: hasSoil
        ? "DATA AVAILABLE — REVIEW REQUIRED"
        : "UNAVAILABLE",
      evidence: hasSoil
        ? "Soil provider returned measurements. Review the soil data before drawing conclusions."
        : "No usable soil measurements were returned.",
      limitations:
        "Provider measurements do not replace on-site soil sampling.",
    },

    water: {
      status: hasRaster
        ? "RASTER DATA AVAILABLE — REVIEW REQUIRED"
        : "UNAVAILABLE",
      evidence: hasRaster
        ? "Raster processor returned data, but water suitability has not been interpreted."
        : "No validated water-index result is available.",
      limitations:
        "No groundwater or field water assessment was performed.",
    },

    terrain: {
      status: hasElevation
        ? "ELEVATION AVAILABLE"
        : "UNAVAILABLE",
      evidence: hasElevation
        ? `Elevation provider returned ${input.elevation} metres.`
        : "No elevation measurement was returned.",
      limitations:
        "Elevation alone does not establish slope, drainage or buildability.",
    },

    vegetation: {
      status: hasRaster
        ? "RASTER DATA AVAILABLE — REVIEW REQUIRED"
        : "UNAVAILABLE",
      evidence: hasRaster
        ? "Raster data is present, but vegetation indices have not been interpreted."
        : "No validated vegetation-index result is available.",
      limitations:
        "Vegetation condition requires valid spectral measurements and interpretation.",
    },

    agriculture: {
      status: "NOT ASSESSED",
      evidence:
        "Agricultural suitability has not been assessed because automated AI interpretation is unavailable.",
      limitations:
        "A field survey, soil testing and water assessment are required.",
    },

    scores: {
      soil: null,
      water: null,
      terrain: null,
      vegetation: null,
      agriculture: null,
      overall: null,
    },

    risks: [
      "AI interpretation is temporarily unavailable; retry later.",
      "Do not treat missing measurements as evidence that the land is unsuitable.",
      "Satellite and third-party data do not verify ownership or legal title.",
    ],

    recommendedUses: [],
    confidence: 0,
    fallback: true,
  };
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

    const geometry = normaliseGeometry(body.geometry);

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

    // FETCH SATELLITE, SOIL AND ELEVATION IN PARALLEL
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
              ? String(
                  soilResult.reason?.message ||
                    "Soil data unavailable"
                )
              : "No soil data",
        };

    const latestScene = scenes[0] || null;

    // RETURN PARTIAL REAL DATA IF SATELLITE IS UNAVAILABLE
    if (!latestScene) {
      return NextResponse.json({
        success: false,
        error:
          "No Sentinel-2 scenes found. Soil and elevation results are returned where available.",
        centroid: { lat, lng },
        soil,
        elevation,
        scenes: [],
        satelliteUnavailable: true,
      });
    }

    // OPTIONAL RASTER PROCESSOR
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

    // OPTIONAL EXTERNAL GEOSPATIAL AI
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
          "Geospatial AI provider failed:",
          error
        );
      }
    }

    let aiProvider = process.env.BHOOMISETU_GEO_AI_URL
      ? "geospatial-ai"
      : "gemini";

    // GEMINI WITH SAFE FALLBACK
    if (!analysis) {
      try {
        analysis = await askGemini({
          scene: latestScene,
          soil,
          elevation,
          raster,
          centroid: { lat, lng },
        });
      } catch (error) {
        console.error(
          "Gemini unavailable; using evidence fallback:",
          error
        );

        analysis = buildEvidenceFallback({
          scene: latestScene,
          soil,
          elevation,
          raster,
        });

        aiProvider = "evidence-fallback";
      }
    }

    return NextResponse.json({
      success: true,
      aiProvider,
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
      "BhoomiSetu intelligence error:",
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
