"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { Canvas, useThree, type ThreeEvent } from "@react-three/fiber";
import { OrbitControls, ContactShadows, useGLTF, useTexture, Html } from "@react-three/drei";
import * as THREE from "three";
import { DecalGeometry } from "three-stdlib";
import { DraggableArt, type ArtTransform } from "./DraggableArt";
import { STUDIO_FIT_UNITS, model3dPlacement, type Model3DCalibration, type Model3DHit, type Model3DPlacement } from "@/lib/zones";

// MOA Studio — places artwork on the 3D garment as a CONFORMING, LIT decal that
// wraps the surface and shades with the fabric, so the preview reads as real ink
// on the real product (not a flat sticker). The decal is sized to the exact real
// inches via the SKU's 3D calibration, so what the buyer sees IS what prints.
//   • EDIT: garment locked to the view; handles position the active art (the live
//     conforming decal shows the true result). Live real-inch dims + DPI.
//   • PREVIEW: free orbit; every placement conforms to the surface.

export type Zone = { id: string; label: string; box: { x: number; y: number; w: number; h: number } };
type View = "front" | "back";
type Box = { x: number; y: number; w: number; h: number; r?: number };

export type Placement = {
  id: string; view: View; zoneId: string; zoneLabel: string; box: Box; art: ArtTransform;
  method?: string; // decoration method — drives the decal's material (ink vs thread)
  spec3d?: Model3DPlacement;
};
export type StudioCapture = Placement & { widthIn: number | null; dpi: number | null };

const Z = new THREE.Vector3(0, 0, 1);
const clampDef: ArtTransform = { ox: 0.1, oy: 0.1, sx: 0.8, sy: 0.8, r: 0 };

// Decoration method → surface finish. Screen/DTF print = flat matte ink;
// embroidery = lower roughness (slight thread sheen) and sits a touch prouder.
function methodFinish(method?: string): { roughness: number; offset: number } {
  return /embroid/i.test(method || "") ? { roughness: 0.5, offset: -10 } : { roughness: 0.85, offset: -6 };
}

