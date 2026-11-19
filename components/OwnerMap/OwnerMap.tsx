"use client";

import { useEffect, useRef } from "react";
import "leaflet/dist/leaflet.css";

type OwnerMapProps = {
  onBoundaryChange?: (
    geojson: GeoJSON.Feature<GeoJSON.Polygon> | null
  ) => void;
  initialLocation?: { lat: number; lng: number } | null;
};

export default function OwnerMap({
  onBoundaryChange,
  initialLocation = null,
}: OwnerMapProps) {
  const mapElementRef = useRef<HTMLDivElement | null>(null);

  const mapRef =
    useRef<import("leaflet").Map | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function initializeMap() {
      if (
        !mapElementRef.current ||
        mapRef.current
      ) {
        return;
      }

      /*
       * Leaflet must load in the browser only.
       */
      const L = await import("leaflet");

      if (
        cancelled ||
        !mapElementRef.current
      ) {
        return;
      }

      /*
       * Geoman must also load in the browser only.
       *
       * This avoids the previous:
       * "Element is not defined"
       * build error.
       */
      await import(
        "@geoman-io/leaflet-geoman-free"
      );

      if (
        cancelled ||
        !mapElementRef.current
      ) {
        return;
      }

      /*
       * --------------------------------------------------
       * MAP
       * --------------------------------------------------
       */

      const map = L.map(
        mapElementRef.current,
        {
          center: initialLocation
            ? [initialLocation.lat, initialLocation.lng]
            : [20.5937, 78.9629],

          zoom: 5,

          minZoom: 4,

          maxZoom: 20,

          zoomControl: false,

          attributionControl: true,

          doubleClickZoom: false,
        }
      );

      mapRef.current = map;

      /*
       * --------------------------------------------------
       * BASE LAYERS
       * --------------------------------------------------
       */

      const satellite =
        L.tileLayer(
          "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
          {
            maxZoom: 19,

            attribution:
              "Tiles © Esri",
          }
        );

      const street =
        L.tileLayer(
          "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
          {
            maxZoom: 19,

            attribution:
              "© OpenStreetMap",
          }
        );

      satellite.addTo(map);

      if (initialLocation) {
        map.setView(
          [initialLocation.lat, initialLocation.lng],
          15,
          { animate: true }
        );
      }

      /*
       * --------------------------------------------------
       * MAP CONTROLS
       * --------------------------------------------------
       */

      L.control
        .zoom({
          position:
            "bottomright",
        })
        .addTo(map);

      L.control
        .layers(
          {
            SATELLITE:
              satellite,

            MAP:
              street,
          },
          {},
          {
            position:
              "topright",

            collapsed:
              false,
          }
        )
        .addTo(map);

      /*
       * --------------------------------------------------
       * GEOMAN
       * --------------------------------------------------
       */

      const pm = (
        map as typeof map & {
          pm?: any;
        }
      ).pm;

      if (!pm) {
        console.error(
          "BhoomiSetu: Leaflet-Geoman failed to load."
        );

        return;
      }

      pm.setGlobalOptions({
        allowSelfIntersection:
          false,

        snappable:
          true,

        snapDistance:
          20,

        templineStyle: {
          color:
            "#8ed7a0",
        },

        hintlineStyle: {
          color:
            "#8ed7a0",

          dashArray:
            [5, 5],
        },

        pathOptions: {
          color:
            "#8ed7a0",

          weight: 3,

          opacity: 1,

          fillColor:
            "#8ed7a0",

          fillOpacity:
            0.22,
        },
      });

      /*
       * --------------------------------------------------
       * FIND CURRENT PARCEL
       * --------------------------------------------------
       */

      function getParcelPolygon(): any {
        let parcel: any =
          null;

        map.eachLayer(
          (layer: any) => {
            if (
              layer instanceof L.Polygon &&
              typeof layer.getLatLngs ===
                "function" &&
              typeof layer.toGeoJSON ===
                "function"
            ) {
              parcel = layer;
            }
          }
        );

        return parcel;
      }

      /*
       * --------------------------------------------------
       * SEND GEOJSON TO OWNER FORM
       * --------------------------------------------------
       */

      function sendBoundary() {
        const polygon =
          getParcelPolygon();

        if (!polygon) {
          onBoundaryChange?.(
            null
          );

          return;
        }

        try {
          const geojson =
            polygon.toGeoJSON();

          if (
            geojson &&
            geojson.geometry &&
            geojson.geometry.type ===
              "Polygon"
          ) {
            onBoundaryChange?.(
              geojson as GeoJSON.Feature<GeoJSON.Polygon>
            );
          }
        } catch (
          error
        ) {
          console.error(
            "BhoomiSetu: unable to read parcel boundary.",
            error
          );
        }
      }

      /*
       * --------------------------------------------------
       * DRAW
       * --------------------------------------------------
       */

      function startDrawing() {
        /*
         * Remove existing parcel first.
         */

        const existing =
          getParcelPolygon();

        if (existing) {
          try {
            existing.pm?.disable();
          } catch {}

          map.removeLayer(
            existing
          );
        }

        onBoundaryChange?.(
          null
        );

        /*
         * Enable Geoman polygon drawing.
         */

        pm.enableDraw(
          "Polygon",
          {
            snappable:
              true,

            snapDistance:
              20,

            allowSelfIntersection:
              false,

            templineStyle: {
              color:
                "#8ed7a0",
            },

            hintlineStyle: {
              color:
                "#8ed7a0",

              dashArray:
                [5, 5],
            },

            pathOptions: {
              color:
                "#8ed7a0",

              weight: 3,

              opacity: 1,

              fillColor:
                "#8ed7a0",

              fillOpacity:
                0.22,
            },
          }
        );

        drawButton.textContent =
          "DRAWING…";
      }

      /*
       * --------------------------------------------------
       * WHEN A POLYGON IS CREATED
       * --------------------------------------------------
       */

      map.on(
        "pm:create",
        (event: any) => {
          const created =
            event.layer;

          /*
           * Keep only one parcel.
           */

          map.eachLayer(
            (existing: any) => {
              if (
                existing !==
                  created &&
                existing instanceof
                  L.Polygon &&
                typeof existing.getLatLngs ===
                  "function" &&
                typeof existing.toGeoJSON ===
                  "function"
              ) {
                try {
                  existing.pm?.disable();
                } catch {}

                map.removeLayer(
                  existing
                );
              }
            }
          );

          /*
           * Enable editing on the new polygon.
           */

          try {
            created.pm.enable({
              allowSelfIntersection:
                false,

              snappable:
                true,

              snapDistance:
                20,
            });
          } catch {}

          /*
           * Make sure layer drag is
           * initially disabled.
           */

          try {
            created.pm.disableLayerDrag();
          } catch {}

          sendBoundary();

          drawButton.textContent =
            "✦ REDRAW BOUNDARY";

          editButton.textContent =
            "◇ EDIT POINTS";

          moveButton.textContent =
            "↔ MOVE BOUNDARY";
        }
      );

      /*
       * --------------------------------------------------
       * GEOMAN EDIT EVENTS
       * --------------------------------------------------
       */

      map.on(
        "pm:edit",
        () => {
          sendBoundary();
        }
      );

      map.on(
        "pm:update",
        () => {
          sendBoundary();
        }
      );

      map.on(
        "pm:change",
        () => {
          sendBoundary();
        }
      );

      map.on(
        "pm:dragend",
        () => {
          sendBoundary();
        }
      );

      /*
       * --------------------------------------------------
       * REMOVE EVENT
       * --------------------------------------------------
       */

      map.on(
        "pm:remove",
        () => {
          onBoundaryChange?.(
            null
          );

          drawButton.textContent =
            "✦ DRAW BOUNDARY";

          editButton.textContent =
            "◇ EDIT POINTS";

          moveButton.textContent =
            "↔ MOVE BOUNDARY";
        }
      );

      /*
       * --------------------------------------------------
       * CUSTOM CONTROL PANEL
       * --------------------------------------------------
       */

      const controls =
        document.createElement(
          "div"
        );

      controls.className =
        "bs-owner-map-controls";

      /*
       * DRAW BUTTON
       */

      const drawButton =
        document.createElement(
          "button"
        );

      drawButton.type =
        "button";

      drawButton.className =
        "bs-boundary-button";

      drawButton.textContent =
        "✦ DRAW BOUNDARY";

      /*
       * EDIT BUTTON
       */

      const editButton =
        document.createElement(
          "button"
        );

      editButton.type =
        "button";

      editButton.className =
        "bs-boundary-button";

      editButton.textContent =
        "◇ EDIT POINTS";

      /*
       * MOVE BUTTON
       */

      const moveButton =
        document.createElement(
          "button"
        );

      moveButton.type =
        "button";

      moveButton.className =
        "bs-boundary-button";

      moveButton.textContent =
        "↔ MOVE BOUNDARY";

      /*
       * CLEAR BUTTON
       */

      const clearButton =
        document.createElement(
          "button"
        );

      clearButton.type =
        "button";

      clearButton.className =
        "bs-boundary-button bs-clear-button";

      clearButton.textContent =
        "× CLEAR";

      controls.appendChild(
        drawButton
      );

      controls.appendChild(
        editButton
      );

      controls.appendChild(
        moveButton
      );

      controls.appendChild(
        clearButton
      );

      map.getContainer().appendChild(
        controls
      );

      /*
       * IMPORTANT: the drawing controls live INSIDE Leaflet's map
       * container. Without stopping pointer/click propagation, the
       * click used to press "DRAW BOUNDARY" can bubble into Leaflet
       * and Geoman treats that same click as the first polygon point.
       * That is why the first vertex was appearing directly below the
       * button. The button now only arms drawing; the NEXT user click
       * on the actual map becomes vertex #1.
       */
      L.DomEvent.disableClickPropagation(controls);
      L.DomEvent.disableScrollPropagation(controls);

      controls.addEventListener(
        "pointerdown",
        (event) => event.stopPropagation()
      );

      controls.addEventListener(
        "mousedown",
        (event) => event.stopPropagation()
      );

      controls.addEventListener(
        "touchstart",
        (event) => event.stopPropagation(),
        { passive: true }
      );

      /*
       * --------------------------------------------------
       * DRAW BUTTON ACTION
       * --------------------------------------------------
       */

      drawButton.addEventListener(
        "click",
        (event) => {
          event.preventDefault();
          event.stopPropagation();
          startDrawing();
        }
      );

      /*
       * --------------------------------------------------
       * EDIT POINTS ACTION
       * --------------------------------------------------
       */

      editButton.addEventListener(
        "click",
        (event) => {
          event.preventDefault();
          event.stopPropagation();
          const polygon =
            getParcelPolygon();

          if (!polygon) {
            return;
          }

          try {
            if (
              polygon.pm.enabled()
            ) {
              polygon.pm.disable();

              editButton.textContent =
                "◇ EDIT POINTS";
            } else {
              polygon.pm.enable({
                allowSelfIntersection:
                  false,

                snappable:
                  true,

                snapDistance:
                  20,
              });

              editButton.textContent =
                "✓ EDITING POINTS";
            }
          } catch (
            error
          ) {
            console.error(
              "BhoomiSetu: point editing failed.",
              error
            );
          }
        }
      );

      /*
       * --------------------------------------------------
       * MOVE WHOLE BOUNDARY
       * --------------------------------------------------
       */

      moveButton.addEventListener(
        "click",
        (event) => {
          event.preventDefault();
          event.stopPropagation();
          const polygon =
            getParcelPolygon();

          if (!polygon) {
            return;
          }

          try {
            /*
             * Geoman's layer dragging is
             * independent from point editing.
             */

            polygon.pm.enableLayerDrag();

            moveButton.textContent =
              "✓ MOVE MODE ON";

            /*
             * Tell the user they are in
             * move mode.
             */

            polygon.once(
              "pm:dragend",
              () => {
                sendBoundary();

                try {
                  polygon.pm.disableLayerDrag();
                } catch {}

                moveButton.textContent =
                  "↔ MOVE BOUNDARY";
              }
            );
          } catch (
            error
          ) {
            console.error(
              "BhoomiSetu: boundary dragging failed.",
              error
            );
          }
        }
      );

      /*
       * --------------------------------------------------
       * CLEAR
       * --------------------------------------------------
       */

      clearButton.addEventListener(
        "click",
        (event) => {
          event.preventDefault();
          event.stopPropagation();
          const polygon =
            getParcelPolygon();

          if (polygon) {
            try {
              polygon.pm.disable();

              polygon.pm.disableLayerDrag();
            } catch {}

            map.removeLayer(
              polygon
            );
          }

          try {
            pm.disableDraw();
          } catch {}

          onBoundaryChange?.(
            null
          );

          drawButton.textContent =
            "✦ DRAW BOUNDARY";

          editButton.textContent =
            "◇ EDIT POINTS";

          moveButton.textContent =
            "↔ MOVE BOUNDARY";
        }
      );

      /*
       * --------------------------------------------------
       * INITIAL INDIA VIEW
       * --------------------------------------------------
       */

      const indiaBounds =
        L.latLngBounds(
          [6.4627, 68.1097],
          [35.5133, 97.3956]
        );

      if (!initialLocation) {
        map.fitBounds(
          indiaBounds,
          {
            padding: [
              30,
              30,
            ],

            maxZoom: 5,
          }
        );
      }

      /*
       * Give Leaflet time to calculate
       * the contained map dimensions.
       */

      window.setTimeout(
        () => {
          if (
            !cancelled &&
            mapRef.current
          ) {
            mapRef.current.invalidateSize();
          }
        },
        300
      );
    }

    initializeMap().catch(
      (error) => {
        console.error(
          "BhoomiSetu owner map failed to initialize:",
          error
        );
      }
    );

    return () => {
      cancelled = true;

      if (
        mapRef.current
      ) {
        mapRef.current.remove();

        mapRef.current =
          null;
      }
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !initialLocation) return;
    map.flyTo(
      [initialLocation.lat, initialLocation.lng],
      Math.max(map.getZoom(), 15),
      { duration: 1.2 }
    );
  }, [initialLocation]);

  return (
    <div
      ref={mapElementRef}
      className="bhoomisetu-owner-map"
    />
  );
}