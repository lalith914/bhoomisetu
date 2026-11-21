
"use client";

import Link from "next/link";
import MapView from "@/components/MapView";
import EarthView from "@/components/EarthView";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";

const STATES = [
  "KARNATAKA",
  "MAHARASHTRA",
  "TELANGANA",
  "TAMIL NADU",
  "KERALA",
  "ANDHRA PRADESH",
];

type ListingType = "ALL" | "SELL" | "LEASE";

type LandListing = {
  id: string;
  title: string;
  location: string;
  area: string;
  land_type: string;
  listing_type: "SELL" | "LEASE";
  lease_duration: string | null;
  asking_price: string | null;
  latitude: number;
  longitude: number;
  verified: boolean;
  cover_photo_url: string | null;
};

function ExploreContent() {
  const params = useSearchParams();

  const lat = Number(params.get("lat"));
  const lng = Number(params.get("lng"));

  const focusLocation =
    Number.isFinite(lat) && Number.isFinite(lng)
      ? { lat, lng }
      : null;

  const [selectedState, setSelectedState] = useState<string | null>(null);

  const [mapMode, setMapMode] = useState<
    "MAP" | "SATELLITE" | "TERRAIN" | "EARTH"
  >("MAP");

  const [listingFilter, setListingFilter] = useState<ListingType>("ALL");
  const [lands, setLands] = useState<LandListing[]>([]);
  const [loadingLands, setLoadingLands] = useState(true);
  const [landError, setLandError] = useState("");

  const [landCount, setLandCount] = useState<number | null>(null);
  const [verifiedCount, setVerifiedCount] = useState<number | null>(null);

  useEffect(() => {
    let active = true;

    fetch("/api/lands", { cache: "no-store" })
      .then((response) => {
        if (!response.ok) {
          throw new Error("Land feed unavailable");
        }
        return response.json();
      })
      .then((data) => {
        if (!active) return;

        const listings = Array.isArray(data.lands) ? data.lands : [];

        setLands(listings);
        setLandCount(listings.length);
        setVerifiedCount(
          listings.filter((land: LandListing) => Boolean(land.verified)).length
        );
        setLandError("");
      })
      .catch((error) => {
        if (!active) return;
        setLandError(error.message || "Unable to load properties.");
        setLandCount(null);
      })
      .finally(() => {
        if (active) setLoadingLands(false);
      });

    function handleState(event: Event) {
      const customEvent = event as CustomEvent<string>;

      if (customEvent.detail) {
        setSelectedState(customEvent.detail.toUpperCase());
      }
    }

    window.addEventListener("bs:state", handleState);

    return () => {
      active = false;
      window.removeEventListener("bs:state", handleState);
    };
  }, []);

  function selectState(state: string) {
    setSelectedState(state);

    window.dispatchEvent(
      new CustomEvent("bs:state", {
        detail: state,
      })
    );
  }

  const visibleLands = useMemo(() => {
    return lands.filter((land) => {
      const matchesListing =
        listingFilter === "ALL" ||
        land.listing_type === listingFilter;

      const matchesState =
        !selectedState ||
        land.location?.toUpperCase().includes(selectedState);

      return matchesListing && matchesState;
    });
  }, [lands, listingFilter, selectedState]);

  return (
    <main className="explore-page">
      <header className="explore-header">
        <Link href="/" className="explore-wordmark">
          BHOOMI<span>SETU</span>
        </Link>

        <nav className="explore-nav">
          <Link href="/explore" className="explore-active">
            EXPLORE
          </Link>
          <Link href="/intelligence">INTELLIGENCE</Link>
          <Link href="/about">ABOUT</Link>
        </nav>

        <div className="explore-auth">
          <Link href="/signin">SIGN IN</Link>
          <Link href="/account" className="explore-account">
            ACCOUNT ↗
          </Link>
        </div>
      </header>

      {/* MAP */}
      <section className="explore-map-shell">
        <div
          className="explore-map"
          style={{ position: "absolute", inset: 0, zIndex: 1 }}
        >
          {mapMode === "EARTH" ? (
            <EarthView />
          ) : (
            <MapView mode={mapMode} focusLocation={focusLocation} />
          )}
        </div>

        {/* MAP MODE CONTROLS */}
        <div
          className="explore-floating-controls"
          role="tablist"
          aria-label="Explore map modes"
          style={{
            position: "fixed",
            top: 104,
            right: 24,
            zIndex: 2147483647,
            display: "flex",
            alignItems: "center",
            gap: 3,
            padding: 4,
            background: "rgba(2,7,5,.96)",
            border: "1px solid rgba(220,240,225,.24)",
            borderRadius: 4,
            boxShadow: "0 14px 40px rgba(0,0,0,.42)",
            backdropFilter: "blur(18px)",
          }}
        >
          {([
            ["MAP", "MAP"],
            ["SATELLITE", "SATELLITE"],
            ["TERRAIN", "TERRAIN"],
            ["EARTH", "3D EARTH"],
          ] as const).map(([value, label]) => (
            <button
              key={value}
              type="button"
              role="tab"
              aria-selected={mapMode === value}
              onClick={() => setMapMode(value)}
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                height: 30,
                padding: "0 11px",
                border: 0,
                borderRadius: 2,
                background: mapMode === value ? "#b8ff5a" : "transparent",
                color: mapMode === value ? "#07100d" : "rgba(235,243,237,.82)",
                font: '400 7px/1 "DM Mono", monospace',
                letterSpacing: ".12em",
                cursor: "pointer",
                whiteSpace: "nowrap",
              }}
            >
              {label}
            </button>
          ))}
        </div>

        {/* REGION PANEL */}
        {selectedState && (
          <aside className="explore-region-card">
            <div className="region-card-top">
              <span>SELECTED REGION</span>
              <span className="region-live">● LIVE</span>
            </div>

            <div className="region-number">01</div>
            <h2>{selectedState}</h2>

            <p>
              Explore available land, verified properties and regional intelligence.
            </p>

            <div className="region-stats">
              <div>
                <small>INDEXED</small>
                <strong>{landCount ?? "—"}</strong>
              </div>

              <div>
                <small>VERIFIED</small>
                <strong>
                  {verifiedCount !== null && landCount
                    ? `${Math.round((verifiedCount / landCount) * 100)}%`
                    : "—"}
                </strong>
              </div>

              <div>
                <small>DATA</small>
                <strong>LIVE</strong>
              </div>
            </div>

            <Link href="/intelligence" className="region-action">
              VIEW INTELLIGENCE <span>↗</span>
            </Link>
          </aside>
        )}
      </section>

      {/* PROPERTY LISTINGS */}
      <section
        className="explore-listings"
        style={{
          padding: "72px 6%",
          background: "#07100d",
          color: "#edf2e9",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "end",
            flexWrap: "wrap",
            gap: 24,
            marginBottom: 32,
          }}
        >
          <div>
            <span
              style={{
                fontSize: 10,
                letterSpacing: ".18em",
                color: "#b8ff5a",
              }}
            >
              02 / VERIFIED PROPERTY MARKETPLACE
            </span>

            <h2
              style={{
                fontSize: "clamp(32px,5vw,58px)",
                fontWeight: 400,
                margin: "12px 0 0",
                lineHeight: 1.05,
              }}
            >
              Find your <i>land.</i>
            </h2>

            <p style={{ color: "#a8b3a9", marginTop: 12 }}>
              Discover verified properties available for sale and lease.
            </p>
          </div>

          <div style={{ color: "#a8b3a9", fontSize: 12 }}>
            {loadingLands ? "LOADING PROPERTIES..." : `${visibleLands.length} PROPERTIES`}
          </div>
        </div>

        {/* FILTERS */}
        <div
          style={{
            display: "flex",
            gap: 10,
            flexWrap: "wrap",
            marginBottom: 32,
          }}
        >
          {([
            ["ALL", "ALL LISTINGS"],
            ["SELL", "FOR SALE"],
            ["LEASE", "FOR LEASE"],
          ] as [ListingType, string][]).map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setListingFilter(value)}
              aria-pressed={listingFilter === value}
              style={{
                padding: "12px 20px",
                border: listingFilter === value
                  ? "1px solid #b8ff5a"
                  : "1px solid rgba(255,255,255,.2)",
                background: listingFilter === value
                  ? "#b8ff5a"
                  : "transparent",
                color: listingFilter === value ? "#07100d" : "#edf2e9",
                cursor: "pointer",
                fontSize: 10,
                letterSpacing: ".12em",
              }}
            >
              {label}
            </button>
          ))}
        </div>

        {landError && (
          <p style={{ color: "#ff9c8e" }}>{landError}</p>
        )}

        {!loadingLands && !landError && visibleLands.length === 0 && (
          <div
            style={{
              padding: "48px 20px",
              border: "1px solid rgba(255,255,255,.14)",
              textAlign: "center",
            }}
          >
            <h3 style={{ fontWeight: 400 }}>No properties found.</h3>
            <p style={{ color: "#a8b3a9", marginTop: 10 }}>
              Try another listing filter or region.
            </p>
          </div>
        )}

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill,minmax(min(100%,280px),1fr))",
            gap: 22,
          }}
        >
          {visibleLands.map((land) => (
            <article
              key={land.id}
              style={{
                border: "1px solid rgba(255,255,255,.14)",
                background: "#0d1914",
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  height: 220,
                  position: "relative",
                  background: "#17251d",
                }}
              >
                {land.cover_photo_url ? (
                  <img
                    src={land.cover_photo_url}
                    alt={land.title}
                    loading="lazy"
                    style={{
                      width: "100%",
                      height: "100%",
                      objectFit: "cover",
                      display: "block",
                    }}
                  />
                ) : (
                  <div
                    style={{
                      height: "100%",
                      display: "grid",
                      placeItems: "center",
                      color: "#8d9c8e",
                      fontSize: 11,
                      letterSpacing: ".14em",
                    }}
                  >
                    PROPERTY IMAGE NOT AVAILABLE
                  </div>
                )}

                <span
                  style={{
                    position: "absolute",
                    top: 14,
                    left: 14,
                    padding: "9px 12px",
                    background: land.listing_type === "LEASE" ? "#d7c49a" : "#b8ff5a",
                    color: "#07100d",
                    fontSize: 9,
                    letterSpacing: ".12em",
                    fontWeight: 700,
                  }}
                >
                  {land.listing_type === "LEASE" ? "FOR LEASE" : "FOR SALE"}
                </span>
              </div>

              <div style={{ padding: 22 }}>
                <span
                  style={{
                    color: "#b8ff5a",
                    fontSize: 9,
                    letterSpacing: ".15em",
                  }}
                >
                  {land.land_type || "LAND"}
                </span>

                <h3
                  style={{
                    fontSize: 22,
                    fontWeight: 400,
                    margin: "10px 0",
                  }}
                >
                  {land.title}
                </h3>

                <p style={{ color: "#a8b3a9", fontSize: 12 }}>
                  {land.location}
                </p>

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: 16,
                    marginTop: 22,
                    paddingTop: 18,
                    borderTop: "1px solid rgba(255,255,255,.12)",
                  }}
                >
                  <div>
                    <small style={{ color: "#829084" }}>AREA</small>
                    <strong style={{ display: "block", marginTop: 6 }}>
                      {land.area || "—"}
                    </strong>
                  </div>

                  <div>
                    <small style={{ color: "#829084" }}>
                      {land.listing_type === "LEASE" ? "LEASE AMOUNT" : "ASKING PRICE"}
                    </small>
                    <strong style={{ display: "block", marginTop: 6 }}>
                      {land.asking_price || "ON REQUEST"}
                    </strong>
                  </div>
                </div>

                {land.listing_type === "LEASE" && (
                  <p style={{ color: "#d7c49a", fontSize: 12, marginTop: 16 }}>
                    Duration: {land.lease_duration || "Not specified"}
                  </p>
                )}

                <Link
                  href={`/intelligence?parcel=${encodeURIComponent(land.id)}&lat=${land.latitude}&lng=${land.longitude}`}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginTop: 22,
                    padding: "14px 0",
                    borderTop: "1px solid rgba(255,255,255,.12)",
                    color: "#b8ff5a",
                    fontSize: 10,
                    letterSpacing: ".12em",
                    textDecoration: "none",
                  }}
                >
                  VIEW LAND INTELLIGENCE <span>↗</span>
                </Link>
              </div>
            </article>
          ))}
        </div>
      </section>

      {/* REGIONS */}
      <section className="explore-states">
        <div className="states-heading">
          <div>
            <span>03 / REGIONS</span>
            <h2>
              Start
              <i> somewhere.</i>
            </h2>
          </div>

          <p>
            Select a region to move deeper into the BhoomiSetu map.
          </p>
        </div>

        <div className="state-grid">
          {STATES.map((state, index) => (
            <button
              key={state}
              className={
                selectedState === state
                  ? "state-card selected"
                  : "state-card"
              }
              onClick={() => selectState(state)}
            >
              <span className="state-index">0{index + 1}</span>
              <span className="state-name">{state}</span>
              <span className="state-arrow">↗</span>
            </button>
          ))}
        </div>
      </section>

      {/* INTELLIGENCE STRIP */}
      <section className="explore-intelligence-strip">
        <div>
          <span>BHOOMISETU / MAP INTELLIGENCE</span>
          <h2>
            The map is only
            <i> the beginning.</i>
          </h2>
        </div>

        <p>
          Explore a location first. Then understand the land behind it —
          ownership, verification, satellite history and intelligence.
        </p>

        <Link href="/intelligence">
          EXPLORE INTELLIGENCE <span>↗</span>
        </Link>
      </section>
    </main>
  );
}

export default function ExplorePage() {
  return (
    <Suspense fallback={null}>
      <ExploreContent />
    </Suspense>
  );
}
