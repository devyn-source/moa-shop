"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import { OrbitControls, ContactShadows, useGLTF, Html } from "@react-three/drei";
import * as THREE from "three";
import { DraggableArt, type ArtTransform } from "./DraggableArt";

// MOA Studio — direct-manipulation artwork placement ON the 3D garment.
// The 3D model is the canvas; the proven 2D handle-editor (DraggableArt: drag to
// move, corners to resize, top handle to rotate, arrow-nudge, center-snap) is
// overlaid on the chosen zone, projected onto the garment's silhouette so it
// lands right on any model. Output is a standard placement (zone box + art
// transform) → the existing dims/DPI/proof/tech-pack pipeline works unchanged.

export type Zone = { id: string; label: string; box: { x: number; y: number; w: number; h: number } };

export type StudioCapture = {
  zoneId: string;
  zoneLabel: string;
  box: { x: number; y: number; w: number; h: number; r?: number };
  art: ArtTransform;
  widthIn: number | null; // live real print width (approx until pattern-calibrated)
  dpi: number | null;
};

// Reports the garment's projected screen rect (0..1 of the canvas) so the HTML
// overlay can sit exactly over it. Recolors + keeps the model's own detail.
function GarmentBackdrop({
  url,
  hex,
  fit,
  onRect,
}: {
  url: string;
  hex: string;
  fit: number;
  onRect: (r: { x: number; y: number; w: number; h: number }) => void;
}) {
  const { scene } = useGLTF(url);
  const { size, camera } = useThree();

  const cloned = useMemo(() => {
    const c = scene.clone(true);
    const b1 = new THREE.Box3().setFromObject(c);
    c.scale.setScalar(fit / (Math.max(...b1.getSize(new THREE.Vector3()).toArray()) || 1));
    const b2 = new THREE.Box3().setFromObject(c);
    c.position.sub(b2.getCenter(new THREE.Vector3()));
    return c;
  }, [scene, fit]);

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

  // Project the model bbox to a canvas-fraction rect (re-run when framing changes).
  useEffect(() => {
    const box = new THREE.Box3().setFromObject(cloned);
    let minx = 1, miny = 1, maxx = 0, maxy = 0;
    for (const x of [box.min.x, box.max.x])
      for (const y of [box.min.y, box.max.y])
        for (const z of [box.min.z, box.max.z]) {
          const v = new THREE.Vector3(x, y, z).project(camera);
          minx = Math.min(minx, (v.x + 1) / 2); maxx = Math.max(maxx, (v.x + 1) / 2);
          miny = Math.min(miny, (1 - v.y) / 2); maxy = Math.max(maxy, (1 - v.y) / 2);
        }
    onRect({ x: minx, y: miny, w: Math.max(0.01, maxx - minx), h: Math.max(0.01, maxy - miny) });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cloned, camera, size.width, size.height]);

  return <primitive object={cloned} />;
}

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

