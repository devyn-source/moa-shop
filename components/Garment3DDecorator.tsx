"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import { OrbitControls, ContactShadows, useGLTF, useTexture, Html } from "@react-three/drei";
import * as THREE from "three";
import { DraggableArt, type ArtTransform } from "./DraggableArt";

// MOA Studio — direct-manipulation placement on the 3D garment, with
// multi-placement, front/back views, and a 3D rotate-to-preview.
//   • EDIT: garment locked to the current view; the DraggableArt handle-editor
//     positions the active art inside the chosen zone (banked placements show as
//     static overlays). Live dimensions + DPI.
//   • PREVIEW: every placement is projected onto the garment surface and the
//     model is free to rotate, so the buyer sees front + back logos in 3D.

export type Zone = { id: string; label: string; box: { x: number; y: number; w: number; h: number } };
type View = "front" | "back";
type Box = { x: number; y: number; w: number; h: number; r?: number };

export type Placement = { id: string; view: View; zoneId: string; zoneLabel: string; box: Box; art: ArtTransform };
export type StudioCapture = Placement & { widthIn: number | null; dpi: number | null };

const Z = new THREE.Vector3(0, 0, 1);
const clampDef: ArtTransform = { ox: 0.1, oy: 0.1, sx: 0.8, sy: 0.8, r: 0 };

