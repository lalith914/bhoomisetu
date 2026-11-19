# BhoomiSetu — Property Evidence Add-on

This add-on leaves the existing BhoomiSetu UI and boundary drawing implementation intact and adds:

- Multiple owner property photos (up to 15, 8 MB each)
- First photo as cover photo
- Supabase Storage bucket: `land-photos`
- `land_photos` database table with ordering and cover flag
- Survey-number provenance: `OWNER_PROVIDED` or `CADASTRAL_API`
- A map-assisted cadastral lookup endpoint using `BHOOMISETU_CADASTRAL_API_URL`
- No guessed/fake survey numbers
- Public verified-land API now also exposes a `cover_photo_url` when photos exist

## Supabase

Run the complete `SUPABASE_SETUP.sql` in the Supabase SQL Editor. The appended section creates the storage bucket, photo table, policies and survey provenance columns.

## Cadastral provider

Set this server-side environment variable only when you have an authoritative cadastral service:

`BHOOMISETU_CADASTRAL_API_URL=`

The connector receives:

```json
{
  "latitude": 12.3,
  "longitude": 76.6,
  "geometry": null
}
```

It may return `surveyNumber` / `survey_number`, plus optional `source` and `reference` fields.

If the variable is empty, BhoomiSetu deliberately does not invent a survey number and asks the owner to enter it manually.
