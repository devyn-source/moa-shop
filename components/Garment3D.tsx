"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, ContactShadows, Center, useGLTF, Html } from "@react-three/drei";
import * as THREE from "three";

// Porsche-style garment viewer: a single hero stage, studio light on cream,
// orbit + zoom, and live recolor across the MOA palette. Loads /models/<slug>.glb
// (AI/scan/CLO-produced). Recolor works because the base shots are neutral grey,
// so material.color tints the baked texture.
type Swatch = { label: string; hex: string };

function Model({ url, hex }: { url: string; hex: string }) {
  const { scene } = useGLTF(url);
  // clone so multiple instances / HMR don't share mutated materials
  const cloned = useMemo(() => scene.clone(true), [scene]);
  useEffect(() => {
    const color = new THREE.Color(hex);
    cloned.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      const mat = m.material as THREE.MeshStandardMaterial | THREE.MeshStandardMaterial[];
      const apply = (mm: THREE.MeshStandardMaterial) => {
        mm.color = color;
        mm.roughness = Math.min(1, (mm.roughness ?? 0.8) * 0.9 + 0.55);
        mm.metalness = 0;
        mm.needsUpdate = true;
      };
      Array.isArray(mat) ? mat.forEach(apply) : apply(mat);
    });
  }, [cloned, hex]);
  return (
    <Center>
      <primitive object={cloned} />
    </Center>
  );
}

function Loader() {
  return <Html center><div style={{ font: "600 0.7rem/1 system-ui", letterSpacing: "0.14em", textTransform: "uppercase", color: "#8A8680" }}>Loading…</div></Html>;
}

export default function Garment3D({ url, swatches }: { url: string; swatches: Swatch[] }) {
  const [hex, setHex] = useState(swatches[0]?.hex ?? "#2D2C2F");
  const [active, setActive] = useState(swatches[0]?.label ?? "");
  const wrap = useRef<HTMLDivElement>(null);

  return (
    <div className="g3d" ref={wrap}>
      <div className="g3d-stage">
        <Canvas shadows camera={{ position: [0, 0.2, 3.4], fov: 35 }} dpr={[1, 2]} gl={{ antialias: true, preserveDrawingBuffer: true }}>
          <color attach="background" args={["#EEEAE3"]} />
          <ambientLight intensity={0.6} />
          <directionalLight position={[3, 5, 4]} intensity={1.5} castShadow shadow-mapSize={[2048, 2048]} />
          <directionalLight position={[-4, 2, -2]} intensity={0.5} />
          <directionalLight position={[0, 3, -5]} intensity={0.7} />
          <Suspense fallback={<Loader />}>
            <Model url={url} hex={hex} />
            <ContactShadows position={[0, -1.15, 0]} opacity={0.35} scale={6} blur={2.6} far={3} />
          </Suspense>
          <OrbitControls enablePan={false} minDistance={2} maxDistance={6} enableDamping dampingFactor={0.08} />
        </Canvas>
      </div>

      <div className="g3d-swatches" role="group" aria-label="Color">
        {swatches.map((s) => (
          <button
            key={s.label}
            type="button"
            className={`g3d-dot${active === s.label ? " is-active" : ""}`}
            title={s.label}
            aria-pressed={active === s.label}
            style={{ background: s.hex }}
            onClick={() => { setHex(s.hex); setActive(s.label); }}
          />
        ))}
        <span className="g3d-colorname">{active}</span>
      </div>
    </div>
  );
}
