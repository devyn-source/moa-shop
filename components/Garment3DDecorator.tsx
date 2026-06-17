"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import type { ThreeEvent } from "@react-three/fiber";
import { OrbitControls, ContactShadows, useGLTF, useTexture, Html, Line } from "@react-three/drei";
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
  locked,
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
  locked: boolean; // when finalized, the garment rotates and drag no longer moves the art
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

  // Garment's projected screen rect — zones map to the GARMENT's silhouette, not
  // the whole canvas, so a "left chest" box lands on the chest for ANY model
  // proportion (a bulky jacket and a tee both work).
  const screenRect = useMemo(() => {
    const box = new THREE.Box3().setFromObject(cloned);
    let minx = 1, miny = 1, maxx = 0, maxy = 0;
    for (const x of [box.min.x, box.max.x])
      for (const y of [box.min.y, box.max.y])
        for (const z of [box.min.z, box.max.z]) {
          const v = new THREE.Vector3(x, y, z).project(frontCam);
          const fx = (v.x + 1) / 2, fy = (1 - v.y) / 2;
          minx = Math.min(minx, fx); maxx = Math.max(maxx, fx);
          miny = Math.min(miny, fy); maxy = Math.max(maxy, fy);
        }
    return { x: minx, y: miny, w: Math.max(0.01, maxx - minx), h: Math.max(0.01, maxy - miny) };
  }, [cloned, frontCam]);

  // Raycast a GARMENT-relative fraction (0..1 within the garment's screen rect).
  const hitAt = useMemo(() => {
    const ray = new THREE.Raycaster();
    return (gfx: number, gfy: number): THREE.Intersection | null => {
      const sx = screenRect.x + gfx * screenRect.w;
      const sy = screenRect.y + gfy * screenRect.h;
      ray.setFromCamera(new THREE.Vector2(sx * 2 - 1, -(sy * 2 - 1)), frontCam);
      return ray.intersectObject(cloned, true)[0] ?? null;
    };
  }, [cloned, frontCam, screenRect]);

  const worldNormal = (i: THREE.Intersection) =>
    i.face ? i.face.normal.clone().transformDirection(i.object.matrixWorld).normalize() : new THREE.Vector3(0, 0, 1);

  // Box (at the zone centre) + art plane (zone centre + offset). Both are flat
  // quads laid on the surface — far more robust than projected DecalGeometry +
  // independently-raycast corners (which produced the broken outline).
  const placement = useMemo(() => {
    const zcx = zone.box.x + zone.box.w * 0.5;
    const zcy = zone.box.y + zone.box.h * 0.5;
    const zoneHit = hitAt(zcx, zcy);
    if (!zoneHit) return null;
    const l = hitAt(zone.box.x + 0.01, zcy), r = hitAt(zone.box.x + zone.box.w - 0.01, zcy);
    const t = hitAt(zcx, zone.box.y + 0.01), b = hitAt(zcx, zone.box.y + zone.box.h - 0.01);
    const zoneW = l && r ? l.point.distanceTo(r.point) : 0.3;
    const zoneH = t && b ? t.point.distanceTo(b.point) : zoneW * (zone.box.h / zone.box.w);

    const acx = zone.box.x + zone.box.w * (0.5 + offset.ox * 0.5);
    const acy = zone.box.y + zone.box.h * (0.5 + offset.oy * 0.5);
    const artHit = hitAt(acx, acy) ?? zoneHit;

    const zoneN = worldNormal(zoneHit);
    const artN = worldNormal(artHit);
    const artW = Math.max(0.03, size * zoneW);
    return {
      boxPos: zoneHit.point.clone().add(zoneN.clone().multiplyScalar(0.006)),
      boxQuat: new THREE.Quaternion().setFromUnitVectors(Z, zoneN),
      zoneW, zoneH,
      artPos: artHit.point.clone().add(artN.clone().multiplyScalar(0.012)),
      artQuat: new THREE.Quaternion().setFromUnitVectors(Z, artN).multiply(new THREE.Quaternion().setFromAxisAngle(Z, (rotationDeg * Math.PI) / 180)),
      artW,
      artH: artW / aspect,
      uv: artHit.uv ? ([artHit.uv.x, artHit.uv.y] as [number, number]) : null,
    };
  }, [zone, offset, size, rotationDeg, hitAt, aspect]);

  useEffect(() => {
    if (placement) onCapture({ uv: placement.uv, sizeUv: placement.artW, rotationDeg });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [placement]);

  const rectPoints = (w: number, h: number): [number, number, number][] => [
    [-w / 2, -h / 2, 0], [w / 2, -h / 2, 0], [w / 2, h / 2, 0], [-w / 2, h / 2, 0], [-w / 2, -h / 2, 0],
  ];

  // Drag → project the hit to a garment fraction, clamp inside the zone box.
  const onDrag = (e: ThreeEvent<PointerEvent>) => {
    if (!dragging.current || locked) return;
    e.stopPropagation();
    const ndc = e.point.clone().project(frontCam);
    const gfx = ((ndc.x + 1) / 2 - screenRect.x) / screenRect.w;
    const gfy = ((1 - ndc.y) / 2 - screenRect.y) / screenRect.h;
    const ox = Math.max(-1, Math.min(1, ((gfx - zone.box.x) / zone.box.w - 0.5) * 2));
    const oy = Math.max(-1, Math.min(1, ((gfy - zone.box.y) / zone.box.h - 0.5) * 2));
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
      {placement ? (
        <>
          <group position={placement.boxPos} quaternion={placement.boxQuat}>
            <Line points={rectPoints(placement.zoneW, placement.zoneH)} color="#B04731" lineWidth={1.6} transparent opacity={0.85} />
          </group>
          <mesh position={placement.artPos} quaternion={placement.artQuat}>
            <planeGeometry args={[placement.artW, placement.artH]} />
            <meshBasicMaterial map={art} transparent toneMapped={false} side={THREE.DoubleSide} depthWrite={false} />
          </mesh>
        </>
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
  // While placing, the garment is LOCKED (drag moves the art, no camera spin).
  // Finalizing unlocks rotation so the buyer can spin to preview the result.
  const [finalized, setFinalized] = useState(false);
  const zone = list.find((z) => z.id === zoneId) ?? list[0];

  // Reset the offset to centre when switching zones; switching re-enters placing.
  const pickZone = (id: string) => { setZoneId(id); setOffset({ ox: 0, oy: 0 }); setFinalized(false); };

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
            <DecoScene url={url} hex={hex} artUrl={artUrl} zone={zone} offset={offset} size={size} rotationDeg={rot} locked={finalized} setOffset={setOffset} onCapture={capture} />
            <ContactShadows position={[0, -0.85, 0]} opacity={0.3} scale={4} blur={2.6} far={2.5} />
          </Suspense>
          {/* Rotation is OFF while placing (drag moves the art, not the camera);
              it turns ON only once the placement is finalized — so positioning
              the artwork never spins the garment. */}
          <OrbitControls makeDefault enableRotate={finalized} enablePan={false} enableZoom={false} minDistance={1.8} maxDistance={5} minPolarAngle={Math.PI * 0.32} maxPolarAngle={Math.PI * 0.6} enableDamping dampingFactor={0.08} />
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
        <label>Size<input type="range" min={0.2} max={1} step={0.02} value={size} disabled={finalized} onChange={(e) => setSize(parseFloat(e.target.value))} /></label>
        <label>Rotate<input type="range" min={-180} max={180} step={1} value={rot} disabled={finalized} onChange={(e) => setRot(parseInt(e.target.value, 10))} /></label>
        <button type="button" className={`g3d-finalize${finalized ? " is-editing" : ""}`} onClick={() => setFinalized((f) => !f)}>
          {finalized ? "← Edit placement" : "Finalize ✓"}
        </button>
        <span className="g3d-decal-readout">
          {finalized ? `${zone.label} · drag to rotate & preview` : `${zone.label} · drag to position in the box`}
        </span>
      </div>
    </div>
  );
}
