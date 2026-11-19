# BhoomiSetu V6 — Bug Fixes Applied

This build keeps the existing UI and the `CinematicLanding` component unchanged.

## Fixed
- Added React Suspense boundaries around `useSearchParams()` usage in `/explore` and `/report` to prevent Next.js App Router prerender/CSR bailout build errors.
- Fixed the Leaflet map-layer initialization race so the initial `MAP`/`SATELLITE` mode is applied as soon as the map is created.
- Kept the original landing page, styles, routes, and visual components intact.
- Removed the duplicated nested `unzip/` project copy from the distributable ZIP.

## Not changed
- `components/CinematicLanding.tsx`
- `app/globals.css`
- Landing-page visual/UI behavior
- Existing satellite API behavior
- Existing page layouts