function recolor(root: THREE.Object3D, hex: string) {
  const color = new THREE.Color(hex);
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    (Array.isArray(m.material) ? m.material : [m.material]).forEach((mm) => {
      const s = mm as THREE.MeshStandardMaterial;
      s.map = null; s.color = color; s.roughness = 0.9; s.metalness = 0; s.needsUpdate = true;
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

// A conforming decal descriptor built off a real surface hit.
type DecalDesc = { geo: THREE.BufferGeometry; key: string; method?: string };

function buildDecalGeo(target: THREE.Mesh, point: THREE.Vector3, normal: THREE.Vector3, rotDeg: number, w: number, h: number): THREE.BufferGeometry {
  const q = new THREE.Quaternion().setFromUnitVectors(Z, normal).multiply(new THREE.Quaternion().setFromAxisAngle(Z, (rotDeg * Math.PI) / 180));
  const e = new THREE.Euler().setFromQuaternion(q);
  const depth = Math.max(w, h) * 2.2; // deep enough to wrap surface curvature
  return new DecalGeometry(target, point, e, new THREE.Vector3(Math.max(0.02, w), Math.max(0.02, h), depth));
}

// Raycast a placement's center + horizontal/vertical extents onto the mesh from a
// camera, given the garment's projected screen rect, and return a conforming
// decal geometry (or null if it misses). `flipX` mirrors the back camera's X.
function decalForPlacement(
  cloned: THREE.Object3D, cam: THREE.Camera, rect: { x: number; y: number; w: number; h: number },
  box: Box, art: ArtTransform, aspect: number, flipX: boolean, ray: THREE.Raycaster
): { geo: THREE.BufferGeometry } | null {
  const ndc = (fx: number, fy: number) => new THREE.Vector2(flipX ? -((rect.x + fx * rect.w) * 2 - 1) : (rect.x + fx * rect.w) * 2 - 1, -((rect.y + fy * rect.h) * 2 - 1));
  const hitPt = (fx: number, fy: number) => { ray.setFromCamera(ndc(fx, fy), cam); return ray.intersectObject(cloned, true)[0] ?? null; };
  const gx = (f: number) => box.x + box.w * f, gy = (f: number) => box.y + box.h * f;
  const aCx = art.ox + art.sx / 2, aCy = art.oy + art.sy / 2;
  const c = hitPt(gx(aCx), gy(aCy));
  if (!c || !c.face) return null;
  const l = hitPt(gx(art.ox), gy(aCy))?.point, r = hitPt(gx(art.ox + art.sx), gy(aCy))?.point;
  const w = l && r ? l.distanceTo(r) : 0.15;
  const n = c.face.normal.clone().transformDirection(c.object.matrixWorld).normalize();
  try {
    return { geo: buildDecalGeo(c.object as THREE.Mesh, c.point.clone(), n, art.r ?? 0, w, w / aspect) };
  } catch {
    return null;
  }
}

function DecalMeshes({ decals, tex }: { decals: DecalDesc[]; tex: THREE.Texture }) {
  return (
    <>
      {decals.map((d) => {
        const f = methodFinish(d.method);
        return (
          <mesh key={d.key} geometry={d.geo} renderOrder={3}>
            <meshStandardMaterial
              map={tex} transparent alphaTest={0.05} depthWrite={false}
              polygonOffset polygonOffsetFactor={f.offset} roughness={f.roughness} metalness={0}
              side={THREE.FrontSide}
            />
          </mesh>
        );
      })}
    </>
  );
}

function useArtAspect(tex: THREE.Texture): number {
  return useMemo(() => {
    const img = tex.image as { width?: number; height?: number } | undefined;
    return img?.width && img?.height ? img.width / img.height : 1;
  }, [tex]);
}

// EDIT backdrop: model rotated so the chosen view faces the camera. Reports the
// projected rect (for the handle overlay) + the active art's real-surface hit
// (for the exact inches), and renders every visible placement as a conforming
// decal so the buyer sees the true wrapped result while editing.
function EditBackdrop({ url, hex, view, bankedPlacements, activeBox, activeArt, activeMethod, model3d, artUrl, onRect, onHit, onArtChange, onArtCommit }: {
  url: string; hex: string; view: View;
  bankedPlacements: Placement[]; // saved placements on this view (static decals)
  activeBox: Box; activeArt: ArtTransform; activeMethod?: string;
  model3d?: Model3DCalibration | null;
  artUrl: string;
  onRect: (r: Box) => void;
  onHit: (h: Model3DHit | null) => void;
  onArtChange: (t: ArtTransform) => void; // direct on-mesh move
  onArtCommit: () => void;
}) {
  const cloned = useNormalizedModel(url, model3d?.fitUnits ?? STUDIO_FIT_UNITS);
  const { camera, size } = useThree();
  const tex = useTexture(artUrl);
  const aspect = useArtAspect(tex);
  useEffect(() => recolor(cloned, hex), [cloned, hex]);
  const rotY = view === "back" ? Math.PI : 0;
  const [dragging, setDragging] = useState(false);

  // The garment's projected screen rect — stable in edit (camera locked).
  const rect = useMemo(() => {
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
    return { x: minx, y: miny, w: Math.max(0.01, maxx - minx), h: Math.max(0.01, maxy - miny) };
  }, [cloned, rotY, camera, size.width, size.height]);

  // Banked decals — static, rebuilt only when a placement is saved/removed.
  const bankedDecals = useMemo(() => {
    const ray = new THREE.Raycaster();
    const out: DecalDesc[] = [];
    for (const p of bankedPlacements) {
      const d = decalForPlacement(cloned, camera, rect, p.box, p.art, aspect, false, ray);
      if (d) out.push({ geo: d.geo, key: p.id, method: p.method });
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cloned, camera, rect, aspect, JSON.stringify(bankedPlacements.map((p) => [p.id, p.box, p.art]))]);

  // Active decal + exact-inch hit — rebuilt live as the art moves (follows the drag).
  const active = useMemo(() => {
    const ray = new THREE.Raycaster();
    const d = decalForPlacement(cloned, camera, rect, activeBox, activeArt, aspect, false, ray);
    let hit: Model3DHit | null = null;
    if (model3d) {
      const sp = (fx: number, fy: number) => [rect.x + fx * rect.w, rect.y + fy * rect.h] as const;
      const hitAt = (cx: number, cy: number) => { ray.setFromCamera(new THREE.Vector2(cx * 2 - 1, -(cy * 2 - 1)), camera); return ray.intersectObject(cloned, true)[0]?.point ?? null; };
      const aCx = activeArt.ox + activeArt.sx / 2, aCy = activeArt.oy + activeArt.sy / 2;
      const [cx, cy] = sp(activeBox.x + activeBox.w * aCx, activeBox.y + activeBox.h * aCy);
      const [lx] = sp(activeBox.x + activeBox.w * activeArt.ox, 0);
      const [rx] = sp(activeBox.x + activeBox.w * (activeArt.ox + activeArt.sx), 0);
      const [, ty] = sp(0, activeBox.y + activeBox.h * activeArt.oy);
      const [, by] = sp(0, activeBox.y + activeBox.h * (activeArt.oy + activeArt.sy));
      const c = hitAt(cx, cy);
      if (c) {
        const lh = hitAt(lx, cy), rh = hitAt(rx, cy), th = hitAt(cx, ty), bh = hitAt(cx, by);
        hit = { centerWorldX: c.x, centerWorldY: c.y, widthWorld: lh && rh ? lh.distanceTo(rh) : 0, heightWorld: th && bh ? th.distanceTo(bh) : 0 };
      }
    }
    return { decal: d ? { geo: d.geo, key: "active", method: activeMethod } : null, hit };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cloned, camera, rect, aspect, model3d, activeMethod, activeBox.x, activeBox.y, activeBox.w, activeBox.h, activeArt.ox, activeArt.oy, activeArt.sx, activeArt.sy, activeArt.r]);

  useEffect(() => { onRect(rect); }, [rect, onRect]);
  useEffect(() => { onHit(active.hit); }, [active.hit, onHit]);

  // Direct on-mesh placement: a surface hit → the art's offset within its zone
  // (clamped to the print area), with a magnetic center-front snap.
  const moveTo = (point: THREE.Vector3) => {
    const ndc = point.clone().project(camera);
    const gfx = ((ndc.x + 1) / 2 - rect.x) / rect.w;
    const gfy = ((1 - ndc.y) / 2 - rect.y) / rect.h;
    let ox = (gfx - activeBox.x) / activeBox.w - activeArt.sx / 2;
    let oy = (gfy - activeBox.y) / activeBox.h - activeArt.sy / 2;
    ox = Math.min(1 - activeArt.sx, Math.max(0, ox));
    oy = Math.min(1 - activeArt.sy, Math.max(0, oy));
    const centerGx = activeBox.x + (ox + activeArt.sx / 2) * activeBox.w;
    if (Math.abs(centerGx - 0.5) < 0.022) {
      const sox = (0.5 - activeBox.x) / activeBox.w - activeArt.sx / 2;
      if (sox >= 0 && sox <= 1 - activeArt.sx) ox = sox;
    }
    onArtChange({ ...activeArt, ox, oy });
  };

  const decals = active.decal ? [...bankedDecals, active.decal] : bankedDecals;

  return (
    <group>
      <primitive
        object={cloned}
        onPointerDown={(e: ThreeEvent<PointerEvent>) => { e.stopPropagation(); setDragging(true); moveTo(e.point); }}
        onPointerMove={(e: ThreeEvent<PointerEvent>) => { if (dragging) { e.stopPropagation(); moveTo(e.point); } }}
        onPointerUp={() => { if (dragging) { setDragging(false); onArtCommit(); } }}
        onPointerOut={() => { if (dragging) { setDragging(false); onArtCommit(); } }}
      />
      <DecalMeshes decals={decals} tex={tex} />
    </group>
  );
}

// PREVIEW backdrop: model at rest, free orbit; every placement conforms to the
// surface (front placements from a front cam, back from a back cam).
export function PreviewBackdrop({ url, hex, artUrl, placements }: {
  url: string; hex: string; artUrl: string; placements: Placement[];
}) {
  const cloned = useNormalizedModel(url, STUDIO_FIT_UNITS);
  const tex = useTexture(artUrl);
  const aspect = useArtAspect(tex);
  useEffect(() => recolor(cloned, hex), [cloned, hex]);

  const decals = useMemo(() => {
    cloned.rotation.y = 0; cloned.updateMatrixWorld(true);
    const ray = new THREE.Raycaster();
    const mkCam = (z: number) => { const c = new THREE.PerspectiveCamera(35, 0.8, 0.1, 100); c.position.set(0, 0.2, z); c.lookAt(0, 0, 0); c.updateMatrixWorld(); return c; };
    const frontCam = mkCam(3.2), backCam = mkCam(-3.2);
    const rectFor = (cam: THREE.Camera) => {
      const box = new THREE.Box3().setFromObject(cloned);
      let mnx = 1, mny = 1, mxx = 0, mxy = 0;
      for (const x of [box.min.x, box.max.x]) for (const y of [box.min.y, box.max.y]) for (const z of [box.min.z, box.max.z]) {
        const v = new THREE.Vector3(x, y, z).project(cam);
        mnx = Math.min(mnx, (v.x + 1) / 2); mxx = Math.max(mxx, (v.x + 1) / 2);
        mny = Math.min(mny, (1 - v.y) / 2); mxy = Math.max(mxy, (1 - v.y) / 2);
      }
      return { x: mnx, y: mny, w: mxx - mnx, h: mxy - mny };
    };
    const fr = rectFor(frontCam), br = rectFor(backCam);
    const out: DecalDesc[] = [];
    for (const p of placements) {
      const back = p.view === "back";
      const d = decalForPlacement(cloned, back ? backCam : frontCam, back ? br : fr, p.box, p.art, aspect, back, ray);
      if (d) out.push({ geo: d.geo, key: p.id, method: p.method });
    }
    return out;
  }, [cloned, placements, aspect]);

  return (
    <group>
      <primitive object={cloned} />
      <DecalMeshes decals={decals} tex={tex} />
    </group>
  );
}

export default function Garment3DDecorator({
  url, artUrl, hex = "#C9C4B8", zones, backZones = [], artPxWidth, garmentRefWidthIn = 26, model3d, method, initialPlacements, onChange,
}: {
  url: string; artUrl: string; hex?: string;
  zones: Zone[];
  backZones?: Zone[];
  artPxWidth?: number; garmentRefWidthIn?: number;
  model3d?: Model3DCalibration | null;
  method?: string; // current decoration method → decal finish
  initialPlacements?: Placement[];
  onChange?: (c: StudioCapture[]) => void;
}) {
  const frontList = zones.length ? zones : [{ id: "full-front", label: "Full front", box: { x: 0.3, y: 0.34, w: 0.4, h: 0.34 } }];
  const backList = backZones.length ? backZones : [{ id: "center-back", label: "Center back", box: { x: 0.3, y: 0.3, w: 0.4, h: 0.34 } }];

  const seed0 = initialPlacements ?? [];
  const seedCur = seed0[seed0.length - 1];
  const [saved, setSaved] = useState<Placement[]>(seed0.slice(0, -1).map((p, i) => ({ ...p, id: `seed${i}` })));
  const [view, setView] = useState<View>(seedCur?.view ?? "front");
  const [zoneId, setZoneId] = useState(seedCur?.zoneId ?? frontList[0].id);
  const [art, setArt] = useState<ArtTransform>(seedCur?.art ?? clampDef);
  const [rect, setRect] = useState<Box>({ x: 0.18, y: 0.12, w: 0.64, h: 0.76 });
  const [hit, setHit] = useState<Model3DHit | null>(null);
  const [preview, setPreview] = useState(false);

  const activeZones = view === "front" ? frontList : backList;
  const zone = activeZones.find((z) => z.id === zoneId) ?? activeZones[0];

  const spec3d = model3d && hit && hit.widthWorld > 0 ? model3dPlacement(model3d, hit, view) : undefined;
  const current: Placement = { id: "current", view, zoneId: zone.id, zoneLabel: zone.label, box: zone.box, art, method, spec3d };
  const all = useMemo(() => [...saved, current], [saved, view, zoneId, art, spec3d]); // eslint-disable-line react-hooks/exhaustive-deps

  const savedOnView = useMemo(() => saved.filter((p) => p.view === view), [saved, view]);

  const artFrac = zone.box.w * art.sx;
  const widthIn = spec3d ? spec3d.widthIn : Math.round(artFrac * garmentRefWidthIn * 4) / 4;
  const dpi = artPxWidth && widthIn > 0 ? Math.round(artPxWidth / widthIn) : null;
  const dpiLevel = dpi == null ? "na" : dpi >= 150 ? "ok" : dpi >= 100 ? "warn" : "bad";

  useEffect(() => {
    onChange?.(all.map((p) => ({ ...p, widthIn: p.id === "current" ? widthIn : p.spec3d?.widthIn ?? null, dpi: p.id === "current" ? dpi : null })));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [all]);

  const resetArt = (t: ArtTransform = clampDef) => { setArt(t); };
  const setViewTo = (v: View) => { setView(v); const zs = v === "front" ? frontList : backList; setZoneId(zs[0].id); resetArt(); };
  const pickZone = (id: string) => { setZoneId(id); resetArt(); };
  const addPlacement = () => { setSaved((s) => [...s, { ...current, id: `p${s.length + 1}-${zone.id}` }]); resetArt(); };
  const removeSaved = (id: string) => setSaved((s) => s.filter((p) => p.id !== id));

  const boxStyle = {
    left: `${(rect.x + zone.box.x * rect.w) * 100}%`,
    top: `${(rect.y + zone.box.y * rect.h) * 100}%`,
    width: `${zone.box.w * rect.w * 100}%`,
    height: `${zone.box.h * rect.h * 100}%`,
  };

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
              <PreviewBackdrop url={url} hex={hex} artUrl={artUrl} placements={all} />
            ) : (
              <EditBackdrop url={url} hex={hex} view={view} bankedPlacements={savedOnView} activeBox={zone.box} activeArt={art} activeMethod={method} model3d={model3d} artUrl={artUrl} onRect={setRect} onHit={setHit} onArtChange={setArt} onArtCommit={() => {}} />
            )}
            <ContactShadows position={[0, -0.8, 0]} opacity={0.28} scale={4} blur={2.6} far={2.5} />
          </Suspense>
          <OrbitControls enableRotate={preview} enablePan={false} enableZoom={false} minPolarAngle={Math.PI * 0.32} maxPolarAngle={Math.PI * 0.6} enableDamping dampingFactor={0.08} />
        </Canvas>

        {!preview ? (
          <div className="studio3dx-overlay">
            <span className="studio3dx-guide studio3dx-guide--v" style={{ left: `${(rect.x + (zone.box.x + zone.box.w / 2) * rect.w) * 100}%` }} />
            <div className="studio3dx-zonebox" style={boxStyle}>
              <span className="studio3dx-zonebox-label">{zone.label} · print area</span>
              {/* handles for resize/rotate — move by dragging on the garment too;
                  the conforming 3D decal shows the actual art */}
              <DraggableArt url={artUrl} transform={art} onChange={setArt} snapCenter snapStraighten alwaysShowHandles ghost />
            </div>
          </div>
        ) : null}

        <div className="studio3dx-hud">
          <span className="studio3dx-dim">{widthIn}&Prime; wide{spec3d ? ` · ${spec3d.belowHpsIn}″ below HPS` : ""}</span>
          {dpi != null ? (
            <span className={`studio3dx-dpi studio3dx-dpi--${dpiLevel}`}>
              {dpiLevel === "ok" ? "Print-ready" : dpiLevel === "warn" ? "OK — softer at this size" : "Too low to print"} · {dpi} DPI
            </span>
          ) : null}
        </div>

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
          <p className="studio3dx-hint">Drag to move · pull a corner to resize · top handle to rotate · arrow keys to nudge. The logo wraps the garment exactly as it prints.</p>
        </>
      ) : (
        <p className="studio3dx-hint">Spin the garment to preview every placement in 3D. Tap <b>Edit</b> to keep adjusting.</p>
      )}
    </div>
  );
}
