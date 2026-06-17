"use client";

import { Suspense, useEffect, useMemo, useRef, useState, type RefObject } from "react";
import { Canvas } from "@react-three/fiber";
import type { ThreeEvent } from "@react-three/fiber";
import { OrbitControls, ContactShadows, useGLTF, useTexture, Decal, Html } from "@react-three/drei";
import * as THREE from "three";

// PHASE 1 of the 3D-driven artwork system: place uploaded art as a DECAL on the
// garment surface and capture the placement as a mesh UV coordinate + size.
// UV is the production-invariant: with pattern-aligned model UVs (vendor spec),
// UV maps directly to the DXF pattern piece → real inches → tech-pack callouts
// (Phases 2–3). Here we build the editor + the capture; mapping comes next.

export type DecalCapture = {
  uv: [number, number] | null; // mesh UV at the decal center — the invariant
  point: [number, number, number]; // world hit point (debug / proof)
  sizeUv: number; // decal size as a fraction of UV space (→ real inches later)
  rotationDeg: number; // in-plane rotation
  meshName: string | null;
};

const Z = new THREE.Vector3(0, 0, 1);

function makeFabricNormal(): THREE.Texture {
  const S = 128;
  const cv = document.createElement("canvas");
  cv.width = cv.height = S;
  const ctx = cv.getContext("2d")!;
  const img = ctx.createImageData(S, S);
  for (let y = 0; y < S; y++)
    for (let x = 0; x < S; x++) {
      let nx = Math.cos((x / S) * Math.PI * 2 * 16) * 0.6;
      let ny = Math.cos((y / S) * Math.PI * 2 * 16) * 0.6;
      const inv = 1 / Math.hypot(nx, ny, 1);
      const i = (y * S + x) * 4;
      img.data[i] = (nx * inv * 0.5 + 0.5) * 255;
      img.data[i + 1] = (ny * inv * 0.5 + 0.5) * 255;
      img.data[i + 2] = (inv * 0.5 + 0.5) * 255;
      img.data[i + 3] = 255;
    }
  ctx.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(cv);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(60, 60);
  t.colorSpace = THREE.NoColorSpace;
  return t;
}
let _fab: THREE.Texture | null = null;
const fabric = () => (_fab ||= makeFabricNormal());