function recolor(root: THREE.Object3D, hex: string) {
  const color = new THREE.Color(hex);
  root.traverse((o) => {
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
}

function useNormalizedModel(url: string, fit: number) {
  const { scene } = useGLTF(url);
  return useMemo(() => {
    const c = scene.clone(true);
    const b1 = new THREE.Box3().setFromObject(c);
    c.scale.setScalar(fit / (Math.max(...b1.getSize(new THREE.Vector3()).toArray()) || 1));
    const b2 = new THREE.Box3().setFromObject(c);
    c.position.sub(b2.getCenter(new THREE.Vector3()));
    return c;
  }, [scene, fit]);
}

// EDIT backdrop: model rotated so the chosen view faces the locked front camera;
// reports the garment's projected screen rect so the HTML overlay sits over it.
function EditBackdrop({ url, hex, view, onRect }: { url: string; hex: string; view: View; onRect: (r: Box) => void }) {
  const cloned = useNormalizedModel(url, 1.45);
  const { camera, size } = useThree();
  useEffect(() => recolor(cloned, hex), [cloned, hex]);
  const rotY = view === "back" ? Math.PI : 0;
  useEffect(() => {
    cloned.rotation.y = rotY;
    cloned.updateMatrixWorld(true);
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
  }, [cloned, rotY, camera, size.width, size.height]);
  return <primitive object={cloned} />;
}

// PREVIEW backdrop: model at rest, free orbit; every placement projected onto
// the surface (front placements from a front cam, back from a back cam) as flat
// planes parented to the model so they rotate with it.
function PreviewBackdrop({ url, hex, artUrl, placements, frontZones, backZones }: {
  url: string; hex: string; artUrl: string; placements: Placement[];
  frontZones: Zone[]; backZones: Zone[];
}) {
  const cloned = useNormalizedModel(url, 1.45);
  const art = useTexture(artUrl);
  const aspect = useMemo(() => {
    const img = art.image as { width?: number; height?: number } | undefined;
    return img?.width && img?.height ? img.width / img.height : 1;
  }, [art]);
  useEffect(() => recolor(cloned, hex), [cloned, hex]);

  const planes = useMemo(() => {
    cloned.rotation.y = 0; cloned.updateMatrixWorld(true);
    const ray = new THREE.Raycaster();
    const frontCam = new THREE.PerspectiveCamera(35, 0.8, 0.1, 100); frontCam.position.set(0, 0.2, 3.2); frontCam.lookAt(0, 0, 0); frontCam.updateMatrixWorld();
    const backCam = new THREE.PerspectiveCamera(35, 0.8, 0.1, 100); backCam.position.set(0, 0.2, -3.2); backCam.lookAt(0, 0, 0); backCam.updateMatrixWorld();
    const rect = (cam: THREE.Camera) => {
      const box = new THREE.Box3().setFromObject(cloned);
      let mnx = 1, mny = 1, mxx = 0, mxy = 0;
      for (const x of [box.min.x, box.max.x]) for (const y of [box.min.y, box.max.y]) for (const z of [box.min.z, box.max.z]) {
        const v = new THREE.Vector3(x, y, z).project(cam);
        mnx = Math.min(mnx, (v.x + 1) / 2); mxx = Math.max(mxx, (v.x + 1) / 2);
        mny = Math.min(mny, (1 - v.y) / 2); mxy = Math.max(mxy, (1 - v.y) / 2);
      }
      return { x: mnx, y: mny, w: mxx - mnx, h: mxy - mny };
    };
    const fr = rect(frontCam), br = rect(backCam);
    const out: { pos: THREE.Vector3; quat: THREE.Quaternion; w: number; h: number; key: string }[] = [];
    for (const p of placements) {
      const cam = p.view === "back" ? backCam : frontCam;
      const r = p.view === "back" ? br : fr;
      // art centre in garment-relative fraction → screen → ray
      const gfx = p.box.x + p.box.w * (p.art.ox + p.art.sx / 2);
      const gfy = p.box.y + p.box.h * (p.art.oy + p.art.sy / 2);
      const sx = r.x + gfx * r.w, sy = r.y + gfy * r.h;
      // back cam sees a mirrored X — flip so it lands on the correct side
      const ndcX = (p.view === "back" ? -(sx * 2 - 1) : sx * 2 - 1);
      ray.setFromCamera(new THREE.Vector2(ndcX, -(sy * 2 - 1)), cam);
      const hit = ray.intersectObject(cloned, true)[0];
      if (!hit || !hit.face) continue;
      const lf = (gx: number) => {
        const lsx = r.x + gx * r.w; const lndc = (p.view === "back" ? -(lsx * 2 - 1) : lsx * 2 - 1);
        ray.setFromCamera(new THREE.Vector2(lndc, -(sy * 2 - 1)), cam);
        return ray.intersectObject(cloned, true)[0]?.point;
      };
      const a = lf(p.box.x + p.box.w * p.art.ox), b = lf(p.box.x + p.box.w * (p.art.ox + p.art.sx));
      const w = a && b ? a.distanceTo(b) : 0.15;
      const n = hit.face.normal.clone().transformDirection(hit.object.matrixWorld).normalize();
      const quat = new THREE.Quaternion().setFromUnitVectors(Z, n).multiply(new THREE.Quaternion().setFromAxisAngle(Z, ((p.art.r ?? 0) * Math.PI) / 180));
      out.push({ pos: hit.point.clone().add(n.multiplyScalar(0.012)), quat, w: Math.max(0.03, w), h: Math.max(0.03, w) / aspect, key: p.id });
    }
    return out;
  }, [cloned, placements, aspect]);

  return (
    <group>
      <primitive object={cloned} />
      {planes.map((pl) => (
        <mesh key={pl.key} position={pl.pos} quaternion={pl.quat}>
          <planeGeometry args={[pl.w, pl.h]} />
          <meshBasicMaterial map={art} transparent toneMapped={false} side={THREE.DoubleSide} depthWrite={false} />
        </mesh>
      ))}
    </group>
  );
}

export default function Garment3DDecorator({
  url, artUrl, hex = "#C9C4B8", zones, backZones = [], artPxWidth, garmentRefWidthIn = 26, onChange,
}: {
  url: string; artUrl: string; hex?: string;
  zones: Zone[]; // front zones
  backZones?: Zone[];
  artPxWidth?: number; garmentRefWidthIn?: number;
  onChange?: (c: StudioCapture[]) => void;
}) {
  const frontList = zones.length ? zones : [{ id: "full-front", label: "Full front", box: { x: 0.3, y: 0.34, w: 0.4, h: 0.34 } }];
  const backList = backZones.length ? backZones : [{ id: "center-back", label: "Center back", box: { x: 0.3, y: 0.3, w: 0.4, h: 0.34 } }];

  const [saved, setSaved] = useState<Placement[]>([]);
  const [view, setView] = useState<View>("front");
  const [zoneId, setZoneId] = useState(frontList[0].id);
  const [art, setArt] = useState<ArtTransform>(clampDef);
  const [rect, setRect] = useState<Box>({ x: 0.18, y: 0.12, w: 0.64, h: 0.76 });
  const [preview, setPreview] = useState(false);

  const activeZones = view === "front" ? frontList : backList;
  const zone = activeZones.find((z) => z.id === zoneId) ?? activeZones[0];

  const current: Placement = { id: "current", view, zoneId: zone.id, zoneLabel: zone.label, box: zone.box, art };
  const all = useMemo(() => [...saved, current], [saved, view, zoneId, art]); // eslint-disable-line react-hooks/exhaustive-deps

  const artFrac = zone.box.w * art.sx;
  const widthIn = Math.round(artFrac * garmentRefWidthIn * 4) / 4;
  const dpi = artPxWidth && widthIn > 0 ? Math.round(artPxWidth / widthIn) : null;
  const dpiLevel = dpi == null ? "na" : dpi >= 150 ? "ok" : dpi >= 100 ? "warn" : "bad";

  useEffect(() => {
    onChange?.(all.map((p) => ({ ...p, widthIn: p.id === "current" ? widthIn : null, dpi: p.id === "current" ? dpi : null })));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [all]);

  const setViewTo = (v: View) => { setView(v); const zs = v === "front" ? frontList : backList; setZoneId(zs[0].id); setArt(clampDef); };
  const pickZone = (id: string) => { setZoneId(id); setArt(clampDef); };
  const addPlacement = () => {
    setSaved((s) => [...s, { ...current, id: `p${s.length + 1}-${zone.id}` }]);
    setArt(clampDef);
  };
  const removeSaved = (id: string) => setSaved((s) => s.filter((p) => p.id !== id));

  const boxStyle = {
    left: `${(rect.x + zone.box.x * rect.w) * 100}%`,
    top: `${(rect.y + zone.box.y * rect.h) * 100}%`,
    width: `${zone.box.w * rect.w * 100}%`,
    height: `${zone.box.h * rect.h * 100}%`,
  };
  const savedOnView = saved.filter((p) => p.view === view);

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
            {preview ? (
              <PreviewBackdrop url={url} hex={hex} artUrl={artUrl} placements={all} frontZones={frontList} backZones={backList} />
            ) : (
              <EditBackdrop url={url} hex={hex} view={view} onRect={setRect} />
            )}
            <ContactShadows position={[0, -0.8, 0]} opacity={0.28} scale={4} blur={2.6} far={2.5} />
          </Suspense>
          <OrbitControls enableRotate={preview} enablePan={false} enableZoom={false} minPolarAngle={Math.PI * 0.32} maxPolarAngle={Math.PI * 0.6} enableDamping dampingFactor={0.08} />
        </Canvas>

        {!preview ? (
          <div className="studio3dx-overlay">
            <span className="studio3dx-guide studio3dx-guide--v" style={{ left: `${(rect.x + (zone.box.x + zone.box.w / 2) * rect.w) * 100}%` }} />
            {/* banked placements on this view — static */}
            {savedOnView.map((p) => (
              <span key={p.id} className="studio3dx-saved-art" style={{
                left: `${(rect.x + (p.box.x + p.box.w * p.art.ox) * rect.w) * 100}%`,
                top: `${(rect.y + (p.box.y + p.box.h * p.art.oy) * rect.h) * 100}%`,
                width: `${p.box.w * p.art.sx * rect.w * 100}%`,
                height: `${p.box.h * p.art.sy * rect.h * 100}%`,
                transform: `rotate(${p.art.r ?? 0}deg)`,
                backgroundImage: `url("${artUrl}")`,
              }} />
            ))}
            <div className="studio3dx-zonebox" style={boxStyle}>
              <span className="studio3dx-zonebox-label">{zone.label} · print area</span>
              <DraggableArt url={artUrl} transform={art} onChange={setArt} snapCenter alwaysShowHandles />
            </div>
          </div>
        ) : null}

        <div className="studio3dx-hud">
          {!preview ? <span className="studio3dx-dim">{widthIn}&Prime; wide</span> : <span className="studio3dx-dim">Drag to rotate · {all.length} placement{all.length > 1 ? "s" : ""}</span>}
          {!preview && dpi != null ? (
            <span className={`studio3dx-dpi studio3dx-dpi--${dpiLevel}`}>
              {dpiLevel === "ok" ? "Print-ready" : dpiLevel === "warn" ? "OK — softer at this size" : "Too low to print"} · {dpi} DPI
            </span>
          ) : null}
        </div>

        {/* View + preview toggles */}
        <div className="studio3dx-views">
          <button type="button" className={`studio3dx-viewpill${view === "front" && !preview ? " is-on" : ""}`} onClick={() => { setPreview(false); setViewTo("front"); }}>Front</button>
          <button type="button" className={`studio3dx-viewpill${view === "back" && !preview ? " is-on" : ""}`} onClick={() => { setPreview(false); setViewTo("back"); }}>Back</button>
          <button type="button" className={`studio3dx-viewpill${preview ? " is-on" : ""}`} onClick={() => setPreview((p) => !p)}>{preview ? "Edit" : "Preview 3D"}</button>
        </div>
      </div>

      {!preview ? (
        <>
          <div className="g3d-zones" role="group" aria-label="Placement zone">
            {activeZones.map((z) => (
              <button key={z.id} type="button" className={`g3d-zone-chip${z.id === zoneId ? " is-on" : ""}`} onClick={() => pickZone(z.id)}>{z.label}</button>
            ))}
          </div>
          <div className="studio3dx-multi">
            {saved.length ? (
              <ul className="studio3dx-saved-list">
                {saved.map((p) => (
                  <li key={p.id} className="studio3dx-saved-chip">
                    <span className="studio3dx-saved-thumb" style={{ backgroundImage: `url("${artUrl}")` }} aria-hidden />
                    <span className="studio3dx-saved-meta"><strong>{p.zoneLabel}</strong><em>{p.view}</em></span>
                    <button type="button" className="studio3dx-saved-x" onClick={() => removeSaved(p.id)} aria-label={`Remove ${p.zoneLabel}`}>✕</button>
                  </li>
                ))}
              </ul>
            ) : null}
            <button type="button" className="studio3dx-addbtn" onClick={addPlacement}>+ Save &amp; add another placement</button>
          </div>
          <p className="studio3dx-hint">Drag to move · pull a corner to resize · top handle to rotate · arrow keys to nudge.</p>
        </>
      ) : (
        <p className="studio3dx-hint">Spin the garment to preview every placement in 3D. Tap <b>Edit</b> to keep adjusting.</p>
      )}
    </div>
  );
}
