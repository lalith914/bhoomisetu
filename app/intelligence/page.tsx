
"use client";

import Link from "next/link";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";

type Scene = {
  id: string;
  date: string | null;
  cloudCover: number;
  platform: string;
  thumbnail: string | null;
  visual?: string | null;
};

type PropertyPhoto = {
  public_url: string;
  sort_order: number;
  is_cover: boolean;
};

type Analysis = {
  summary?: string;
  soil?: { status?: string; evidence?: string; limitations?: string };
  water?: { status?: string; evidence?: string; limitations?: string };
  terrain?: { status?: string; evidence?: string; limitations?: string };
  vegetation?: { status?: string; evidence?: string; limitations?: string };
  agriculture?: { status?: string; evidence?: string; limitations?: string };
  scores?: {
    soil?: number | null;
    water?: number | null;
    terrain?: number | null;
    vegetation?: number | null;
    agriculture?: number | null;
    overall?: number | null;
  };
  risks?: string[];
  recommendedUses?: string[];
  confidence?: number;
};

type LandRecord = {
  title?: string;
  location?: string;
  area?: string;
  land_type?: string;
  listing_type?: "SELL" | "LEASE";
  lease_duration?: string | null;
  asking_price?: string | null;
  latitude?: number | string | null;
  longitude?: number | string | null;
};

function isValidCoordinatePair(lat: number | null, lng: number | null) {
  if (lat === null || lng === null) return false;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return false;

  // BhoomiSetu properties are in India.
  // Treat 0,0 as missing parcel coordinates.
  if (lat === 0 && lng === 0) return false;

  return true;
}

