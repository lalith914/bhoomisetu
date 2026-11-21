
"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import OwnerMap from "@/components/OwnerMap/OwnerMap";
import { getSupabase } from "@/lib/supabase";
import type { Session } from "@supabase/supabase-js";

type BoundaryGeoJSON = GeoJSON.Feature<GeoJSON.Polygon>;
type ListingType = "SELL" | "LEASE";

export default function OwnerPage() {
  const router = useRouter();

  const [title, setTitle] = useState("");
  const [location, setLocation] = useState("");
  const [area, setArea] = useState("");
  const [landType, setLandType] = useState("AGRICULTURAL");
  const [listingType, setListingType] = useState<ListingType>("SELL");
  const [price, setPrice] = useState("");
  const [leaseDuration, setLeaseDuration] = useState("");
  const [description, setDescription] = useState("");
  const [surveyNumber, setSurveyNumber] = useState("");
  const [surveySource, setSurveySource] = useState<"OWNER_PROVIDED" | "CADASTRAL_API">("OWNER_PROVIDED");
  const [surveyLookup, setSurveyLookup] = useState(false);
  const [surveyLookupMessage, setSurveyLookupMessage] = useState("");
  const [cadastralReference, setCadastralReference] = useState("");
  const [propertyPhotos, setPropertyPhotos] = useState<File[]>([]);
  const [photoPreviews, setPhotoPreviews] = useState<string[]>([]);
  const [latitude, setLatitude] = useState("");
  const [longitude, setLongitude] = useState("");

  const [boundary, setBoundary] = useState<BoundaryGeoJSON | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    const urls = propertyPhotos.map((file) => URL.createObjectURL(file));
    setPhotoPreviews(urls);
    return () => urls.forEach((url) => URL.revokeObjectURL(url));
  }, [propertyPhotos]);

  useEffect(() => {
    let active = true;
    const sb = getSupabase();

    if (!sb) {
      setError("Supabase is not configured. Check your .env.local file.");
      return;
    }

    sb.auth.getSession().then(({ data }: { data: { session: Session | null } }) => {
      if (!active) return;
      if (!data.session) router.replace("/signin?next=/owner");
    });

    return () => {
      active = false;
    };
  }, [router]);

  const parsedLocation =
    Number.isFinite(Number(latitude)) &&
    Number.isFinite(Number(longitude)) &&
    latitude.trim() !== "" &&
    longitude.trim() !== "" &&
    Math.abs(Number(latitude)) <= 90 &&
    Math.abs(Number(longitude)) <= 180
      ? { lat: Number(latitude), lng: Number(longitude) }
      : null;

  async function lookupSurveyNumber() {
    setSurveyLookupMessage("");

    if (!parsedLocation) {
      setSurveyLookupMessage("Enter valid latitude and longitude first.");
      return;
    }

    setSurveyLookup(true);

    try {
      const response = await fetch("/api/cadastral", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          latitude: parsedLocation.lat,
          longitude: parsedLocation.lng,
          geometry: boundary,
        }),
      });

      const result = await response.json();

      if (!response.ok) throw new Error(result?.error || "Survey lookup failed.");

      if (result.status === "not_configured") {
        setSurveyLookupMessage("Official cadastral source is not connected. Enter the survey number manually.");
        return;
      }

      if (!result.surveyNumber) {
        setSurveyLookupMessage("No authoritative survey number was returned for this location.");
        return;
      }

      setSurveyNumber(result.surveyNumber);
      setSurveySource("CADASTRAL_API");
      setCadastralReference(result.reference || "");
      setSurveyLookupMessage(`Cadastral survey number found${result.source ? ` · ${result.source}` : ""}.`);
    } catch (e: any) {
      setSurveyLookupMessage(e?.message || "Unable to query the cadastral source.");
    } finally {
      setSurveyLookup(false);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");

    if (!price.trim()) {
      setError(listingType === "SELL" ? "Please enter the expected selling price." : "Please enter the expected lease amount.");
      return;
    }

    if (listingType === "LEASE" && !leaseDuration.trim()) {
      setError("Please enter the lease duration.");
      return;
    }

    if (!boundary) {
      setError("Please draw the exact land boundary on the map before submitting.");
      return;
    }

    const coordinates = boundary.geometry.coordinates[0];

    if (!coordinates || coordinates.length < 4) {
      setError("The boundary is incomplete. Please draw the property again.");
      return;
    }

    const sb = getSupabase();

    if (!sb) {
      setError("Supabase is not configured. Check your .env.local file.");
      return;
    }

    setSaving(true);

    try {
      const {
        data: { user },
      } = await sb.auth.getUser();

      if (!user) {
        throw new Error("Your Supabase session expired. Please sign in again before submitting the property.");
      }

      const polygonCoordinates = coordinates
        .map(([lng, lat]) => `${lng} ${lat}`)
        .join(",");

      const polygonWKT = `POLYGON((${polygonCoordinates}))`;

      const firstPoint = coordinates[0];
      const landLongitude = firstPoint[0];
      const landLatitude = firstPoint[1];

      const { data: land, error: landError } = await sb
        .from("lands")
        .insert({
          title: title.trim(),
          location: location.trim(),
          area: area.trim(),
          land_type: landType,
          listing_type: listingType,
          lease_duration: listingType === "LEASE" ? leaseDuration.trim() : null,
          latitude: landLatitude,
          longitude: landLongitude,
          verified: false,
          verification_level: "PENDING",
          owner_id: user.id,
          survey_number: surveyNumber.trim() || null,
          survey_source: surveyNumber.trim() ? surveySource : null,
          survey_verified: surveySource === "CADASTRAL_API",
          cadastral_reference: cadastralReference.trim() || null,
          asking_price: price.trim(),
          description: description.trim() || null,
        })
        .select("id")
        .single();

      if (landError) throw landError;

      const { error: boundaryError } = await sb.rpc("save_land_boundary", {
        p_land_id: land.id,
        p_boundary_wkt: polygonWKT,
      });

      if (boundaryError) throw boundaryError;

      if (propertyPhotos.length > 0) {
        const uploadedPhotos: {
          storage_path: string;
          public_url: string;
          sort_order: number;
          is_cover: boolean;
        }[] = [];

        for (let index = 0; index < propertyPhotos.length; index += 1) {
          const file = propertyPhotos[index];
          const safeName = file.name.toLowerCase().replace(/[^a-z0-9._-]/g, "-");
          const path = `${user.id}/${land.id}/${crypto.randomUUID()}-${safeName}`;

          const { error: uploadError } = await sb.storage
            .from("land-photos")
            .upload(path, file, {
              contentType: file.type,
              upsert: false,
            });

          if (uploadError) throw uploadError;

          const { data: publicData } = sb.storage
            .from("land-photos")
            .getPublicUrl(path);

          uploadedPhotos.push({
            storage_path: path,
            public_url: publicData.publicUrl,
            sort_order: index,
            is_cover: index === 0,
          });
        }

        if (uploadedPhotos.length) {
          const { error: photoRowError } = await sb
            .from("land_photos")
            .insert(
              uploadedPhotos.map((photo) => ({
                ...photo,
                land_id: land.id,
              }))
            );

          if (photoRowError) throw photoRowError;
        }
      }

      setMessage("Land submitted successfully. It is now pending verification.");

      setTitle("");
      setLocation("");
      setArea("");
      setLandType("AGRICULTURAL");
      setListingType("SELL");
      setPrice("");
      setLeaseDuration("");
      setDescription("");
      setSurveyNumber("");
      setCadastralReference("");
      setSurveyLookupMessage("");
      setLatitude("");
      setLongitude("");
      setBoundary(null);
      setPropertyPhotos([]);
      setPhotoPreviews([]);
    } catch (submitError: any) {
      console.error("Owner submission error:", submitError);
      setError(submitError?.message || "Unable to submit the property.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="owner-page">
      <header className="subHeader darkHeader">
        <Link href="/" className="wordmark">
          BHOOMI<span>SETU</span>
        </Link>

        <nav>
          <Link href="/explore">EXPLORE</Link>
          <Link href="/intelligence">INTELLIGENCE</Link>
          <Link href="/about">ABOUT</Link>
        </nav>

        <div className="authNav">
          <Link href="/account">ACCOUNT</Link>
        </div>
      </header>

      <section className="owner-hero">
        <div className="owner-heading">
          <span>BHOOMISETU / OWNER</span>
          <h1>
            Register your
            <br />
            <i>land.</i>
          </h1>
          <p>
            Add your property, define its exact boundary and submit it for
            BhoomiSetu verification.
          </p>
        </div>

        <form className="owner-form" onSubmit={handleSubmit}>
          <div className="owner-form-section">
            <span>01 / PROPERTY DETAILS</span>

            <label>
              PROPERTY TITLE
              <input
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="e.g. Green Valley Estate"
                required
              />
            </label>

            <label>
              LOCATION
              <input
                value={location}
                onChange={(event) => setLocation(event.target.value)}
                placeholder="Village, District, State"
                required
              />
            </label>

            <div className="owner-two-column">
              <label>
                AREA
                <input
                  value={area}
                  onChange={(event) => setArea(event.target.value)}
                  placeholder="e.g. 12.4 acres"
                  required
                />
              </label>

              <label>
                LAND TYPE
                <select value={landType} onChange={(event) => setLandType(event.target.value)}>
                  <option value="AGRICULTURAL">AGRICULTURAL</option>
                  <option value="RESIDENTIAL">RESIDENTIAL</option>
                  <option value="COMMERCIAL">COMMERCIAL</option>
                  <option value="INDUSTRIAL">INDUSTRIAL</option>
                </select>
              </label>
            </div>

            <div style={{ marginTop: 24 }}>
              <span style={{ display: "block", marginBottom: 12 }}>LISTING TYPE</span>

              <div className="owner-two-column">
                <button
                  type="button"
                  className="owner-submit"
                  aria-pressed={listingType === "SELL"}
                  onClick={() => {
                    setListingType("SELL");
                    setLeaseDuration("");
                  }}
                  style={{
                    opacity: listingType === "SELL" ? 1 : 0.5,
                    border: listingType === "SELL" ? "2px solid #b8ff5a" : "1px solid #777",
                  }}
                >
                  SELL PROPERTY
                </button>

                <button
                  type="button"
                  className="owner-submit"
                  aria-pressed={listingType === "LEASE"}
                  onClick={() => setListingType("LEASE")}
                  style={{
                    opacity: listingType === "LEASE" ? 1 : 0.5,
                    border: listingType === "LEASE" ? "2px solid #b8ff5a" : "1px solid #777",
                  }}
                >
                  LEASE PROPERTY
                </button>
              </div>
            </div>

            <label>
              {listingType === "SELL" ? "EXPECTED SELLING PRICE" : "EXPECTED LEASE AMOUNT"}
              <input
                value={price}
                onChange={(event) => setPrice(event.target.value)}
                placeholder={listingType === "SELL" ? "e.g. ₹2.5 Cr" : "e.g. ₹50,000"}
                required
              />
            </label>

            {listingType === "LEASE" && (
              <label>
                LEASE DURATION
                <input
                  value={leaseDuration}
                  onChange={(event) => setLeaseDuration(event.target.value)}
                  placeholder="e.g. 11 months, 3 years"
                  required
                />
              </label>
            )}

            <label>
              SURVEY NUMBER
              <input
                value={surveyNumber}
                onChange={(event) => {
                  setSurveyNumber(event.target.value);
                  setSurveySource("OWNER_PROVIDED");
                  setCadastralReference("");
                  setSurveyLookupMessage("");
                }}
                placeholder="Optional"
              />

              <button
                type="button"
                className="owner-submit"
                style={{ marginTop: 8 }}
                onClick={lookupSurveyNumber}
                disabled={surveyLookup}
              >
                {surveyLookup ? "CHECKING CADASTRAL MAP..." : "FIND FROM CADASTRAL MAP ↗"}
              </button>

              {surveyLookupMessage && (
                <p className="owner-coordinate-note">{surveyLookupMessage}</p>
              )}

              <p className="owner-coordinate-note">
                Survey numbers are marked as owner-provided unless an authoritative
                cadastral connector returns one.
              </p>
            </label>

            <div className="owner-two-column">
              <label>
                LATITUDE
                <input
                  value={latitude}
                  onChange={(event) => setLatitude(event.target.value)}
                  placeholder="12.2958"
                  inputMode="decimal"
                />
              </label>

              <label>
                LONGITUDE
                <input
                  value={longitude}
                  onChange={(event) => setLongitude(event.target.value)}
                  placeholder="76.6394"
                  inputMode="decimal"
                />
              </label>
            </div>

            <p className="owner-coordinate-note">
              Enter coordinates to jump directly to the property before drawing
              the exact boundary.
            </p>

            <label>
              DESCRIPTION
              <textarea
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="Tell buyers about the property..."
                rows={5}
              />
            </label>
          </div>

          <div className="owner-form-section">
            <span>02 / EXACT LAND BOUNDARY</span>

            <p className="owner-map-instruction">
              Use the polygon tool on the map to trace the actual property
              boundary. You can edit or remove it before submitting.
            </p>

            <div className="owner-map-wrapper">
              <OwnerMap
                onBoundaryChange={setBoundary}
                initialLocation={parsedLocation}
              />
            </div>

            <div className="boundary-status">
              <span className={boundary ? "status-dot ready" : "status-dot"} />
              {boundary ? "BOUNDARY CAPTURED" : "DRAW PROPERTY BOUNDARY"}
            </div>
          </div>

          <div className="owner-form-section">
            <span>03 / PROPERTY PHOTOS</span>

            <p className="owner-map-instruction">
              Add clear photos of the property. They are attached to this land
              record after successful submission.
            </p>

            <label>
              PROPERTY PHOTOS
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                multiple
                onChange={(event) => {
                  const incoming = Array.from(event.target.files || []);
                  const valid = incoming.filter(
                    (file) => file.size <= 8 * 1024 * 1024
                  );

                  setPropertyPhotos((current) => [...current, ...valid].slice(0, 15));
                  event.currentTarget.value = "";
                }}
              />
            </label>

            {propertyPhotos.length > 0 && (
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill,minmax(120px,1fr))",
                  gap: 10,
                  marginTop: 12,
                }}
              >
                {propertyPhotos.map((file, index) => (
                  <div
                    key={`${file.name}-${file.lastModified}-${index}`}
                    style={{ position: "relative" }}
                  >
                    <img
                      src={photoPreviews[index]}
                      alt={file.name}
                      style={{
                        width: "100%",
                        aspectRatio: "1",
                        objectFit: "cover",
                        display: "block",
                      }}
                    />

                    <button
                      type="button"
                      onClick={() =>
                        setPropertyPhotos((current) =>
                          current.filter((_, i) => i !== index)
                        )
                      }
                      style={{ position: "absolute", top: 5, right: 5 }}
                    >
                      REMOVE
                    </button>

                    {index === 0 && (
                      <small style={{ display: "block", marginTop: 4 }}>
                        COVER PHOTO
                      </small>
                    )}
                  </div>
                ))}
              </div>
            )}

            <p className="owner-coordinate-note">
              Up to 15 photos · JPG, PNG or WebP · 8 MB each. The first photo
              is used as the cover.
            </p>
          </div>

          {error && <div className="owner-message error">{error}</div>}
          {message && <div className="owner-message success">{message}</div>}

          <button type="submit" className="owner-submit" disabled={saving}>
            {saving ? "SUBMITTING PROPERTY..." : "SUBMIT LAND FOR VERIFICATION ↗"}
          </button>
        </form>
      </section>
    </main>
  );
}