export default function Garment3DDecorator({
  url,
  artUrl,
  hex = "#C9C4B8",
  zones,
  artPxWidth,
  garmentRefWidthIn = 26,
  onChange,
}: {
  url: string;
  artUrl: string;
  hex?: string;
  zones: Zone[];
  artPxWidth?: number; // native px width of the uploaded art (for live DPI)
  garmentRefWidthIn?: number; // real garment silhouette width in inches (dims approx)
  onChange?: (c: StudioCapture) => void;
}) {
  const list = zones.length ? zones : [{ id: "full-front", label: "Full front", box: { x: 0.3, y: 0.34, w: 0.4, h: 0.34 } }];
  const [zoneId, setZoneId] = useState(list[0].id);
  const [art, setArt] = useState<ArtTransform>({ ox: 0.1, oy: 0.1, sx: 0.8, sy: 0.8, r: 0 });
  const [rect, setRect] = useState({ x: 0.18, y: 0.12, w: 0.64, h: 0.76 });
  const zone = list.find((z) => z.id === zoneId) ?? list[0];

  const pickZone = (id: string) => { setZoneId(id); setArt({ ox: 0.1, oy: 0.1, sx: 0.8, sy: 0.8, r: 0 }); };

  // The zone box in canvas %: garment rect offset by the zone fractions.
  const boxStyle = {
    left: `${(rect.x + zone.box.x * rect.w) * 100}%`,
    top: `${(rect.y + zone.box.y * rect.h) * 100}%`,
    width: `${zone.box.w * rect.w * 100}%`,
    height: `${zone.box.h * rect.h * 100}%`,
  };

  // Live dimensions + DPI. Art width as a fraction of the garment silhouette →
  // inches (approx; exact once a pattern-aligned model is calibrated).
  const artFracOfGarment = zone.box.w * art.sx;
  const widthIn = Math.round(artFracOfGarment * garmentRefWidthIn * 4) / 4;
  const dpi = artPxWidth && widthIn > 0 ? Math.round(artPxWidth / widthIn) : null;
  const dpiLevel = dpi == null ? "na" : dpi >= 150 ? "ok" : dpi >= 100 ? "warn" : "bad";

  useEffect(() => {
    onChange?.({ zoneId: zone.id, zoneLabel: zone.label, box: zone.box, art, widthIn, dpi });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zoneId, art]);

  return (
    <div className="studio3dx">
      <div className="studio3dx-stage">
        <Canvas flat shadows camera={{ position: [0, 0.2, 3.2], fov: 35 }} dpr={[1, 2]} gl={{ antialias: true, preserveDrawingBuffer: true }}>
          <color attach="background" args={["#EEEAE3"]} />
          <ambientLight intensity={0.6} />
          <hemisphereLight args={["#ffffff", "#d8d2c8", 0.3]} />
          <directionalLight position={[3, 5, 4]} intensity={0.95} castShadow shadow-mapSize={[2048, 2048]} />
          <directionalLight position={[-4, 2, -2]} intensity={0.3} />
          <Suspense fallback={<Html center>Loading…</Html>}>
            <GarmentBackdrop url={url} hex={hex} fit={1.45} onRect={setRect} />
            <ContactShadows position={[0, -0.8, 0]} opacity={0.28} scale={4} blur={2.6} far={2.5} />
          </Suspense>
          {/* No rotation while placing — the front view is the editing surface. */}
          <OrbitControls enableRotate={false} enablePan={false} enableZoom={false} />
        </Canvas>

        {/* HTML editing overlay — sits exactly over the garment's chest. */}
        <div className="studio3dx-overlay">
          {/* center guides */}
          <span className="studio3dx-guide studio3dx-guide--v" style={{ left: `${(rect.x + (zone.box.x + zone.box.w / 2) * rect.w) * 100}%` }} />
          <div className="studio3dx-zonebox" style={boxStyle}>
            <span className="studio3dx-zonebox-label">{zone.label} · print area</span>
            <DraggableArt url={artUrl} transform={art} onChange={setArt} snapCenter alwaysShowHandles />
          </div>
        </div>

        {/* Live dimensions + print-quality HUD */}
        <div className="studio3dx-hud">
          <span className="studio3dx-dim">{widthIn}&Prime; wide</span>
          {dpi != null ? (
            <span className={`studio3dx-dpi studio3dx-dpi--${dpiLevel}`}>
              {dpiLevel === "ok" ? "Print-ready" : dpiLevel === "warn" ? "OK — softer at this size" : "Too low to print"} · {dpi} DPI
            </span>
          ) : null}
        </div>
      </div>

      <div className="g3d-zones" role="group" aria-label="Placement zone">
        {list.map((z) => (
          <button key={z.id} type="button" className={`g3d-zone-chip${z.id === zoneId ? " is-on" : ""}`} onClick={() => pickZone(z.id)}>
            {z.label}
          </button>
        ))}
      </div>
      <p className="studio3dx-hint">Drag the artwork to move · pull a corner to resize · top handle to rotate · arrow keys to nudge.</p>
    </div>
  );
}
