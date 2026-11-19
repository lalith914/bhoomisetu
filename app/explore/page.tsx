"use client";

import Link from "next/link";
import MapView from "@/components/MapView";
import EarthView from "@/components/EarthView";
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

const STATES = [
  "KARNATAKA",
  "MAHARASHTRA",
  "TELANGANA",
  "TAMIL NADU",
  "KERALA",
  "ANDHRA PRADESH",
];

function ExploreContent() {
  const params = useSearchParams();
  const lat = Number(params.get("lat"));
  const lng = Number(params.get("lng"));
  const focusLocation = Number.isFinite(lat) && Number.isFinite(lng)
    ? { lat, lng }
    : null;
  const [selectedState, setSelectedState] =
    useState<string | null>(null);

  const [mapMode, setMapMode] =
    useState<"MAP" | "SATELLITE" | "TERRAIN" | "EARTH">("MAP");
  const [landCount, setLandCount] = useState<number | null>(null);
  const [verifiedCount, setVerifiedCount] = useState<number | null>(null);

  useEffect(() => {
    fetch("/api/lands", { cache: "no-store" })
      .then((r) => r.ok ? r.json() : Promise.reject(new Error("Land feed unavailable")))
      .then((data) => {
        const lands = Array.isArray(data.lands) ? data.lands : [];
        setLandCount(lands.length);
        setVerifiedCount(lands.filter((land: any) => Boolean(land.verified)).length);
      })
      .catch(() => setLandCount(null));

    function handleState(event: Event) {
      const customEvent =
        event as CustomEvent<string>;

      if (customEvent.detail) {
        setSelectedState(
          customEvent.detail.toUpperCase()
        );
      }
    }

    window.addEventListener(
      "bs:state",
      handleState
    );

    return () => {
      window.removeEventListener(
        "bs:state",
        handleState
      );
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

  return (
    <main className="explore-page">
      {/* =====================================================
          HEADER
          ===================================================== */}

      <header className="explore-header">
        <Link
          href="/"
          className="explore-wordmark"
        >
          BHOOMI<span>SETU</span>
        </Link>

        <nav className="explore-nav">
          <Link
            href="/explore"
            className="explore-active"
          >
            EXPLORE
          </Link>

          <Link href="/intelligence">
            INTELLIGENCE
          </Link>

          <Link href="/about">
            ABOUT
          </Link>
        </nav>

        <div className="explore-auth">
          <Link href="/signin">
            SIGN IN
          </Link>

          <Link
            href="/account"
            className="explore-account"
          >
            ACCOUNT ↗
          </Link>
        </div>
      </header>

      {/* =====================================================
          MAIN MAP AREA
          ===================================================== */}

      <section className="explore-map-shell">

        {/* MAP */}

        <div className="explore-map" style={{ position: "absolute", inset: 0, zIndex: 1 }}>
          {mapMode === "EARTH" ? (
            <EarthView />
          ) : (
            <MapView mode={mapMode} focusLocation={focusLocation} />
          )}
        </div>

        {/* =================================================
            MAP MODE CONTROLS
            Fixed above every map/earth layer so they are always
            visible and clickable.
            ================================================= */}

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
                background:
                  mapMode === value
                    ? "#b8ff5a"
                    : "transparent",
                color:
                  mapMode === value
                    ? "#07100d"
                    : "rgba(235,243,237,.82)",
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

        {/* =================================================
            SELECTED REGION PANEL
            ================================================= */}

        {selectedState && (
          <aside className="explore-region-card">

          <div className="region-card-top">
            <span>SELECTED REGION</span>

            <span className="region-live">
              ● LIVE
            </span>
          </div>

          <div className="region-number">
            01
          </div>

          <h2>
            {selectedState}
          </h2>

          <p>
            Explore available land,
            verified properties and
            regional intelligence.
          </p>

          <div className="region-stats">

            <div>
              <small>
                INDEXED
              </small>

              <strong>
                {landCount ?? "—"}
              </strong>
            </div>

            <div>
              <small>
                VERIFIED
              </small>

              <strong>
                {verifiedCount !== null && landCount ? `${Math.round((verifiedCount / landCount) * 100)}%` : "—"}
              </strong>
            </div>

            <div>
              <small>
                DATA
              </small>

              <strong>
                LIVE
              </strong>
            </div>

          </div>

          <Link
            href="/intelligence"
            className="region-action"
          >
            VIEW INTELLIGENCE
            <span>↗</span>
          </Link>

          </aside>
        )}

      </section>

      {/* =====================================================
          STATE SELECTOR
          ===================================================== */}

      <section className="explore-states">

        <div className="states-heading">

          <div>
            <span>
              02 / REGIONS
            </span>

            <h2>
              Start
              <i> somewhere.</i>
            </h2>
          </div>

          <p>
            Select a region to move deeper
            into the BhoomiSetu map.
          </p>

        </div>

        <div className="state-grid">

          {STATES.map(
            (state, index) => (
              <button
                key={state}
                className={
                  selectedState === state
                    ? "state-card selected"
                    : "state-card"
                }
                onClick={() =>
                  selectState(state)
                }
              >

                <span className="state-index">
                  0{index + 1}
                </span>

                <span className="state-name">
                  {state}
                </span>

                <span className="state-arrow">
                  ↗
                </span>

              </button>
            )
          )}

        </div>

      </section>

      {/* =====================================================
          BOTTOM INTELLIGENCE STRIP
          ===================================================== */}

      <section className="explore-intelligence-strip">

        <div>
          <span>
            BHOOMISETU / MAP INTELLIGENCE
          </span>

          <h2>
            The map is only
            <i> the beginning.</i>
          </h2>
        </div>

        <p>
          Explore a location first.
          Then understand the land behind
          it — ownership, verification,
          satellite history and intelligence.
        </p>

        <Link href="/intelligence">
          EXPLORE INTELLIGENCE
          <span>↗</span>
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
