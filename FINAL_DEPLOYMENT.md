# BhoomiSetu — Final Deployment Build

This build keeps the original cinematic landing page unchanged.

## What is now real

- Explore map starts over India and uses the verified-land database feed.
- Satellite imagery uses Sentinel-2 discovery through Element84 Earth Search.
- Intelligence no longer contains seeded scores/scenes.
- Parcel intelligence accepts coordinates and, for UUID land records, can use the stored PostGIS boundary.
- Soil data is requested from the configured SoilGrids-compatible provider.
- Elevation is requested from Open-Meteo.
- AI interpretation uses the OpenAI Responses API and can inspect the latest satellite thumbnail when the source provides one.
- “Ask BhoomiSetu” uses the same connected AI provider; there are no scripted answers.
- Buyers see only verified records returned by Supabase.
- Admin verification queue reads/writes the real `lands` table.
- Full intelligence/report access is paywalled at ₹199 for viewers.
- Owner/admin emails configured in `BHOOMISETU_OWNER_EMAILS` receive full access without payment.
- Razorpay server-side order creation, signature verification, order matching and captured-payment verification are included.

## Required setup

1. Copy `.env.example` to `.env.local`.
2. Add Supabase URL/key.
3. Add `BHOOMISETU_ACCESS_SECRET` (long random secret).
4. Add `BHOOMISETU_OWNER_EMAILS` with your own account email(s).
5. Add `OPENAI_API_KEY` and choose `OPENAI_MODEL`.
6. Add Razorpay test keys first; switch to Live Mode keys only after end-to-end testing.
7. Run `SUPABASE_SETUP.sql` in Supabase SQL Editor.
8. Enable Razorpay automatic capture before delivering paid reports.
9. Install dependencies and run `npm run build` before deployment.

## Geospatial provider note

Earth Search is free-to-use for search/discovery, but it does not guarantee production uptime. SoilGrids' REST API is currently beta/subject to availability. The soil provider is configurable so a production soil API can replace it without changing the UI.

## Important

The AI layer does not present satellite inference as a substitute for a field soil test, legal title verification, cadastral survey, hydrological survey, or professional agronomic advice.
