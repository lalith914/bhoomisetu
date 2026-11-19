# BhoomiSetu — Free Mode + Authentication Fix

This build keeps payment disabled while retaining the Razorpay API files for later activation.

## Included
- Supabase authentication with SSR session-refresh middleware.
- Create Account at `/signup`.
- Sign In at `/signin`.
- Authenticated role selection at `/choose-role`.
- Owner flow guarded before drawing/submission.
- Existing OwnerMap drawing code is preserved.
- Land details and boundaries are free.
- Satellite history is free.
- Intelligence access is free.
- Razorpay files are retained but not used by the free UI.

## Required environment variables
Create `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
SUPABASE_SECRET_KEY=
OPENAI_API_KEY=
```

Optional provider overrides used by the project can be added as documented in API_SETUP.md.

## Supabase
Run `SUPABASE_SETUP.sql` in the Supabase SQL editor if the database functions/policies are not already installed.

For immediate signup without email confirmation, configure Supabase Auth email confirmation according to your project requirements. If confirmation is enabled, signup will correctly tell the user to confirm their email before signing in.

## Run

```powershell
npm install
npm run build
npm run dev
```

Then open `http://localhost:3000`.

## Expected owner flow

Sign Up/Sign In → Choose Role → Owner → Draw Boundary → Submit Land → success message.

The project does not embed API secrets in the archive.
