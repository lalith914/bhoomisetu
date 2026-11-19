import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    providers: {
      supabase: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && (process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)),
      openai: Boolean(process.env.OPENAI_API_KEY),
      razorpay: false,
      earthSearch: true,
      soilGrids: Boolean(process.env.BHOOMISETU_SOIL_API_URL),
      openMeteo: true,
      openStreetMap: true,
      esri: true,
      threeEarth: true,
      rasterProcessor: Boolean(process.env.BHOOMISETU_RASTER_API_URL),
      geospatialAiProcessor: Boolean(process.env.BHOOMISETU_GEO_AI_URL),
    },
    payment: { enabled: false, amountInr: 199 },
    satellite: { collection: "sentinel-2-l2a", maxCloudCover: 25, years: 5 },
  });
}
