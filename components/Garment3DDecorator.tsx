"use client";

import { Suspense, useEffect, useMemo, useRef, useState, type RefObject } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import type { ThreeEvent } from "@react-three/fiber";
import { OrbitControls, ContactShadows, useGLTF, useTexture, Decal, Html, Line } from "@react-three/drei";
import * as THREE from "three";

// PHASE 1c — ZONE-CONSTRAINED 3D placement. Artwork is placed inside the SKU's
// bounding-box zones (Left chest / Center / Full front …, from lib/zones) — not
// freeform anywhere. The buyer drags within the zone, and sizes/rotates; we
// capture the mesh UV (production invariant → pattern, Phase 2). Zones are the
// front-view fractional boxes ray-projected onto the garment front.

export type Zone = { id: string; label: string; box: { x: number; y: number; w: number; h: number } };

export type DecalCapture = {
  uv: [number, number] | null;
  sizeUv: number; // decal surface width in world units (→ inches in Phase 2)
  rotationDeg: number;
  zoneId: string;
  zoneLabel: string;
};

const Z = new THREE.Vector3(0, 0, 1);

// One scene: model + recolor + zone-projected decal + the zone outline.
function DecoScene({
  url,
  hex,
  artUrl,
  zone,
  offset,
  size,
  rotationDeg,
  setOffset,
  onCapture,
}: {
  url: string;
  hex: string;
  artUrl: string;
  zone: Zone;
  offset: { ox: number; oy: number };
  size: number;
  rotationDeg: number;
  setOffset: (o: { ox: number; oy: number }) => void;
  onCapture: (c: Omit<DecalCapture, "zoneId" | "zoneLabel">) => void;
}) {
  const { scene } = useGLTF(url);
  const art = useTexture(artUrl);
  const { size: viewport } = useThree();
  const dragging = useRef(false);

  // Normalize + center the model so the fixed front camera maps zones onto it.
  const cloned = useMemo(() => {
    const c = scene.clone(true);
    const b1 = new THREE.Box3().setFromObject(c);
    const s = 1.55 / (Math.max(...b1.getSize(new THREE.Vector3()).toArray()) || 1);
    c.scale.setScalar(s);
    const b2 = new THREE.Box3().setFromObject(c);
    c.position.sub(b2.getCenter(new THREE.Vector3()));
    return c;
  }, [scene]);

  // Keep the model's own normal/AO detail; only restyle the albedo color.
  useEffect(() => {
    const color = new THREE.Color(hex);
    cloned.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      (Array.isArray(m.material) ? m.material : [m.material]).forEach((mm) => {
        const s = mm as THREE.MeshStandardMaterial;
        s.map = null;
        s.color = color;
        s.roughness = 0.9;
        s.metalness = 0;
        s.needsUpdate = true;
      });
    });
  }, [cloned, hex]);

  const aspect = useMemo(() => {
    const img = art.image as { width?: number; height?: number } | undefined;
    return img?.width && img?.height ? img.width / img.height : 1;
  }, [art]);

  // FIXED front camera — zones are defined on the front view, so we project them
  // with a camera that never moves (OrbitControls only moves the *display* cam).
  const frontCam = useMemo(() => {
    const c = new THREE.PerspectiveCamera(35, viewport.width / viewport.height, 0.1, 100);
    c.position.set(0, 0.2, 3.2);
    c.lookAt(0, 0, 0);
    c.updateMatrixWorld();
    return c;
  }, [viewport.width, viewport.height]);

  // Raycast a front-view fraction (fx,fy ∈ 0..1, top-left origin) onto the mesh.
  const hitAt = useMemo(() => {
    const ray = new THREE.Raycaster();
    return (fx: number, fy: number): THREE.Intersection | null => {
      ray.setFromCamera(new THREE.Vector2(fx * 2 - 1, -(fy * 2 - 1)), frontCam);
      return ray.intersectObject(cloned, true)[0] ?? null;
    };
  }, [cloned, frontCam]);

  // Decal placement derived from the zone + offset + size.
  const placement = useMemo(() => {
    const cx = zone.box.x + zone.box.w * (0.5 + offset.ox * 0.5);
    const cy = zone.box.y + zone.box.h * (0.5 + offset.oy * 0.5);
    const c = hitAt(cx, cy);
    if (!c || !c.face) return null;
    const l = hitAt(zone.box.x + 0.02, cy);
    const r = hitAt(zone.box.x + zone.box.w - 0.02, cy);
    const zoneW = l && r ? l.point.distanceTo(r.point) : 0.5;
    const w = Math.max(0.04, size * zoneW);
    const h = w / aspect;
    const mesh = c.object as THREE.Mesh;
    const localPoint = mesh.worldToLocal(c.point.clone());
    const q = new THREE.Quaternion().setFromUnitVectors(Z, c.face.normal.clone());
    q.multiply(new THREE.Quaternion().setFromAxisAngle(Z, (rotationDeg * Math.PI) / 180));
    return {
      mesh,
      localPoint,
      rotation: new THREE.Euler().setFromQuaternion(q),
      scale: [w, h, Math.max(w, h) * 1.5] as [number, number, number],
      uv: c.uv ? ([c.uv.x, c.uv.y] as [number, number]) : null,
      surfaceW: w,
    };
  }, [zone, offset, size, rotationDeg, hitAt, aspect]);

  // Emit the capture whenever placement settles.
  useEffect(() => {
    if (placement) onCapture({ uv: placement.uv, sizeUv: placement.surfaceW, rotationDeg });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [placement]);

  // Zone outline on the garment (4 corners ray-projected) — the visible bounds.
  const outline = useMemo(() => {
    const { x, y, w, h } = zone.box;
    const corners: [number, number][] = [
      [x, y],
      [x + w, y],
      [x + w, y + h],
      [x, y + h],
      [x, y],
    ];
    const pts = corners.map(([fx, fy]) => hitAt(fx, fy)?.point).filter(Boolean) as THREE.Vector3[];
    // nudge slightly toward camera so the line isn't buried in the mesh
    return pts.length >= 4 ? pts.map((p) => p.clone().add(new THREE.Vector3(0, 0, 0.01))) : null;
  }, [zone, hitAt]);

  // Drag the decal — project the hit back to front-fraction, clamp to the zone.
  const onDrag = (e: ThreeEvent<PointerEvent>) => {
    if (!dragging.current) return;
    e.stopPropagation();
    const ndc = e.point.clone().project(frontCam);
    const fx = (ndc.x + 1) / 2;
    const fy = (1 - ndc.y) / 2;
    const ox = Math.max(-1, Math.min(1, ((fx - zone.box.x) / zone.box.w - 0.5) * 2));
    const oy = Math.max(-1, Math.min(1, ((fy - zone.box.y) / zone.box.h - 0.5) * 2));
    setOffset({ ox, oy });
  };

  return (
    <group>
      <primitive
        object={cloned}
        onPointerDown={(e: ThreeEvent<PointerEvent>) => { dragging.current = true; onDrag(e); }}
        onPointerMove={onDrag}
        onPointerUp={() => { dragging.current = false; }}
      />
      {outline ? <Line points={outline} color="#B04731" lineWidth={1.5} dashed dashSize={0.03} gapSize={0.02} /> : null}
      {placement ? (
        <Decal mesh={{ current: placement.mesh } as RefObject<THREE.Mesh>} position={placement.localPoint} rotation={placement.rotation} scale={placement.scale}>
          <meshBasicMaterial map={art} transparent polygonOffset polygonOffsetFactor={-10} toneMapped={false} />
        </Decal>
      ) : null}
    </group>
  );
}

