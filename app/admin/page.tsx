"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type Land = {
  id: string;
  title: string;
  location: string;
  area: string;
  land_type: string;
  verified: boolean;
  verification_level: string | null;
  owner_id: string;
  survey_number: string | null;
  latitude: number | null;
  longitude: number | null;
};

export default function AdminPage() {
  const [rows, setRows] = useState<Land[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    try {
      const response = await fetch("/api/admin/lands", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Admin access required.");
      setRows(data.lands || []);
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to load verification queue.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function act(id: string, status: string) {
    const response = await fetch("/api/admin/lands", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status }),
    });
    const data = await response.json();
    if (!response.ok) {
      setError(data.error || "Unable to update verification.");
      return;
    }
    setRows((current) => current.map((row) => row.id === id ? { ...row, verified: status === "VERIFIED", verification_level: status } : row));
  }

  const pending = useMemo(() => rows.filter((r) => (r.verification_level || "PENDING") === "PENDING").length, [rows]);
  const verified = useMemo(() => rows.filter((r) => r.verified).length, [rows]);

  return <main className="admin-console">
    <header className="console-header"><Link href="/" className="console-wordmark">BHOOMI<span>SETU</span></Link><nav><Link href="/explore">EXPLORE</Link><Link href="/intelligence">INTELLIGENCE</Link><Link className="active" href="/admin">ADMIN</Link></nav><div className="console-status"><i/> VERIFICATION NODE / LIVE</div></header>
    <section className="admin-hero"><span>08 / ADMINISTRATOR / VERIFICATION</span><h1>Trust the<br/><em>parcel.</em></h1><p>Review the real land records submitted to your connected database. No seeded verification queue.</p></section>
    <section className="admin-stats"><div><span>PENDING</span><b>{pending}</b></div><div><span>VERIFIED</span><b>{verified}</b></div><div><span>RECORDS</span><b>{rows.length}</b></div><div><span>SYSTEM</span><b>{loading ? "SYNC" : error ? "ERROR" : "ONLINE"}</b></div></section>
    {error && <div className="buyer-empty">{error}</div>}
    <section className="verification-list">{rows.map((r) => <article className="verification-row" key={r.id}><div><small>{r.id}</small><h2>{r.title}</h2><p>{r.location} · {r.area} · {r.land_type} · SURVEY {r.survey_number || "—"}</p></div><div><span>OWNER</span><b>{r.owner_id.slice(0, 8)}…</b></div><div><span>STATUS</span><strong className={(r.verification_level || "pending").toLowerCase()}>{r.verification_level || "PENDING"}</strong></div><div className="verify-actions"><Link href={`/intelligence?parcel=${encodeURIComponent(r.id)}&lat=${r.latitude ?? ""}&lng=${r.longitude ?? ""}`}>OPEN ↗</Link>{(r.verification_level || "PENDING") === "PENDING" && <><button onClick={() => act(r.id, "VERIFIED")}>VERIFY</button><button onClick={() => act(r.id, "REJECTED")}>REJECT</button></>}</div></article>)}</section>
    {!loading && !rows.length && !error && <div className="buyer-empty">NO LAND SUBMISSIONS YET.</div>}
    <footer className="console-footer"><span>AUDIT TRAIL / ACTIVE</span><span>VERIFICATION DECISIONS ARE RECORDED</span><span>© 2026</span></footer>
  </main>;
}
