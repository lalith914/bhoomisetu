import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const provider = process.env.BHOOMISETU_CADASTRAL_API_URL;
  const body = await request.json().catch(() => ({}));
  const latitude = Number(body?.latitude);
  const longitude = Number(body?.longitude);

  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return NextResponse.json({ error: "Valid latitude and longitude are required." }, { status: 400 });
  }

  if (!provider) {
    return NextResponse.json({ status: "not_configured", surveyNumber: null });
  }

  try {
    const response = await fetch(provider, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ latitude, longitude, geometry: body?.geometry ?? null }),
      cache: "no-store",
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) return NextResponse.json({ error: result?.error || "Cadastral provider request failed." }, { status: 502 });

    const surveyNumber = result?.surveyNumber ?? result?.survey_number ?? result?.parcel?.surveyNumber ?? result?.parcel?.survey_number ?? null;
    return NextResponse.json({
      status: surveyNumber ? "found" : "not_found",
      surveyNumber,
      source: result?.source ?? "AUTHORITATIVE_CADASTRAL",
      reference: result?.reference ?? result?.cadastral_reference ?? null,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Unable to reach cadastral provider." }, { status: 502 });
  }
}
