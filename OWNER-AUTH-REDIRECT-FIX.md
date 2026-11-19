# Owner route authentication fix

- Enabled persistent Supabase browser sessions, automatic token refresh, and PKCE callback detection.
- Updated the Owner route guard to validate the user, attempt one session refresh, and only redirect after both checks fail.
- Applied the same refresh fallback to role selection.
- Updated sign-in to verify the authenticated user before navigating and preserve a safe `next` destination.

## Deployment configuration
Set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (preferred) or `NEXT_PUBLIC_SUPABASE_ANON_KEY` in Vercel/local environment. In Supabase Auth URL Configuration, add your deployed domain to the allowed Redirect URLs and add `http://localhost:3000/**` for local development. Never expose a service-role key in a `NEXT_PUBLIC_*` variable.

This code addresses transient browser-session restoration and stale-token refresh. Successful authentication still requires valid Supabase credentials, allowed redirect URLs, and a valid account.
