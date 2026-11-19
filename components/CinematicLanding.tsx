"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import * as THREE from "three";
import gsap from "gsap";

type Scene = "stars" | "earth" | "reveal" | "landing" | "deep";

const EARTH =
  "https://threejs.org/examples/textures/planets/earth_atmos_2048.jpg";

const NORMAL =
  "https://threejs.org/examples/textures/planets/earth_normal_2048.jpg";

const CLOUDS =
  "https://threejs.org/examples/textures/planets/earth_clouds_1024.png";

export default function CinematicLanding() {
  const mountRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const earthRef = useRef<THREE.Mesh | null>(null);
  const earthGroupRef = useRef<THREE.Group | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const rafRef = useRef<number>(0);

  const [scene, setScene] = useState<Scene>("stars");
  const [progress, setProgress] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const [sound, setSound] = useState(false);

  const audioRef = useRef<AudioContext | null>(null);

  useEffect(() => {
    const mount = mountRef.current;

    if (!mount) return;

    const world = new THREE.Scene();
    world.background = new THREE.Color(0x010302);
    sceneRef.current = world;

    const camera = new THREE.PerspectiveCamera(
      35,
      window.innerWidth / window.innerHeight,
      0.1,
      100
    );

    camera.position.set(0, 0, 8);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: "high-performance",
    });

    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.outputColorSpace = THREE.SRGBColorSpace;

    mount.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    /*
     * STAR FIELD
     */
    const stars = new THREE.BufferGeometry();

    const count = 2600;
    const pos = new Float32Array(count * 3);

    for (let i = 0; i < count; i++) {
      const r = 12 + Math.random() * 26;
      const a = Math.random() * Math.PI * 2;
      const z = Math.random() * 2 - 1;
      const s = Math.sqrt(1 - z * z);

      pos[i * 3] = Math.cos(a) * s * r;
      pos[i * 3 + 1] = z * r;
      pos[i * 3 + 2] = Math.sin(a) * s * r;
    }

    stars.setAttribute(
      "position",
      new THREE.BufferAttribute(pos, 3)
    );

    const starMat = new THREE.PointsMaterial({
      color: 0xdce8df,
      size: 0.035,
      transparent: true,
      opacity: 0.72,
      sizeAttenuation: true,
    });

    const starField = new THREE.Points(stars, starMat);
    world.add(starField);

    /*
     * EARTH
     */
    const earthGroup = new THREE.Group();
    earthGroupRef.current = earthGroup;

    const tex = new THREE.TextureLoader();

    const earthMat = new THREE.MeshPhongMaterial({
      map: tex.load(EARTH),
      normalMap: tex.load(NORMAL),
      normalScale: new THREE.Vector2(0.25, 0.25),
      shininess: 4,
    });

    const earth = new THREE.Mesh(
      new THREE.SphereGeometry(2.05, 96, 96),
      earthMat
    );

    earth.rotation.y = -0.65;
    earthGroup.add(earth);
    earthRef.current = earth;

    /*
     * CLOUDS
     */
    const cloudMat = new THREE.MeshPhongMaterial({
      map: tex.load(CLOUDS),
      transparent: true,
      opacity: 0.24,
      depthWrite: false,
    });

    const clouds = new THREE.Mesh(
      new THREE.SphereGeometry(2.085, 72, 72),
      cloudMat
    );

    earthGroup.add(clouds);

    /*
     * ATMOSPHERE
     */
    const atmosphere = new THREE.Mesh(
      new THREE.SphereGeometry(2.14, 72, 72),
      new THREE.MeshBasicMaterial({
        color: 0x72b9a1,
        transparent: true,
        opacity: 0.075,
        side: THREE.BackSide,
        blending: THREE.AdditiveBlending,
      })
    );

    earthGroup.add(atmosphere);

    earthGroup.position.set(0, 0, -0.3);
    earthGroup.scale.setScalar(0.02);

    world.add(earthGroup);

    /*
     * EARTH GRID
     */
    const grid = new THREE.Group();

    const gridMat = new THREE.LineBasicMaterial({
      color: 0x6da891,
      transparent: true,
      opacity: 0.14,
    });

    for (let lat = -60; lat <= 60; lat += 20) {
      const pts: THREE.Vector3[] = [];

      const phi = ((90 - lat) * Math.PI) / 180;

      for (let i = 0; i <= 96; i++) {
        const th = (i / 96) * Math.PI * 2;

        pts.push(
          new THREE.Vector3(
            Math.sin(phi) * Math.cos(th) * 2.12,
            Math.cos(phi) * 2.12,
            Math.sin(phi) * Math.sin(th) * 2.12
          )
        );
      }

      grid.add(
        new THREE.Line(
          new THREE.BufferGeometry().setFromPoints(pts),
          gridMat
        )
      );
    }

    for (let lon = 0; lon < 360; lon += 20) {
      const pts: THREE.Vector3[] = [];

      const th = (lon * Math.PI) / 180;

      for (let i = 0; i <= 96; i++) {
        const phi = (i / 96) * Math.PI;

        pts.push(
          new THREE.Vector3(
            Math.sin(phi) * Math.cos(th) * 2.12,
            Math.cos(phi) * 2.12,
            Math.sin(phi) * Math.sin(th) * 2.12
          )
        );
      }

      grid.add(
        new THREE.Line(
          new THREE.BufferGeometry().setFromPoints(pts),
          gridMat
        )
      );
    }

    earthGroup.add(grid);

    /*
     * LIGHTING
     */
    const light = new THREE.DirectionalLight(
      0xcfe9dc,
      2.3
    );

    light.position.set(4, 3, 6);

    world.add(light);

    world.add(
      new THREE.AmbientLight(
        0x20352e,
        0.5
      )
    );

    /*
     * ANIMATION LOOP
     */
    const start = performance.now();

    const animate = (now: number) => {
      const t = (now - start) / 1000;

      starField.rotation.y = t * 0.006;

      if (earthGroup.scale.x > 0.01) {
        earth.rotation.y += 0.0008;
        clouds.rotation.y += 0.0011;
      }

      renderer.render(world, camera);

      rafRef.current =
        requestAnimationFrame(animate);
    };

    rafRef.current =
      requestAnimationFrame(animate);

    /*
     * RESIZE
     */
    const onResize = () => {
      camera.aspect =
        window.innerWidth /
        window.innerHeight;

      camera.updateProjectionMatrix();

      renderer.setSize(
        window.innerWidth,
        window.innerHeight
      );
    };

    window.addEventListener(
      "resize",
      onResize
    );

    /*
     * INITIAL EARTH REVEAL
     */
    const timer = window.setTimeout(() => {
      setLoaded(true);

      gsap.to(earthGroup.scale, {
        x: 1,
        y: 1,
        z: 1,
        duration: 2.15,
        ease: "power3.inOut",
      });
    }, 900);

    return () => {
      cancelAnimationFrame(rafRef.current);
      clearTimeout(timer);

      window.removeEventListener(
        "resize",
        onResize
      );

      renderer.dispose();

      if (
        mount.contains(renderer.domElement)
      ) {
        mount.removeChild(
          renderer.domElement
        );
      }
    };
  }, []);

  /*
   * SCROLL / TOUCH PROGRESS
   */
  useEffect(() => {
    const onWheel = (e: WheelEvent) => {
      if (!loaded) return;

      e.preventDefault();

      setProgress((previous) => {
        const next = Math.max(
          0,
          Math.min(
            1,
            previous + e.deltaY / 1250
          )
        );

        if (next < 0.22) {
          setScene("earth");
        } else if (next < 0.42) {
          setScene("reveal");
        } else if (next < 0.64) {
          setScene("landing");
        } else {
          setScene("deep");
        }

        return next;
      });
    };

    window.addEventListener(
      "wheel",
      onWheel,
      { passive: false }
    );

    let touchY = 0;

    const down = (e: TouchEvent) => {
      touchY =
        e.touches[0]?.clientY ?? 0;
    };

    const move = (e: TouchEvent) => {
      if (!loaded) return;

      const y =
        e.touches[0]?.clientY ?? touchY;

      const dy = touchY - y;

      touchY = y;

      setProgress((previous) => {
        const next = Math.max(
          0,
          Math.min(
            1,
            previous + dy / 950
          )
        );

        if (next < 0.22) {
          setScene("earth");
        } else if (next < 0.42) {
          setScene("reveal");
        } else if (next < 0.64) {
          setScene("landing");
        } else {
          setScene("deep");
        }

        return next;
      });
    };

    window.addEventListener(
      "touchstart",
      down,
      { passive: true }
    );

    window.addEventListener(
      "touchmove",
      move,
      { passive: true }
    );

    return () => {
      window.removeEventListener(
        "wheel",
        onWheel
      );

      window.removeEventListener(
        "touchstart",
        down
      );

      window.removeEventListener(
        "touchmove",
        move
      );
    };
  }, [loaded]);

  /*
   * CAMERA / EARTH CHOREOGRAPHY
   */
  useEffect(() => {
    const earth = earthRef.current;
    const camera = cameraRef.current;

    if (!earth || !camera) return;

    const p = progress;

    if (p < 0.22) {
      gsap.to(camera, {
        z: 8 - 20 * p,
        duration: 0.7,
        ease: "power3.out",
      });

      gsap.to(earth.position, {
        x: 0,
        y: 0,
        duration: 0.6,
      });
    } else if (p < 0.42) {
      const q =
        (p - 0.22) / 0.2;

      gsap.to(camera, {
        z: 3.6 - q * 1.2,
        duration: 0.8,
        ease: "power3.inOut",
      });

      gsap.to(earth.rotation, {
        x: q * 0.16,
        y: -0.65 - q * 0.75,
        duration: 0.8,
        ease: "power3.inOut",
      });
    } else if (p < 0.64) {
      gsap.to(camera, {
        z: 3.1,
        duration: 0.8,
        ease: "power3.out",
      });
    } else {
      gsap.to(camera, {
        z: 3.35,
        duration: 0.8,
        ease: "power3.out",
      });

      gsap.to(earth.position, {
        x: 0.25,
        y: 0,
        duration: 0.8,
        ease: "power3.out",
      });
    }
  }, [progress]);

  /*
   * SOUND
   */
  function enableSound() {
    try {
      if (!audioRef.current) {
        audioRef.current =
          new AudioContext();
      }

      const ctx = audioRef.current;

      const osc =
        ctx.createOscillator();

      const gain =
        ctx.createGain();

      osc.frequency.value = 72;
      gain.gain.value = 0.0001;

      osc
        .connect(gain)
        .connect(ctx.destination);

      osc.start();

      osc.stop(
        ctx.currentTime + 0.15
      );

      setSound(true);
    } catch {
      // Audio is optional.
    }
  }

  /*
   * IMPORTANT:
   *
   * Each scene now has an exclusive visibility range.
   *
   * 0.00 → 0.22  Earth
   * 0.22 → 0.42  BhoomiSetu reveal
   * 0.42 → 0.64  Hero
   * 0.64 → 1.00  Deep intelligence
   */
  const showReveal =
    progress >= 0.22 &&
    progress < 0.42;

  const showLanding =
    progress >= 0.42 &&
    progress < 0.64;

  const showDeep =
    progress >= 0.64;

  return (
    <main
      className={`experience ${scene}`}
    >
      <div
        ref={mountRef}
        className="webgl"
      />

      <div className="grain" />

      {/* LOADING */}
      <div
        className={`splash ${
          loaded ? "ready" : ""
        }`}
      >
        <div className="splashTop">
          <span>
            BHOOMISETU / GEOSPATIAL
            INTELLIGENCE
          </span>

          <span>
            INITIALIZING
          </span>
        </div>

        <div className="splashCenter">
          <div className="loadingLogo">
            BHOOMI
            <span>SETU</span>
          </div>

          <div className="loadLine">
            <i
              style={{
                width: `${
                  loaded ? 100 : 68
                }%`,
              }}
            />
          </div>

          <small>
            {loaded
              ? "SYSTEM READY"
              : "WARMING TERRAIN ENGINE"}
          </small>
        </div>
      </div>

      {/* BHOOMISETU REVEAL */}
      <div
        className={`introWordmark ${
          showReveal ? "show" : ""
        }`}
      >
        <div className="introSmall">
          BHOOMISETU / LAND
          INTELLIGENCE
        </div>

        <div className="introName">
          <span>BHOOMI</span>
          <strong>SETU</strong>
        </div>

        <div className="introRule" />

        <div className="introMeta">
          EARTH · TERRAIN · AGRICULTURE ·
          GEOINT
        </div>
      </div>

      {/* HEADER */}
      <header
        className={`siteHeader ${
          showLanding || showDeep
            ? "show"
            : ""
        }`}
      >
        <Link
          href="/"
          className="miniBrand"
        >
          BHOOMI
          <span>SETU</span>
        </Link>

        <nav>
          <Link href="/explore">
            EXPLORE
          </Link>

          <Link href="/intelligence">
            INTELLIGENCE
          </Link>

          <Link href="/about">
            ABOUT
          </Link>
        </nav>

        <div className="headerRight">
          <Link
            className="signInLink"
            href="/signin"
          >
            SIGN IN
          </Link>

          <Link
            className="accountLink"
            href="/account"
          >
            ACCOUNT
          </Link>

          <button
            className="sound"
            onClick={() => {
              if (!sound) {
                enableSound();
              } else {
                setSound(false);
              }
            }}
          >
            {sound
              ? "SOUND ON"
              : "SOUND OFF"}
          </button>
        </div>
      </header>

      {/* HERO — ONLY VISIBLE FROM 42% TO 64% */}
      <section
        className={`heroCopy ${
          showLanding ? "show" : ""
        }`}
      >
        <div className="heroKicker">
          LAND / SATELLITE / TERRAIN
        </div>

        <h1>
          Know the
          <br />
          <i>land beneath.</i>
        </h1>

        <p>
          BhoomiSetu turns Earth
          observation into a living
          intelligence layer for
          owners, buyers and the people
          making decisions on land.
        </p>

        <div className="heroActions">
          <Link href="/explore">
            EXPLORE THE EARTH
            <span>↗</span>
          </Link>

          <button
            onClick={() =>
              setProgress(0.68)
            }
          >
            ENTER INTELLIGENCE
            <span>↓</span>
          </button>
        </div>
      </section>

      {/* BOTTOM DATA */}
      <div
        className={`bottomData ${
          showLanding || showDeep
            ? "show"
            : ""
        }`}
      >
        <span>
          INDIA / 15.3173° N /
          75.7139° E
        </span>

        <span>
          WGS 84
        </span>

        <span>
          SATELLITE LINK / ACTIVE
        </span>
      </div>

      {/* SCROLL HINT */}
      <div
        className={`scrollHint ${
          showLanding ? "show" : ""
        }`}
      >
        <span>
          SCROLL TO ENTER
        </span>

        <i />
      </div>

      {/* LANDING RAIL */}
      <div
        className={`landingRail ${
          showLanding || showDeep
            ? "show"
            : ""
        }`}
      >
        <Link href="/explore">
          <span>01</span>
          EXPLORE
          <b>↗</b>
        </Link>

        <Link href="/intelligence">
          <span>02</span>
          INTELLIGENCE
          <b>↗</b>
        </Link>

        <Link href="/about">
          <span>03</span>
          ABOUT
          <b>↗</b>
        </Link>
      </div>

      {/* DEEP SCENE — ONLY AFTER HERO */}
      <section
        className={`deepScene ${
          showDeep ? "active" : ""
        }`}
      >
        <div>
          <span>
            01 / LAND INTELLIGENCE
          </span>

          <h2>
            From Earth
            <br />
            <i>to parcel.</i>
          </h2>
        </div>

        <p>
          Move from planetary context
          into boundaries, terrain,
          vegetation, water and
          agricultural potential.
        </p>
      </section>

      {/* PROGRESS */}
      <div className="progressRail">
        <i
          style={{
            transform: `scaleX(${progress})`,
          }}
        />
      </div>
    </main>
  );
}