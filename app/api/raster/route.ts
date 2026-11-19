import { NextRequest, NextResponse } from "next/server";

type Point = [number, number];
type BBox = [number, number, number, number];

function geometryBBox(geometry: any): BBox | null {
  const points: Point[] = [];
  const walk = (value: any) => {
    if (Array.isArray(value) && value.length >= 2 && typeof value[0] === "number" && typeof value[1] === "number") {
      points.push([value[0], value[1]]);
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

function finite(value: unknown) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

async function readBand(url: string, bbox: BBox, targetSize = 128) {
  const { fromUrl } = await import("geotiff");
  const tiff = await fromUrl(url);
  const image = await tiff.getImage();
  const imageBBox = image.getBoundingBox() as BBox;
  const width = image.getWidth();
  const height = image.getHeight();

  const minX = Math.max(bbox[0], imageBBox[0]);
  const minY = Math.max(bbox[1], imageBBox[1]);
  const maxX = Math.min(bbox[2], imageBBox[2]);
  const maxY = Math.min(bbox[3], imageBBox[3]);

  if (minX >= maxX || minY >= maxY) {
    throw new Error("Parcel does not intersect the raster extent.");
  }

  const imageWidth = imageBBox[2] - imageBBox[0];
  const imageHeight = imageBBox[3] - imageBBox[1];

  const x0 = Math.max(0, Math.floor(((minX - imageBBox[0]) / imageWidth) * width));
  const x1 = Math.min(width, Math.ceil(((maxX - imageBBox[0]) / imageWidth) * width));
  const y0 = Math.max(0, Math.floor(((imageBBox[3] - maxY) / imageHeight) * height));
  const y1 = Math.min(height, Math.ceil(((imageBBox[3] - minY) / imageHeight) * height));

  const raster = await image.readRasters({
    window: [x0, y0, Math.max(x0 + 1, x1), Math.max(y0 + 1, y1)],
    width: targetSize,
    height: targetSize,
    samples: [0],
    interleave: true,
  });

  const values = Array.from(raster as ArrayLike<number>, Number);
  const finiteValues = values.filter((v) => Number.isFinite(v));
  if (!finiteValues.length) throw new Error("Raster contains no finite samples.");

  return {
    values,
    mean: finiteValues.reduce((a, b) => a + b, 0) / finiteValues.length,
    min: Math.min(...finiteValues),
    max: Math.max(...finiteValues),
    validSamples: finiteValues.length,
    totalSamples: values.length,
  };
}

function normaliseReflectance(value: number) {
  if (value > 1.5 && value <= 20000) return value / 10000;
  return value;
}

function indexStats(a: number[], b: number[], formula: (x: number, y: number) => number) {
  const count = Math.min(a.length, b.length);
  const output: number[] = [];
  for (let i = 0; i < count; i++) {
    const x = normaliseReflectance(a[i]);
    const y = normaliseReflectance(b[i]);
    if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
    const v = formula(x, y);
    if (Number.isFinite(v) && v >= -1 && v <= 1) output.push(v);
  }
  if (!output.length) return null;
  return {
    mean: output.reduce((s, v) => s + v, 0) / output.length,
    min: Math.min(...output),
    max: Math.max(...output),
    validSamples: output.length,
  };
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const scene = body?.scene || {};

    let bbox = geometryBBox(body?.geometry);
    if (!bbox) {
      const lat = finite(body?.centroid?.lat);
      const lng = finite(body?.centroid?.lng);
      if (lat === null || lng === null) {
        return NextResponse.json({ error: "A parcel geometry or centroid is required." }, { status: 400 });
      }
      bbox = [lng - 0.01, lat - 0.01, lng + 0.01, lat + 0.01];
    }

    if (!scene.red || !scene.nir) {
      return NextResponse.json({
        success: false,
        unavailable: "Sentinel-2 Red and NIR raster assets are required.",
        indices: { NDVI: null, NDWI: null, NIR: null },
      }, { status: 422 });
    }

    const [red, nir, green] = await Promise.all([
      readBand(String(scene.red), bbox),
      readBand(String(scene.nir), bbox),
      scene.green ? readBand(String(scene.green), bbox) : Promise.resolve(null),
    ]);

    const ndvi = indexStats(red.values, nir.values, (r, n) => (n - r) / (n + r));
    const ndwi = green ? indexStats(green.values, nir.values, (g, n) => (g - n) / (g + n)) : null;

    const nirMean = normaliseReflectance(nir.mean);

    return NextResponse.json({
      success: true,
      scene: { id: scene.id || null, date: scene.date || null, platform: scene.platform || "Sentinel-2" },
      bbox,
      resolution: { samples: red.totalSamples },
      indices: {
        NDVI: ndvi,
        NDWI: ndwi,
        NIR: { mean: nirMean, min: normaliseReflectance(nir.min), max: normaliseReflectance(nir.max), unit: "reflectance-scaled" },
      },
      quality: {
        redValidSamples: red.validSamples,
        nirValidSamples: nir.validSamples,
        greenValidSamples: green?.validSamples ?? null,
        note: "Values are derived from the selected Sentinel-2 raster window; cloud/shadow masking is not independently performed by this lightweight processor.",
      },
    });
  } catch (error) {
    console.error("BhoomiSetu raster error:", error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : "Unable to process raster assets.",
    }, { status: 502 });
  }
}
