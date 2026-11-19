"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

const EARTH_DAY =
  "https://threejs.org/examples/textures/planets/earth_day_4096.jpg";
const EARTH_NORMAL =
  "https://threejs.org/examples/textures/planets/earth_normal_2048.jpg";
const EARTH_SPECULAR =
  "https://threejs.org/examples/textures/planets/earth_specular_2048.jpg";
const EARTH_CLOUDS =
  "https://threejs.org/examples/textures/planets/earth_clouds_1024.png";

export default function EarthView() {
  const mountRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x020403);

    const camera = new THREE.PerspectiveCamera(
      38,
      mount.clientWidth / Math.max(1, mount.clientHeight),
      0.1,
      100
    );
    camera.position.set(0, 0.35, 5.4);

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: "high-performance",
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
    renderer.setSize(mount.clientWidth, mount.clientHeight);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    mount.appendChild(renderer.domElement);

    const ambient = new THREE.AmbientLight(0xffffff, 0.42);
    scene.add(ambient);

    const sun = new THREE.DirectionalLight(0xffffff, 1.7);
    sun.position.set(4, 2, 5);
    scene.add(sun);

    const loader = new THREE.TextureLoader();
    loader.setCrossOrigin("anonymous");

    const earthDay = loader.load(EARTH_DAY);
    const normal = loader.load(EARTH_NORMAL);
    const specular = loader.load(EARTH_SPECULAR);
    const clouds = loader.load(EARTH_CLOUDS);

    earthDay.colorSpace = THREE.SRGBColorSpace;
    clouds.colorSpace = THREE.SRGBColorSpace;

    const globe = new THREE.Mesh(
      new THREE.SphereGeometry(1.92, 96, 96),
      new THREE.MeshPhongMaterial({
        map: earthDay,
        normalMap: normal,
        specularMap: specular,
        specular: new THREE.Color(0x24405b),
        shininess: 14,
      })
    );
    scene.add(globe);

    const cloudLayer = new THREE.Mesh(
      new THREE.SphereGeometry(1.945, 64, 64),
      new THREE.MeshPhongMaterial({
        map: clouds,
        transparent: true,
        opacity: 0.18,
        depthWrite: false,
      })
    );
    scene.add(cloudLayer);

    const atmosphere = new THREE.Mesh(
      new THREE.SphereGeometry(1.99, 64, 64),
      new THREE.MeshBasicMaterial({
        color: 0x8bc7ff,
        transparent: true,
        opacity: 0.055,
        side: THREE.BackSide,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    );
    scene.add(atmosphere);

    const indiaMarker = new THREE.Mesh(
      new THREE.SphereGeometry(0.035, 16, 16),
      new THREE.MeshBasicMaterial({ color: 0xb8ff5a })
    );
    const lat = 20.5937 * Math.PI / 180;
    const lng = 78.9629 * Math.PI / 180;
    const r = 1.985;
    indiaMarker.position.set(
      r * Math.cos(lat) * Math.sin(lng),
      r * Math.sin(lat),
      r * Math.cos(lat) * Math.cos(lng)
    );
    scene.add(indiaMarker);

    const ring = new THREE.Mesh(
      new THREE.RingGeometry(0.07, 0.082, 48),
      new THREE.MeshBasicMaterial({
        color: 0xb8ff5a,
        transparent: true,
        opacity: 0.65,
        side: THREE.DoubleSide,
      })
    );
    ring.position.copy(indiaMarker.position);
    ring.lookAt(0, 0, 0);
    scene.add(ring);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.enablePan = false;
    controls.minDistance = 3.2;
    controls.maxDistance = 8;
    controls.autoRotate = true;
    controls.autoRotateSpeed = 0.22;
    controls.target.set(0, 0, 0);

    let raf = 0;
    let last = 0;
    const animate = (time: number) => {
      raf = requestAnimationFrame(animate);
      const dt = Math.min(32, time - last);
      last = time;
      globe.rotation.y += dt * 0.000018;
      cloudLayer.rotation.y += dt * 0.000024;
      controls.update();
      renderer.render(scene, camera);
    };
    raf = requestAnimationFrame(animate);

    const resize = () => {
      const width = mount.clientWidth;
      const height = Math.max(1, mount.clientHeight);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height);
    };
    window.addEventListener("resize", resize);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      controls.dispose();
      globe.geometry.dispose();
      (globe.material as THREE.Material).dispose();
      cloudLayer.geometry.dispose();
      (cloudLayer.material as THREE.Material).dispose();
      atmosphere.geometry.dispose();
      (atmosphere.material as THREE.Material).dispose();
      indiaMarker.geometry.dispose();
      (indiaMarker.material as THREE.Material).dispose();
      ring.geometry.dispose();
      (ring.material as THREE.Material).dispose();
      earthDay.dispose();
      normal.dispose();
      specular.dispose();
      clouds.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, []);

  return (
    <div className="real-earth-view">
      <div className="real-earth-meta">
        <span>REAL EARTH / THREE.JS</span>
        <span>TEXTURED EARTH · ORBIT ENABLED</span>
      </div>
      <div ref={mountRef} className="real-earth-canvas" />
      <div className="real-earth-footer">
        <span>INDIA / 20.5937° N / 78.9629° E</span>
        <span>DRAG TO ORBIT · SCROLL TO ZOOM</span>
      </div>
    </div>
  );
}
