import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

async function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new Error("Supabase is not configured.");
  const cookieStore = await cookies();
  const sb = createServerClient(url, key, {
    cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} },
  });
  const { data } = await sb.auth.getUser();
  const user = data.user;
  const role = user?.app_metadata?.role || user?.user_metadata?.role;
  const ownerEmails = new Set((process.env.BHOOMISETU_OWNER_EMAILS || "").split(",").map((x) => x.trim().toLowerCase()).filter(Boolean));
  if (!user || (role !== "admin" && role !== "owner" && !ownerEmails.has((user.email || "").toLowerCase()))) return null;
  return sb;
}

export async function GET() {
  const sb = await getAdminClient();
  if (!sb) return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  const { data, error } = await sb.from("lands").select("id,title,location,area,land_type,verified,verification_level,owner_id,survey_number,latitude,longitude,created_at").order("created_at", { ascending: false }).limit(200);
  if (error) return NextResponse.json({ error: error.message }, { status: 502 });
  return NextResponse.json({ lands: data || [] });
}

export async function PATCH(request: NextRequest) {
  const sb = await getAdminClient();
  if (!sb) return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  const body = await request.json().catch(() => null);
  const id = String(body?.id || "");
  const status = String(body?.status || "").toUpperCase();
  if (!id || !["VERIFIED", "REJECTED", "PENDING"].includes(status)) return NextResponse.json({ error: "Invalid verification update." }, { status: 400 });
  const { error } = await sb.from("lands").update({ verified: status === "VERIFIED", verification_level: status }).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 502 });
  return NextResponse.json({ success: true });
}
