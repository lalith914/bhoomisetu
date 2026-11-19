# BhoomiSetu V6 — Connected Geospatial Build

This build starts from the complete BhoomiSetu immersive project and adds the connected interactions requested for the V6 pass.

## Connected interactions

- Explore MAP / SATELLITE controls now switch the real Leaflet base layer.
- Explore EARTH opens a real textured Earth rendered with Three.js, using the Three.js planet texture set rather than a procedural/AI-generated globe.
- Buyer search, land-type and score filters work locally; SAVE toggles; MAP passes parcel latitude/longitude into Explore; VIEW INTELLIGENCE opens the report.
- Explore parcel popup opens the Intelligence route.
- Explore state controls continue to fly the map to the selected region.
- Owner latitude/longitude inputs fly the property map to the supplied coordinates.
- Owner map includes real satellite/street layers and working Geoman draw/edit/move/clear boundary controls.
- Admin OPEN / VERIFY / REJECT actions remain interactive.
- Intelligence layers, timeline, CAD GeoJSON export, report generation and AI-style land Q&A remain connected.
- Account sign-out and authentication routing remain connected to Supabase when configured.

## Real Earth

`components/EarthView.tsx` uses real-world Earth imagery textures from the Three.js example planet texture set:
- earth_day_4096.jpg
- earth_normal_2048.jpg
- earth_specular_2048.jpg
- earth_clouds_1024.png

The texture URLs are loaded client-side from threejs.org. The landing page already uses the same real Earth texture family.

## Satellite imagery

Explore and Owner use Esri World Imagery as the satellite base layer and OpenStreetMap as the street layer. Confirm the tile provider's current usage terms/limits before production deployment and replace with your licensed provider/API key if required.

## Run

```powershell
npm install
npm run dev
```

Then open `http://localhost:3000`.

Do not commit `.env.local`. Use `.env.example` and configure your own Supabase values locally.
