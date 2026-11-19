import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

export type ViewerIdentity = { id: string | null; email: string | null; role: string | null; isOwner: boolean };

export async function getViewerIdentity(): Promise<ViewerIdentity> {
  const ownerEmails = new Set((process.env.BHOOMISETU_OWNER_EMAILS || "").split(",").map((email) => email.trim().toLowerCase()).filter(Boolean));
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return { id: null, email: null, role: null, isOwner: false };

  const cookieStore = await cookies();
  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() { return cookieStore.getAll(); },
      setAll(cookiesToSet) {
        try { cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options)); } catch {}
      },
    },
  });

  const { data: { user } } = await supabase.auth.getUser();
  const email = user?.email?.toLowerCase() || null;
  const role = (user?.app_metadata?.role as string | undefined) || (user?.user_metadata?.role as string | undefined) || null;
  return {
    id: user?.id || null,
    email,
    role,
    isOwner: Boolean(email && ownerEmails.has(email)) || role === "owner" || role === "admin",
  };
}
