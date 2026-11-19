"use client";

import { useEffect, useRef } from "react";
import "leaflet/dist/leaflet.css";

type MapViewProps = {
  className?: string;
  mode?: "MAP" | "SATELLITE" | "TERRAIN";
  focusLocation?: { lat: number; lng: number } | null;
};

type Parcel = {
  id: string;
  name: string;
  state: string;
  district: string;
  area: string;
  lat: number;
  lng: number;
  verified: boolean;
  askingPrice: string | null;
  landType: string;
};

const INDIA_CENTER: [number, number] = [21.5, 79.2];
const INDIA_BOUNDS: [[number, number], [number, number]] = [
  [7.0, 67.8],
  [36.0, 98.0],
];

const STATE_LOCATIONS: Record<string, [number, number, number]> = {
  KARNATAKA: [15.3173, 75.7139, 7],
  MAHARASHTRA: [19.7515, 75.7139, 7],
  TELANGANA: [18.1124, 79.0193, 7],
  "TAMIL NADU": [11.1271, 78.6569, 7],
  KERALA: [10.8505, 76.2711, 7],
  "ANDHRA PRADESH": [15.9129, 79.74, 7],
};

export default function MapView({
  className = "",
  mode = "MAP",
  focusLocation = null,
}: MapViewProps) {
  const mapElementRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<import("leaflet").Map | null>(null);
  const streetLayerRef = useRef<import("leaflet").TileLayer | null>(null);
  const satelliteLayerRef = useRef<import("leaflet").TileLayer | null>(null);
  const terrainLayerRef = useRef<import("leaflet").TileLayer | null>(null);
  const modeRef = useRef<"MAP" | "SATELLITE" | "TERRAIN">(mode);
  const focusRef = useRef(focusLocation);

  // Keep the latest values available to the async map initializer.
  useEffect(() => {
    modeRef.current = mode;
  }, [mode]);

  useEffect(() => {
    focusRef.current = focusLocation;
  }, [focusLocation]);

  /* -----------------------------------------------------------
     INITIALIZE LEAFLET
     ----------------------------------------------------------- */
  useEffect(() => {
    let cancelled = false;
    let resizeTimer1: number | undefined;
    let resizeTimer2: number | undefined;

    const initializeMap = async () => {
      if (!mapElementRef.current || mapRef.current) return;

      const L = await import("leaflet");

      if (cancelled || !mapElementRef.current) return;

      // Prevent duplicate Leaflet instances if React remounts quickly.
      const container = mapElementRef.current;
      if ((container as HTMLDivElement & { _leaflet_id?: number })._leaflet_id) {
        return;
      }

      const map = L.map(container, {
        center: INDIA_CENTER,
        zoom: 5.8,
        minZoom: 5.35,
        maxZoom: 18,
        zoomControl: false,
        attributionControl: true,
        worldCopyJump: false,
        maxBounds: INDIA_BOUNDS,
        maxBoundsViscosity: 1.0,
        preferCanvas: true,
      });

      mapRef.current = map;

      /* ---------------- NORMAL MAP ---------------- */
      const streetLayer = L.tileLayer(
        process.env.NEXT_PUBLIC_BHOOMISETU_MAP_TILE_URL ||
          "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
        {
          maxZoom: 19,
          attribution:
            '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a>',
          className: "bs-street-tiles",
          keepBuffer: 2,
          updateWhenIdle: true,
          updateWhenZooming: false,
        }
      );

      /* ---------------- REAL SATELLITE ---------------- */
      const satelliteLayer = L.tileLayer(
        process.env.NEXT_PUBLIC_BHOOMISETU_SATELLITE_TILE_URL ||
          "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
        {
          maxZoom: 19,
          attribution: "Tiles &copy; Esri",
          className: "bs-satellite-tiles",
          keepBuffer: 3,
          updateWhenIdle: true,
          updateWhenZooming: false,
        }
      );

      /* ---------------- REAL TERRAIN ---------------- */
      const terrainLayer = L.tileLayer(
        process.env.NEXT_PUBLIC_BHOOMISETU_TERRAIN_TILE_URL ||
          "https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png",
        {
          maxZoom: 17,
          attribution: '&copy; OpenTopoMap (CC-BY-SA) | Map data &copy; OpenStreetMap contributors',
          className: "bs-terrain-tiles",
          keepBuffer: 2,
          updateWhenIdle: true,
          updateWhenZooming: false,
        }
      );

      streetLayerRef.current = streetLayer;
      satelliteLayerRef.current = satelliteLayer;
      terrainLayerRef.current = terrainLayer;

      streetLayer.on("tileerror", (event) => {
        console.warn("BhoomiSetu street-map tile error:", event);
      });

      satelliteLayer.on("tileerror", (event) => {
        console.warn("BhoomiSetu satellite tile error:", event);
      });

      terrainLayer.on("tileerror", (event) => {
        console.warn("BhoomiSetu terrain tile error:", event);
      });

      // Only ONE base layer is added at a time.
      if (modeRef.current === "SATELLITE") {
        satelliteLayer.setZIndex(2);
        satelliteLayer.addTo(map);
      } else if (modeRef.current === "TERRAIN") {
        terrainLayer.setZIndex(2);
        terrainLayer.addTo(map);
      } else {
        streetLayer.setZIndex(1);
        streetLayer.addTo(map);
      }

      /* ---------------- ZOOM ---------------- */
      L.control.zoom({ position: "bottomright" }).addTo(map);

      /* ---------------- INDIA VIEW ---------------- */
      const indiaBounds = L.latLngBounds(INDIA_BOUNDS);

      /* ---------------- REAL VERIFIED PARCELS ---------------- */
      let parcels: Parcel[] = [];
      try {
        const landResponse = await fetch("/api/lands", { cache: "no-store" });
        if (landResponse.ok) {
          const landData = await landResponse.json();
          parcels = Array.isArray(landData.lands)
            ? landData.lands
                .filter((land: any) => Number.isFinite(Number(land.latitude)) && Number.isFinite(Number(land.longitude)))
                .map((land: any) => ({
                  id: String(land.id),
                  name: String(land.title || "Verified land"),
                  state: String(land.location || "India"),
                  district: String(land.location || "India"),
                  area: String(land.area || "—"),
                  lat: Number(land.latitude),
                  lng: Number(land.longitude),
                  verified: Boolean(land.verified),
                  askingPrice: land.asking_price ?? null,
                  landType: String(land.land_type || "LAND"),
                }))
            : [];
        }
      } catch (error) {
        console.warn("BhoomiSetu verified land feed unavailable:", error);
      }

      parcels.forEach((parcel) => {
        const icon = L.divIcon({
          className: "bs-leaflet-marker-wrapper",
          html: `
            <div class="bs-parcel-marker">
              <div class="bs-parcel-pulse"></div>
              <div class="bs-parcel-dot"></div>
              <div class="bs-parcel-label">
                <strong>${parcel.name}</strong>
                <span>${parcel.area}</span>
              </div>
            </div>
          `,
          iconSize: [180, 60],
          iconAnchor: [90, 30],
        });

        const marker = L.marker([parcel.lat, parcel.lng], {
          icon,
          title: parcel.name,
        }).addTo(map);

        marker.bindPopup(`
          <div class="bs-parcel-popup">
            <div class="bs-popup-top">
              <span>BHOOMISETU / LAND</span>
              ${parcel.verified ? "<b>VERIFIED</b>" : ""}
            </div>

            <h3>${parcel.name}</h3>

            <p class="bs-popup-location">
              ${parcel.district}, ${parcel.state}
            </p>

            <div class="bs-popup-data">
              <div>
                <small>AREA</small>
                <strong>${parcel.area}</strong>
              </div>
              <div>
                <small>PRICE</small>
                <strong>${parcel.askingPrice || "ON REQUEST"}</strong>
              </div>
              <div>
                <small>PURPOSE</small>
                <strong>${parcel.landType}</strong>
              </div>
            </div>

            <a
              class="bs-view-parcel"
              href="/intelligence?parcel=${encodeURIComponent(parcel.id)}&lat=${parcel.lat}&lng=${parcel.lng}"
            >
              VIEW LAND ↗
            </a>
          </div>
        `);

        marker.on("click", () => {
          map.flyTo([parcel.lat, parcel.lng], 13, {
            duration: 1.2,
            easeLinearity: 0.25,
          });
        });
      });

      /* ---------------- INITIAL LOCATION ---------------- */
      const initialFocus = focusRef.current;

      const initialPoint =
        initialFocus &&
        Number.isFinite(initialFocus.lat) &&
        Number.isFinite(initialFocus.lng)
          ? L.latLng(initialFocus.lat, initialFocus.lng)
          : null;

      if (initialPoint && indiaBounds.contains(initialPoint)) {
        map.flyTo([initialPoint.lat, initialPoint.lng], 13, {
          duration: 1.2,
          easeLinearity: 0.25,
        });
      } else {
        // Always open on India, never Europe/America/random world position.
        // Keep the initial view tightly focused on India.
        // Do not fit the full India bounding box because that zooms
        // out far enough to show most of Asia.
        map.setView(INDIA_CENTER, 5.8, {
          animate: false,
        });
      }

      // Leaflet needs a layout pass after the parent becomes visible.
      requestAnimationFrame(() => map.invalidateSize());

      resizeTimer1 = window.setTimeout(() => {
        if (!cancelled) map.invalidateSize();
      }, 250);

      resizeTimer2 = window.setTimeout(() => {
        if (!cancelled) map.invalidateSize();
      }, 700);
    };

    initializeMap().catch((error) => {
      console.error("BhoomiSetu map initialization failed:", error);
    });

    return () => {
      cancelled = true;

      if (resizeTimer1) window.clearTimeout(resizeTimer1);
      if (resizeTimer2) window.clearTimeout(resizeTimer2);

      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }

      streetLayerRef.current = null;
      satelliteLayerRef.current = null;
      terrainLayerRef.current = null;
    };
  }, []);

  /* -----------------------------------------------------------
     MAP / SATELLITE SWITCH
     ----------------------------------------------------------- */
  useEffect(() => {
    modeRef.current = mode;

    const map = mapRef.current;
    const street = streetLayerRef.current;
    const satellite = satelliteLayerRef.current;
    const terrain = terrainLayerRef.current;

    if (!map || !street || !satellite || !terrain) return;

    if (map.hasLayer(street)) map.removeLayer(street);
    if (map.hasLayer(satellite)) map.removeLayer(satellite);
    if (map.hasLayer(terrain)) map.removeLayer(terrain);

    if (mode === "SATELLITE") {
      satellite.setZIndex(2);
      satellite.addTo(map);
    } else if (mode === "TERRAIN") {
      terrain.setZIndex(2);
      terrain.addTo(map);
    } else {
      street.setZIndex(1);
      street.addTo(map);
    }

    window.setTimeout(() => map.invalidateSize(), 80);
  }, [mode]);

  /* -----------------------------------------------------------
     FOCUS LOCATION
     ----------------------------------------------------------- */
  useEffect(() => {
    const map = mapRef.current;

    if (
      !map ||
      !focusLocation ||
      !Number.isFinite(focusLocation.lat) ||
      !Number.isFinite(focusLocation.lng)
    ) {
      return;
    }

    map.flyTo([focusLocation.lat, focusLocation.lng], 13, {
      duration: 1.2,
      easeLinearity: 0.25,
    });
  }, [focusLocation]);

  /* -----------------------------------------------------------
     STATE SELECTION
     Explore page can call:
       window.dispatchEvent(
         new CustomEvent("bs:state", { detail: "KARNATAKA" })
       )
     ----------------------------------------------------------- */
  useEffect(() => {
    const handleState = (event: Event) => {
      const customEvent = event as CustomEvent<string>;
      const state = customEvent.detail?.trim().toUpperCase();

      if (!state) return;

      const location = STATE_LOCATIONS[state];
      const map = mapRef.current;

      if (!location || !map) return;

      map.flyTo([location[0], location[1]], location[2], {
        duration: 1.5,
        easeLinearity: 0.25,
      });
    };

    window.addEventListener("bs:state", handleState);

    return () => {
      window.removeEventListener("bs:state", handleState);
    };
  }, []);

  /* -----------------------------------------------------------
     RENDER
     ----------------------------------------------------------- */
  return (
    <div
      ref={mapElementRef}
      className={`bhoomisetu-map ${className}`.trim()}
      aria-label="BhoomiSetu India land map"
    />
  );
}