function DecoModel({
  url,
  hex,
  artUrl,
  size,
  rotationDeg,
  onPlace,
}: {
  url: string;
  hex: string;
  artUrl: string;
  size: number;
  rotationDeg: number;
  onPlace: (c: DecalCapture) => void;
}) {
  const { scene } = useGLTF(url);
  const art = useTexture(artUrl);
  const dragging = useRef(false);

  // Clone, normalize scale, and CENTER at origin so world == the frame we place in.
  const cloned = useMemo(() => {
    const c = scene.clone(true);
    const box = new THREE.Box3().setFromObject(c);
    const size3 = box.getSize(new THREE.Vector3());
    const maxDim = Math.max(size3.x, size3.y, size3.z) || 1;
    c.scale.setScalar(1.55 / maxDim);
    const box2 = new THREE.Box3().setFromObject(c);
    const center = box2.getCenter(new THREE.Vector3());
    c.position.sub(center);
    return c;
  }, [scene]);

  // Matte fabric recolor (same treatment as the viewer).
  useEffect(() => {
    const color = new THREE.Color(hex);
    cloned.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      const mats = Array.isArray(m.material) ? m.material : [m.material];
      mats.forEach((mm) => {
        const s = mm as THREE.MeshStandardMaterial;
        s.map = null;
        s.aoMap = null;
        s.color = color;
        s.roughness = 1;
        s.metalness = 0;
        s.normalMap = fabric();
        s.normalScale = new THREE.Vector2(0.35, 0.35);
        s.needsUpdate = true;
      });
    });
  }, [cloned, hex]);

  const aspect = useMemo(() => {
    const img = art.image as { width?: number; height?: number } | undefined;
    return img?.width && img?.height ? img.width / img.height : 1;
  }, [art]);

  const [target, setTarget] = useState<THREE.Mesh | null>(null);
  const [pos, setPos] = useState<THREE.Vector3 | null>(null);
  const [orient, setOrient] = useState<THREE.Euler>(() => new THREE.Euler());

  // Place / drag: raycast hit gives the local point, surface normal, and UV.
  const place = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    const mesh = e.object as THREE.Mesh;
    if (!e.face) return;
    const localPoint = mesh.worldToLocal(e.point.clone());
    const n = e.face.normal.clone(); // local-space normal
    const q = new THREE.Quaternion().setFromUnitVectors(Z, n);
    q.multiply(new THREE.Quaternion().setFromAxisAngle(Z, (rotationDeg * Math.PI) / 180));
    setTarget(mesh);
    setPos(localPoint);
    setOrient(new THREE.Euler().setFromQuaternion(q));
    onPlace({
      uv: e.uv ? [e.uv.x, e.uv.y] : null,
      point: [e.point.x, e.point.y, e.point.z],
      sizeUv: size,
      rotationDeg,
      meshName: mesh.name || null,
    });
  };

  // Keep in-plane rotation live when the slider moves (re-orient around normal).
  useEffect(() => {
    if (!target || !pos) return;
    // recompute orientation using the last normal direction
    // (derive normal from current euler's +Z)
    const n = Z.clone().applyEuler(orient);
    const q = new THREE.Quaternion().setFromUnitVectors(Z, n);
    q.multiply(new THREE.Quaternion().setFromAxisAngle(Z, (rotationDeg * Math.PI) / 180));
    setOrient(new THREE.Euler().setFromQuaternion(q));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rotationDeg]);

  const decalScale = useMemo<[number, number, number]>(() => [size * 2 * aspect, size * 2, 0.6], [size, aspect]);

  return (
    <group>
      <primitive
        object={cloned}
        onPointerDown={(e: ThreeEvent<PointerEvent>) => { dragging.current = true; place(e); }}
        onPointerMove={(e: ThreeEvent<PointerEvent>) => { if (dragging.current) place(e); }}
        onPointerUp={() => { dragging.current = false; }}
      />
      {target && pos ? (
        <Decal mesh={{ current: target } as RefObject<THREE.Mesh>} position={pos} rotation={orient} scale={decalScale}>
          <meshBasicMaterial map={art} transparent polygonOffset polygonOffsetFactor={-10} toneMapped={false} />
        </Decal>
      ) : (
        <Html center>
          <div style={{ font: "600 0.7rem/1 system-ui", letterSpacing: "0.12em", textTransform: "uppercase", color: "#8A8680", whiteSpace: "nowrap" }}>
            Tap the garment to place
          </div>
        </Html>
      )}
    </group>
  );
}

export default function Garment3DDecorator({ url, artUrl, hex = "#C9C4B8" }: { url: string; artUrl: string; hex?: string }) {
  const [size, setSize] = useState(0.18);
  const [rot, setRot] = useState(0);
  const [cap, setCap] = useState<DecalCapture | null>(null);

  return (
    <div className="g3d">
      <div className="g3d-stage">
        <Canvas flat shadows camera={{ position: [0, 0.2, 3.2], fov: 35 }} dpr={[1, 2]} gl={{ antialias: true, preserveDrawingBuffer: true }}>
          <color attach="background" args={["#EEEAE3"]} />
          <ambientLight intensity={0.6} />
          <hemisphereLight args={["#ffffff", "#d8d2c8", 0.3]} />
          <directionalLight position={[3, 5, 4]} intensity={0.95} castShadow shadow-mapSize={[2048, 2048]} />
          <directionalLight position={[-4, 2, -2]} intensity={0.3} />
          <Suspense fallback={<Html center>Loading…</Html>}>
            <DecoModel url={url} hex={hex} artUrl={artUrl} size={size} rotationDeg={rot} onPlace={setCap} />
            <ContactShadows position={[0, -0.85, 0]} opacity={0.3} scale={4} blur={2.6} far={2.5} />
          </Suspense>
          <OrbitControls makeDefault enablePan={false} minDistance={1.6} maxDistance={6} enableDamping dampingFactor={0.08} />
        </Canvas>
      </div>

      <div className="g3d-decal-controls">
        <label>Size<input type="range" min={0.06} max={0.4} step={0.005} value={size} onChange={(e) => setSize(parseFloat(e.target.value))} /></label>
        <label>Rotate<input type="range" min={-180} max={180} step={1} value={rot} onChange={(e) => setRot(parseInt(e.target.value, 10))} /></label>
        <span className="g3d-decal-readout">
          {cap?.uv ? `UV ${cap.uv[0].toFixed(3)}, ${cap.uv[1].toFixed(3)} · size ${(size * 100).toFixed(0)}% · ${rot}°` : "Place artwork to capture UV"}
        </span>
      </div>
    </div>
  );
}
