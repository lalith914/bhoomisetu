# BhoomiSetu — API & Provider Setup

## Required credentials

### 1. Supabase
Create a project, then copy the Project URL and Publishable key from the Supabase Connect / API Keys area.

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
```

For server-only payment audit writes, create a Supabase Secret key and keep it server-side:

```env
SUPABASE_SECRET_KEY=
```

Run `SUPABASE_SETUP.sql` in Supabase SQL Editor.

### 2. OpenAI
Create an API key in the OpenAI API platform.

```env
OPENAI_API_KEY=
OPENAI_MODEL=gpt-5
```

The key is server-side only. It is used for the structured land-intelligence interpretation and the paid Ask BhoomiSetu assistant.

### 3. Razorpay
Create Test Mode API keys first. Use Live Mode keys only after the website/payment flow is verified.

```env
RAZORPAY_KEY_ID=
RAZORPAY_KEY_SECRET=
```

The application creates a fixed ₹199 order and verifies the order, signature, amount, email/report match and captured payment before granting access.

## Open/free data services used by BhoomiSetu

### Earth Search / Sentinel-2
No API key is required by the current integration.

```env
BHOOMISETU_EARTH_SEARCH_URL=https://earth-search.aws.element84.com/v1/search
```

Used for Sentinel-2 L2A scene discovery, cloud cover, dates and band/thumbnail asset URLs.

### SoilGrids
No API key is required by the current integration, but availability is provider-dependent.

```env
BHOOMISETU_SOIL_API_URL=https://rest.isric.org/soilgrids/v2.0/properties/query
```

If SoilGrids is unavailable, BhoomiSetu does not invent soil values.

### Open-Meteo elevation
No API key is required for the standard endpoint used here.

```env
BHOOMISETU_ELEVATION_URL=https://api.open-meteo.com/v1/elevation
```

### OpenStreetMap
No API key is required for the standard tile endpoint, but the public tile service has a usage policy and is best-effort. For a high-volume commercial deployment, configure a suitable production tile provider in `NEXT_PUBLIC_BHOOMISETU_MAP_TILE_URL`.

```env
NEXT_PUBLIC_BHOOMISETU_MAP_TILE_URL=https://tile.openstreetmap.org/{z}/{x}/{y}.png
```

### Esri imagery / terrain
The current project can use public ArcGIS REST basemap tile URLs without a key in this implementation. For commercial production, verify the provider's current terms and configure a suitable ArcGIS service/account if required.

```env
NEXT_PUBLIC_BHOOMISETU_SATELLITE_TILE_URL=https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}
NEXT_PUBLIC_BHOOMISETU_TERRAIN_TILE_URL=https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}
```

### Three.js Earth
No API key is required. The 3D Earth is rendered locally in the browser. The current Earth textures are remote assets; for production, self-host them in `/public` if you want the Earth view to be independent of the texture host.

## Optional but implemented production connectors

### Raster processor — NDVI / NDWI / NIR / NDMI / NDBI
Set a server-side URL for a raster processor that can read the Sentinel-2 band assets and return numerical spectral evidence.

```env
BHOOMISETU_RASTER_API_URL=
```

The application sends the parcel geometry, scene metadata, band asset URLs and requested indices:

- NDVI
- NDWI
- NIR
- NDMI
- NDBI

### Geospatial AI processor
Set a server-side URL if you have a dedicated geospatial AI/raster inference service.

```env
BHOOMISETU_GEO_AI_URL=
```

If configured, BhoomiSetu tries this processor first and falls back to OpenAI if it fails.

## Buyer privacy / payment gate

Public buyers receive only:

- location
- area
- price
- land purpose/type
- listing title
- verified listing status

The following are server-gated behind the ₹199 unlock:

- Sentinel-2 scene history
- satellite thumbnails/assets
- soil data
- elevation evidence
- NDVI / NDWI / NIR / other spectral indices
- AI land score
- AI interpretation
- risks and limitations
- recommended uses
- Ask BhoomiSetu AI
- downloadable/full report

The `/api/intelligence` and `/api/ask` routes enforce the same access check server-side, so hiding the UI is not the only protection.
