# BhoomiSetu — Free Intelligence Build

This package is prepared so you can add the API keys and run it.

## Required keys

Add these to `.env.local`:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_SECRET_KEY` only if your existing server/admin flows require it
- `OPENAI_API_KEY`

Copy `.env.local.example` to `.env.local` and fill the keys.

## Install

Because this build adds the `geotiff` dependency, run once after extracting:

```powershell
npm install
```

Then:

```powershell
npm run build
npm run dev
```

Open `http://localhost:3000`.

## Current behavior

- Intelligence/report is FREE.
- Satellite history is FREE.
- Land geometry/details are FREE.
- Razorpay code is retained but payment is disabled.
- MAP / SATELLITE / TERRAIN / 3D EARTH are available in Explore.
- Explore map is bounded to India.
- Sentinel-2 Earth Search, SoilGrids, Open-Meteo, OpenStreetMap, Esri tiles and Three.js Earth remain configured without API keys where the providers permit it.
- `/api/raster` reads Sentinel-2 raster assets with GeoTIFF and calculates NDVI/NDWI/NIR evidence when the returned assets are readable.
- If a provider or raster asset fails, the app reports unavailable evidence instead of inventing measurements.

## Later payment re-enable

Razorpay files are intentionally still present under `app/api/payments`. The current UI/API does not require payment.