function IntelligenceContent() {
  const params = useSearchParams();

  const parcel = params.get("parcel") || params.get("id") || "";

  const latValue = params.get("lat");
  const lngValue = params.get("lng");

  const parsedUrlLat =
    latValue !== null && latValue.trim() !== ""
      ? Number(latValue)
      : null;

  const parsedUrlLng =
    lngValue !== null && lngValue.trim() !== ""
      ? Number(lngValue)
      : null;

  const urlCoordinatesValid = isValidCoordinatePair(
    parsedUrlLat,
    parsedUrlLng
  );

  const [year, setYear] = useState<number | null>(null);
  const [layer, setLayer] = useState("TRUE COLOR");
  const [scenes, setScenes] = useState<Scene[]>([]);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [soil, setSoil] = useState<any>(null);
  const [elevation, setElevation] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [asking, setAsking] = useState(false);
  const [landGeometry, setLandGeometry] = useState<any>(null);

  const [land, setLand] = useState<LandRecord | null>(null);
  const [propertyPhotos, setPropertyPhotos] = useState<PropertyPhoto[]>([]);
  const [landLoading, setLandLoading] = useState(false);
  const [landLoadError, setLandLoadError] = useState("");
  const [landFetched, setLandFetched] = useState(false);

  // Fetch the selected property before starting satellite analysis.
  useEffect(() => {
    if (!parcel || parcel.length < 10) {
      setLandFetched(true);
      return;
    }

    let active = true;

    setLandLoading(true);
    setLandFetched(false);
    setLandLoadError("");
    setLand(null);
    setPropertyPhotos([]);
    setLandGeometry(null);

    fetch(`/api/lands/${encodeURIComponent(parcel)}`, {
      cache: "no-store",
    })
      .then(async (response) => {
        const result = await response.json();

        if (!response.ok) {
          throw new Error(result.error || "Land record unavailable");
        }

        return result;
      })
      .then((result) => {
        if (!active) return;

        if (result.land) {
          setLand(result.land);
        }

        setPropertyPhotos(
          Array.isArray(result.photos) ? result.photos : []
        );

        if (result.geometry) {
          setLandGeometry(result.geometry);
        }
      })
      .catch((err) => {
        if (active) {
          setLandLoadError(
            err instanceof Error
              ? err.message
              : "Unable to load land details."
          );
        }
      })
      .finally(() => {
        if (active) {
          setLandLoading(false);
          setLandFetched(true);
        }
      });

    return () => {
      active = false;
    };
  }, [parcel]);

  // Prefer valid coordinates from the URL.
  // If the URL contains 0,0 or missing coordinates, use the saved land record.
  const savedLat =
    land?.latitude !== undefined && land?.latitude !== null
      ? Number(land.latitude)
      : null;

  const savedLng =
    land?.longitude !== undefined && land?.longitude !== null
      ? Number(land.longitude)
      : null;

  const savedCoordinatesValid = isValidCoordinatePair(
    savedLat,
    savedLng
  );

  const lat = urlCoordinatesValid
    ? parsedUrlLat
    : savedCoordinatesValid
      ? savedLat
      : null;

  const lng = urlCoordinatesValid
    ? parsedUrlLng
    : savedCoordinatesValid
      ? savedLng
      : null;

  // Run intelligence only after the land record has loaded.
  useEffect(() => {
    if (!landFetched) return;
    if (!isValidCoordinatePair(lat, lng)) {
      setScenes([]);
      setAnalysis(null);
      setError(
        "This property does not have valid coordinates. Please update its latitude and longitude."
      );
      return;
    }

    let active = true;

    setLoading(true);
    setError("");
    setScenes([]);
    setAnalysis(null);
    setYear(null);

    fetch("/api/intelligence", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        reportId: parcel || `parcel-${lat}-${lng}`,
        lat,
        lng,
        geometry: landGeometry,
      }),
      cache: "no-store",
    })
      .then(async (response) => {
        const data = await response.json();

        if (!response.ok) {
          throw new Error(
            data.error || "Unable to analyze this parcel."
          );
        }

        return data;
      })
      .then((data) => {
        if (!active) return;

        setScenes(Array.isArray(data.scenes) ? data.scenes : []);
        setAnalysis(data.analysis || null);
        setSoil(data.soil || null);
        setElevation(data.elevation ?? null);

        const firstYear = Number(
          String(data.scenes?.[0]?.date || "").slice(0, 4)
        );

        setYear(
          Number.isFinite(firstYear) && firstYear > 0
            ? firstYear
            : null
        );
      })
      .catch((err) => {
        if (active) {
          setError(
            err instanceof Error
              ? err.message
              : "Unable to analyze this parcel."
          );
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [lat, lng, landGeometry, parcel, landFetched]);

  const years = useMemo(
    () =>
      Array.from(
        new Set(
          scenes
            .map((scene) =>
              Number(String(scene.date || "").slice(0, 4))
            )
            .filter(
              (value) => Number.isFinite(value) && value > 0
            )
        )
      ).sort((a, b) => b - a),
    [scenes]
  );

  const selectedScene =
    scenes.find(
      (scene) =>
        Number(String(scene.date || "").slice(0, 4)) === year
    ) ||
    scenes[0] ||
    null;

  const score = analysis?.scores?.overall ?? null;

  const metrics = [
    ["SOIL", analysis?.scores?.soil, analysis?.soil?.status || "UNAVAILABLE"],
    ["WATER", analysis?.scores?.water, analysis?.water?.status || "UNAVAILABLE"],
    ["TERRAIN", analysis?.scores?.terrain, analysis?.terrain?.status || "UNAVAILABLE"],
    ["VEGETATION", analysis?.scores?.vegetation, analysis?.vegetation?.status || "UNAVAILABLE"],
    ["AGRICULTURE", analysis?.scores?.agriculture, analysis?.agriculture?.status || "UNAVAILABLE"],
  ] as const;

  async function askLand() {
    const cleanQuestion = question.trim();

    if (!cleanQuestion || !analysis || asking) return;

    setAsking(true);
    setAnswer("");

    try {
      const response = await fetch("/api/ask", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          reportId: parcel || `parcel-${lat}-${lng}`,
          question: cleanQuestion,
          analysis,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "AI request failed.");
      }

      setAnswer(result.answer || "No answer returned.");
    } catch (error) {
      setAnswer(
        error instanceof Error
          ? error.message
          : "AI request failed."
      );
    } finally {
      setAsking(false);
    }
  }

  return (
    <main className="intel-console">
      <header className="console-header">
        <Link href="/" className="console-wordmark">
          BHOOMI<span>SETU</span>
        </Link>

        <nav>
          <Link href="/explore">EXPLORE</Link>
          <Link className="active" href="/intelligence">
            INTELLIGENCE
          </Link>
          <Link href="/about">ABOUT</Link>
        </nav>

        <div className="console-status">
          <i /> SATELLITE LINK / ONLINE
          <Link href="/account">ACCOUNT ↗</Link>
        </div>
      </header>

      <section className="intel-top">
        <div>
          <span className="console-kicker">
            02 / LAND INTELLIGENCE / {parcel || "SELECT A PARCEL"}
          </span>

          <h1>
            Read the
            <br />
            <em>land.</em>
          </h1>

          <p>
            Real satellite acquisitions, geospatial data and
            evidence-backed AI interpretation.
          </p>
        </div>

        <div className="intel-coords">
          <span>WGS 84</span>
          <b>
            {lat !== null ? `${lat.toFixed(5)}° N` : "—"}
          </b>
          <b>
            {lng !== null ? `${lng.toFixed(5)}° E` : "—"}
          </b>
          <span>LIVE PARCEL ANALYSIS</span>
        </div>
      </section>

      {landLoading && (
        <section className="intel-empty-state">
          <span>LOADING PROPERTY</span>
          <h2>Retrieving land details.</h2>
          <p>
            Loading the selected property and its owner-uploaded photographs.
          </p>
        </section>
      )}

      {!landLoading && (lat === null || lng === null) ? (
        <section className="intel-empty-state">
          <span>NO VALID PARCEL SELECTED</span>
          <h2>Start from the map.</h2>
          <p>
            Select a property from Explore. If the selected property
            has no saved coordinates, update its land record before
            running satellite analysis.
          </p>
          <Link href="/explore" className="console-action">
            OPEN EXPLORE <span>↗</span>
          </Link>
        </section>
      ) : !landLoading && lat !== null && lng !== null ? (
        <>
          {/* PROPERTY LISTING DETAILS */}
          <section className="public-land-card">
            <span>PUBLIC LAND LISTING</span>

            <h2>{land?.title || parcel || "Selected land"}</h2>

            <div
              style={{
                display: "inline-flex",
                margin: "12px 0 20px",
                padding: "9px 14px",
                background:
                  land?.listing_type === "LEASE"
                    ? "#d7c49a"
                    : "#b8ff5a",
                color: "#07100d",
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: ".12em",
              }}
            >
              {land?.listing_type === "LEASE"
                ? "AVAILABLE FOR LEASE"
                : "AVAILABLE FOR SALE"}
            </div>

            <div className="public-land-facts">
              <div>
                <small>LOCATION</small>
                <strong>
                  {land?.location ||
                    `${lat.toFixed(5)}° N / ${lng.toFixed(5)}° E`}
                </strong>
              </div>

              <div>
                <small>AREA</small>
                <strong>{land?.area || "—"}</strong>
              </div>

              <div>
                <small>
                  {land?.listing_type === "LEASE"
                    ? "LEASE AMOUNT"
                    : "ASKING PRICE"}
                </small>
                <strong>{land?.asking_price || "ON REQUEST"}</strong>
              </div>

              <div>
                <small>PURPOSE</small>
                <strong>{land?.land_type || "—"}</strong>
              </div>

              {land?.listing_type === "LEASE" && (
                <div>
                  <small>LEASE DURATION</small>
                  <strong>
                    {land.lease_duration || "Not specified"}
                  </strong>
                </div>
              )}
            </div>
          </section>

          {/* OWNER-UPLOADED PROPERTY PHOTOS */}
          <section
            style={{
              padding: "42px 0",
              borderBottom: "1px solid rgba(255,255,255,.12)",
            }}
          >
            <div className="section-heading">
              <div>
                <span>PROPERTY / OWNER PHOTOGRAPHS</span>
                <h2>
                  See the <i>property.</i>
                </h2>
              </div>

              <p>
                Actual photographs uploaded by the property owner.
              </p>
            </div>

            {landLoadError ? (
              <p style={{ color: "#ff9c8e", padding: "20px 0" }}>
                {landLoadError}
              </p>
            ) : propertyPhotos.length > 0 ? (
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns:
                    "repeat(auto-fill,minmax(min(100%,260px),1fr))",
                  gap: 16,
                  marginTop: 24,
                }}
              >
                {propertyPhotos.map((photo, index) => (
                  <a
                    key={`${photo.public_url}-${index}`}
                    href={photo.public_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      position: "relative",
                      display: "block",
                      overflow: "hidden",
                      background: "#14221a",
                      aspectRatio: "4 / 3",
                    }}
                  >
                    <img
                      src={photo.public_url}
                      alt={`Owner property photo ${index + 1}`}
                      loading="lazy"
                      style={{
                        width: "100%",
                        height: "100%",
                        objectFit: "cover",
                        display: "block",
                        transition: "transform .3s ease",
                      }}
                    />

                    {photo.is_cover && (
                      <span
                        style={{
                          position: "absolute",
                          left: 12,
                          top: 12,
                          background: "#b8ff5a",
                          color: "#07100d",
                          padding: "8px 10px",
                          fontSize: 9,
                          fontWeight: 700,
                          letterSpacing: ".12em",
                        }}
                      >
                        COVER PHOTO
                      </span>
                    )}
                  </a>
                ))}
              </div>
            ) : (
              <div
                style={{
                  marginTop: 20,
                  padding: "36px 20px",
                  border: "1px solid rgba(255,255,255,.14)",
                  color: "#a8b3a9",
                  fontSize: 12,
                  textAlign: "center",
                }}
              >
                NO OWNER PHOTOGRAPHS AVAILABLE FOR THIS PROPERTY
              </div>
            )}
          </section>

          {error && (
            <section className="intel-error">
              <span>INTELLIGENCE ENGINE</span>
              <strong>{error}</strong>
              <p>
                Check the parcel coordinates and satellite/AI provider
                configuration, then try again.
              </p>
            </section>
          )}

          <section className="intel-visual-grid">
            <div className="satellite-stage">
              <div className="stage-top">
                <span>LAND / TEMPORAL SATELLITE</span>
                <span>
                  {loading
                    ? "ACQUIRING…"
                    : selectedScene
                      ? "DATA READY"
                      : "NO SCENE"}
                </span>
              </div>

              <div
                className={`satellite-art layer-${layer
                  .replaceAll(" ", "-")
                  .toLowerCase()}`}
              >
                {selectedScene?.thumbnail ? (
                  <img
                    src={selectedScene.thumbnail}
                    alt={`Sentinel-2 scene for ${parcel || "parcel"}`}
                  />
                ) : (
                  <div className="satellite-unavailable">
                    SATELLITE PREVIEW UNAVAILABLE
                  </div>
                )}

                <div className="scanline" />

                <div className="crosshair">
                  <span />
                  <span />
                </div>

                <div className="scene-meta">
                  <span>{selectedScene?.platform || "—"}</span>
                  <span>{selectedScene?.date || "—"}</span>
                  <span>
                    {selectedScene
                      ? `CLOUD ${selectedScene.cloudCover.toFixed(1)}%`
                      : "—"}
                  </span>
                </div>
              </div>

              <div className="layer-rail">
                {[
                  "TRUE COLOR",
                  "NDVI",
                  "NDWI",
                  "NIR",
                  "TERRAIN",
                ].map((value) => (
                  <button
                    key={value}
                    className={layer === value ? "selected" : ""}
                    onClick={() => setLayer(value)}
                  >
                    {value}
                  </button>
                ))}
              </div>

              <div className="satellite-note">
                True-color imagery is sourced from the selected
                Sentinel-2 acquisition. Derived spectral layers
                require the connected raster-processing provider.
              </div>
            </div>

            <aside className="intel-side">
              <div className="side-section">
                <span>LAND PROFILE</span>
                <strong>{parcel || "SELECTED PARCEL"}</strong>
                <small>
                  {lat.toFixed(5)}° / {lng.toFixed(5)}° ·
                  ELEVATION {elevation ?? "—"} M
                </small>
              </div>

              <div className="score-readout">
                <span>LAND INTELLIGENCE SCORE</span>
                <b>{score ?? "—"}</b>

                <div className="score-line">
                  <i
                    style={{
                      width: `${Math.max(
                        0,
                        Math.min(100, Number(score || 0))
                      )}%`,
                    }}
                  />
                </div>
              </div>

              <div className="metric-list">
                {metrics.map(([name, value, note]) => (
                  <div key={name}>
                    <span>{name}</span>
                    <b>{value ?? "—"}</b>
                    <em>{note}</em>
                  </div>
                ))}
              </div>

              <Link
                href={`/report?id=${encodeURIComponent(
                  parcel || `${lat},${lng}`
                )}&lat=${lat}&lng=${lng}`}
                className="console-action"
              >
                GENERATE FULL LAND REPORT <span>↗</span>
              </Link>
            </aside>
          </section>

          <section className="temporal-section">
            <div className="section-heading">
              <div>
                <span>03 / TEMPORAL ANALYSIS</span>
                <h2>Land over time.</h2>
              </div>

              <p>
                Historical Sentinel-2 acquisitions for the selected
                parcel. Cloud cover is shown from the source metadata.
              </p>
            </div>

            <div className="timeline-meta">
              <strong>{year ?? "—"}</strong>
              <span>{selectedScene?.date || "—"}</span>
              <span>{selectedScene?.platform || "—"}</span>
              <span>
                {selectedScene
                  ? `${selectedScene.cloudCover.toFixed(1)}% CLOUD`
                  : "—"}
              </span>
            </div>

            <div className="year-rail">
              {years.map((value) => (
                <button
                  key={value}
                  className={year === value ? "active" : ""}
                  onClick={() => setYear(value)}
                >
                  {value}
                </button>
              ))}
            </div>

            {years.length > 1 && (
              <input
                className="temporal-slider"
                type="range"
                min={Math.min(...years)}
                max={Math.max(...years)}
                step="1"
                value={year ?? years[0]}
                onChange={(e) => setYear(Number(e.target.value))}
              />
            )}

            <div className="change-strip">
              <div>
                <span>SCENES FOUND</span>
                <b>{scenes.length}</b>
              </div>

              <div>
                <span>BEST CLOUD COVER</span>
                <b>
                  {scenes.length
                    ? `${Math.min(
                        ...scenes.map((scene) => scene.cloudCover)
                      ).toFixed(1)}%`
                    : "—"}
                </b>
              </div>

              <div>
                <span>EARLIEST SCENE</span>
                <b>{years.length ? Math.min(...years) : "—"}</b>
              </div>

              <div>
                <span>CONFIDENCE</span>
                <b>{analysis?.confidence ?? "—"}</b>
              </div>
            </div>
          </section>

          <section className="analysis-grid">
            <div className="analysis-panel">
              <span>04 / EVIDENCE</span>
              <h3>What the land says.</h3>

              <p>
                {analysis?.summary ||
                  "Waiting for the connected intelligence engine."}
              </p>

              <div className="evidence-list">
                {[
                  ["SOIL", analysis?.soil],
                  ["WATER", analysis?.water],
                  ["TERRAIN", analysis?.terrain],
                  ["VEGETATION", analysis?.vegetation],
                  ["AGRICULTURE", analysis?.agriculture],
                ].map(([name, item]) => (
                  <div key={String(name)}>
                    <strong>{String(name)}</strong>
                    <span>
                      {(item as any)?.evidence || "Unavailable"}
                    </span>
                    <small>
                      {(item as any)?.limitations || ""}
                    </small>
                  </div>
                ))}
              </div>
            </div>

            <div className="analysis-panel">
              <span>05 / ASK BHOOMISETU</span>
              <h3>Ask this land.</h3>

              <div className="ask-row">
                <input
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      askLand();
                    }
                  }}
                  placeholder="Ask about this parcel…"
                />

                <button
                  onClick={askLand}
                  disabled={
                    asking || !question.trim() || !analysis
                  }
                >
                  {asking ? "THINKING..." : "ASK ↗"}
                </button>
              </div>

              {answer && (
                <div className="ai-answer">
                  <small>GEOINTELLIGENCE ENGINE</small>
                  {answer}
                </div>
              )}

              <div className="risk-box">
                <small>RISKS / LIMITATIONS</small>

                {(analysis?.risks || []).length ? (
                  analysis?.risks?.map((risk) => (
                    <p key={risk}>{risk}</p>
                  ))
                ) : (
                  <p>No AI risk list returned.</p>
                )}
              </div>
            </div>
          </section>

          <section className="compare-section">
            <div className="section-heading">
              <div>
                <span>06 / RECOMMENDED USE</span>
                <h2>Use the evidence.</h2>
              </div>

              <p>
                Recommendations are AI interpretations of the supplied
                geospatial evidence, not a substitute for survey,
                soil testing, title verification or professional advice.
              </p>
            </div>

            <div className="recommended-grid">
              {(analysis?.recommendedUses || []).map((use) => (
                <div key={use}>
                  <span>RECOMMENDED</span>
                  <b>{use}</b>
                </div>
              ))}
            </div>

            <div className="data-provenance">
              <span>DATA PROVENANCE</span>
              <p>
                Sentinel-2 discovery: Element84 Earth Search ·
                Soil profile: configured SoilGrids-compatible provider ·
                Elevation: Open-Meteo · Interpretation: configured
                OpenAI model.
              </p>
            </div>
          </section>
        </>
      ) : null}

      <footer className="console-footer">
        <span>BHOOMISETU / LAND INTELLIGENCE SYSTEM</span>
        <span>GEOINT · TERRAIN · AGRICULTURE · SATELLITE</span>
        <span>© 2026</span>
      </footer>
    </main>
  );
}

export default function IntelligencePage() {
  return (
    <Suspense fallback={<main className="intel-console" />}>
      <IntelligenceContent />
    </Suspense>
  );
}
