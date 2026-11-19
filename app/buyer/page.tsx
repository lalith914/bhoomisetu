"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type Land = {
  id: string;
  title: string;
  location: string;
  area: string;
  land_type: string;
  asking_price: string | null;
  latitude: number | null;
  longitude: number | null;
  verified: boolean;
};

export default function BuyerPage() {
  const [query, setQuery] = useState("");
  const [type, setType] = useState("ALL");
  const [lands, setLands] = useState<Land[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/lands", { cache: "no-store" })
      .then(async (r) => {
        const data = await r.json();
        if (!r.ok) throw new Error(data.error || "Unable to load verified land.");
        return data;
      })
      .then((data) => setLands(Array.isArray(data.lands) ? data.lands : []))
      .catch((e) => setError(e instanceof Error ? e.message : "Unable to load land."))
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return lands.filter((land) => {
      const text = `${land.title} ${land.location} ${land.land_type}`.toLowerCase();
      return (!q || text.includes(q)) && (type === "ALL" || land.land_type === type);
    });
  }, [lands, query, type]);

  return (
    <main className="buyer-console">
      <header className="console-header">
        <Link href="/" className="console-wordmark">BHOOMI<span>SETU</span></Link>
        <nav>
          <Link className="active" href="/buyer">DISCOVER</Link>
          <Link href="/explore">MAP</Link>
          <Link href="/intelligence">INTELLIGENCE</Link>
          <Link href="/about">ABOUT</Link>
        </nav>
        <div className="console-status"><i /> VERIFIED LAND / LIVE <Link href="/account">ACCOUNT ↗</Link></div>
      </header>

      <section className="buyer-hero">
        <span>09 / LAND DISCOVERY</span>
        <h1>Find land<br/><em>with clarity.</em></h1>
        <p>Verified listings show only the information needed to decide whether a parcel is worth investigating further.</p>
      </section>

      <section className="buyer-toolbar">
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search location, district or land type" />
        <select value={type} onChange={(e) => setType(e.target.value)}>
          <option value="ALL">ALL LAND TYPES</option>
          <option value="AGRICULTURAL">AGRICULTURAL</option>
          <option value="COMMERCIAL">COMMERCIAL</option>
          <option value="RESIDENTIAL">RESIDENTIAL</option>
        </select>
        <button className="buyer-reset" onClick={() => { setQuery(""); setType("ALL"); }}>RESET</button>
      </section>

      <div className="buyer-result-meta"><span>{filtered.length} VERIFIED PARCELS</span></div>

      {error && <div className="buyer-empty">{error}</div>}
      {loading && <div className="buyer-empty">LOADING VERIFIED PARCELS…</div>}

      <section className="buyer-grid">
        {filtered.map((land) => (
          <article key={land.id}>
            <div className="buyer-visual">
              <span>{land.location}</span>
              <b>{land.area}</b>
              <small>{land.land_type}</small>
            </div>
            <div className="buyer-copy">
              <small>LAND LISTING</small>
              <h2>{land.title}</h2>
              <p>{land.location}</p>
              <div className="buyer-public-facts">
                <span><small>AREA</small><strong>{land.area}</strong></span>
                <span><small>PRICE</small><strong>{land.asking_price || "ON REQUEST"}</strong></span>
                <span><small>PURPOSE</small><strong>{land.land_type}</strong></span>
              </div>
              <div className="buyer-actions">
                <Link href={`/intelligence?parcel=${encodeURIComponent(land.id)}&lat=${land.latitude ?? ""}&lng=${land.longitude ?? ""}`}>
                  VIEW LAND ↗
                </Link>
                {land.latitude != null && land.longitude != null && (
                  <Link href={`/explore?lat=${land.latitude}&lng=${land.longitude}`}>MAP ↗</Link>
                )}
              </div>
            </div>
          </article>
        ))}
      </section>

      {!loading && !error && !filtered.length && <div className="buyer-empty">NO VERIFIED PARCELS MATCH THE CURRENT FILTER.</div>}
    </main>
  );
}
