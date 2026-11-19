# BhoomiSetu current free mode

This build has the ₹199 report gate disabled. Razorpay route files are retained for later re-enablement.

## Required environment variables

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (or legacy anon key)
- `SUPABASE_SECRET_KEY` if your existing server/admin flows use it
- `OPENAI_API_KEY`

No API key is required for Earth Search, Open-Meteo, OpenStreetMap, Esri tiles, or Three.js Earth assets in the current implementation.

## Install and run

```powershell
npm install
npm run build
npm run dev
```

Then open `http://localhost:3000`.

## Raster

The intelligence route calls `/api/raster` locally. The raster route uses `geotiff` to read Sentinel-2 COG assets and calculate parcel-window NDVI/NDWI/NIR-style evidence. If a public Sentinel-2 asset cannot be downloaded, the report explicitly marks raster evidence unavailable instead of inventing values.