export default function Garment3DDecorator({
  url,
  artUrl,
  hex = "#C9C4B8",
  zones,
  onChange,
}: {
  url: string;
  artUrl: string;
  hex?: string;
  zones: Zone[];
  onChange?: (c: DecalCapture) => void;
}) {
  const list = zones.length ? zones : [{ id: "full-front", label: "Full front", box: { x: 0.3, y: 0.34, w: 0.4, h: 0.34 } }];
  const [zoneId, setZoneId] = useState(list[0].id);
  const [offset, setOffset] = useState({ ox: 0, oy: 0 });
  const [size, setSize] = useState(0.6);
  const [rot, setRot] = useState(0);
  const zone = list.find((z) => z.id === zoneId) ?? list[0];

  // Reset the offset to centre when switching zones.
  const pickZone = (id: string) => { setZoneId(id); setOffset({ ox: 0, oy: 0 }); };

  const capture = (c: Omit<DecalCapture, "zoneId" | "zoneLabel">) =>
    onChange?.({ ...c, zoneId: zone.id, zoneLabel: zone.label });

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
            <DecoScene url={url} hex={hex} artUrl={artUrl} zone={zone} offset={offset} size={size} rotationDeg={rot} setOffset={setOffset} onCapture={capture} />
            <ContactShadows position={[0, -0.85, 0]} opacity={0.3} scale={4} blur={2.6} far={2.5} />
          </Suspense>
          {/* Limit orbit so the front (where zones live) stays in view while placing */}
          <OrbitControls makeDefault enablePan={false} minDistance={1.8} maxDistance={5} minPolarAngle={Math.PI * 0.3} maxPolarAngle={Math.PI * 0.62} minAzimuthAngle={-0.7} maxAzimuthAngle={0.7} enableDamping dampingFactor={0.08} />
        </Canvas>
      </div>

      <div className="g3d-zones" role="group" aria-label="Placement zone">
        {list.map((z) => (
          <button key={z.id} type="button" className={`g3d-zone-chip${z.id === zoneId ? " is-on" : ""}`} onClick={() => pickZone(z.id)}>
            {z.label}
          </button>
        ))}
      </div>

      <div className="g3d-decal-controls">
        <label>Size<input type="range" min={0.2} max={1} step={0.02} value={size} onChange={(e) => setSize(parseFloat(e.target.value))} /></label>
        <label>Rotate<input type="range" min={-180} max={180} step={1} value={rot} onChange={(e) => setRot(parseInt(e.target.value, 10))} /></label>
        <span className="g3d-decal-readout">{zone.label} · drag to position within the box</span>
      </div>
    </div>
  );
}
