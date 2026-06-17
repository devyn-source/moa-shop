"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import { OrbitControls, ContactShadows, useGLTF, Html } from "@react-three/drei";
import * as THREE from "three";
import {
  getDefaultZones,
  normaliseZonesPayload,
  normaliseCalibration,
  model3dPlacement,
  STUDIO_FIT_UNITS,
  type Box,
  type ProductZones,
  type View,
  type Zone,
  type Model3DCalibration,
  type Model3DHit,
} from "@/lib/zones";
import type { CatalogProduct } from "@/lib/types";

// Author placement zones DIRECTLY on the 3D garment — the SAME space the customer
// configures in (boxes are fractions of the garment's projected screen rect, not
// the canvas). Real-inch sizes come from raycasting each box onto the mesh and
// scaling by the SKU's 3D calibration, so what you draw is exactly what ships.

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const MIN = 0.04; // smallest box dim as a fraction of the garment rect
const IMPRINT_MAX = { embroidery: 5, dtf: 12, screen: 14 };
function methodFit(widthIn: number): { label: string; over: boolean } {
  if (widthIn > IMPRINT_MAX.screen) return { label: "over print max", over: true };
  const fits: string[] = [];
  if (widthIn <= IMPRINT_MAX.embroidery) fits.push("emb");
  if (widthIn <= IMPRINT_MAX.dtf) fits.push("DTF");
  if (widthIn <= IMPRINT_MAX.screen) fits.push("screen");
  return { label: fits.join(" · ") || "—", over: false };
}

type RectT = { x: number; y: number; w: number; h: number };

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

// Renders the garment for the chosen view, reports its projected screen rect, and
// (when idle) raycasts every zone box onto the surface → a hit map for inches.
function Backdrop({
  url, hex, view, zones, model3d, idle, onRect, onHits,
}: {
  url: string; hex: string; view: View;
  zones: Zone[];
  model3d?: Model3DCalibration | null;
  idle: boolean;
  onRect: (r: RectT) => void;
  onHits: (h: Record<string, Model3DHit>) => void;
}) {
  const cloned = useNormalizedModel(url, model3d?.fitUnits ?? STUDIO_FIT_UNITS);
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
    const rect = { x: minx, y: miny, w: Math.max(0.01, maxx - minx), h: Math.max(0.01, maxy - miny) };
    onRect(rect);

    // Raycast each zone box → world hit (only when not actively dragging).
    if (!model3d || !idle) return;
    const ray = new THREE.Raycaster();
    const hitAt = (cx: number, cy: number) => {
      ray.setFromCamera(new THREE.Vector2(cx * 2 - 1, -(cy * 2 - 1)), camera);
      return ray.intersectObject(cloned, true)[0]?.point ?? null;
    };
    const out: Record<string, Model3DHit> = {};
    for (const z of zones) {
      const cx = rect.x + (z.box.x + z.box.w / 2) * rect.w;
      const cy = rect.y + (z.box.y + z.box.h / 2) * rect.h;
      const lx = rect.x + z.box.x * rect.w, rx = rect.x + (z.box.x + z.box.w) * rect.w;
      const ty = rect.y + z.box.y * rect.h, by = rect.y + (z.box.y + z.box.h) * rect.h;
      const c = hitAt(cx, cy);
      if (!c) continue;
      const lh = hitAt(lx, cy), rh = hitAt(rx, cy), th = hitAt(cx, ty), bh = hitAt(cx, by);
      const widthWorld = lh && rh ? lh.distanceTo(rh) : 0;
      const heightWorld = th && bh ? th.distanceTo(bh) : widthWorld;
      out[z.id] = { centerWorldX: c.x, centerWorldY: c.y, widthWorld, heightWorld };
    }
    onHits(out);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cloned, rotY, camera, size.width, size.height, view, idle, model3d, JSON.stringify(zones.map((z) => z.box))]);

  return <primitive object={cloned} />;
}

type DragMode = "move" | "nw" | "ne" | "sw" | "se";
type DragState = { id: string; mode: DragMode; sx: number; sy: number; origin: Box };

export default function Zone3DEditor({
  products, modelUrls,
}: {
  products: CatalogProduct[];
  modelUrls: Record<string, string | null>;
}) {
  const withModel = products.filter((p) => modelUrls[p.slug]);
  const [slug, setSlug] = useState(withModel[0]?.slug ?? products[0]?.slug);
  const product = products.find((p) => p.slug === slug) ?? products[0];
  const modelUrl = modelUrls[slug] ?? null;
  const hex = product?.variants.find((v) => v.colorHex)?.colorHex || "#C9C4B8";

  const seed = (): ProductZones => (product ? getDefaultZones(product) : { front: [], back: [] });
  const [zones, setZones] = useState<ProductZones>(seed);
  const [model3d, setModel3d] = useState<Model3DCalibration | null>(null);
  const [view, setView] = useState<View>("front");
  const [activeId, setActiveId] = useState<string>("");
  const [rect, setRect] = useState<RectT>({ x: 0.2, y: 0.12, w: 0.6, h: 0.76 });
  const [hits, setHits] = useState<Record<string, Model3DHit>>({});
  const [drag, setDrag] = useState<DragState | null>(null);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const stageRef = useRef<HTMLDivElement>(null);

  // Load saved zones + 3D calibration for the SKU.
  useEffect(() => {
    let cancelled = false;
    setSavedAt(null);
    fetch(`/api/zones/${slug}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (cancelled) return;
        const saved = normaliseZonesPayload(data?.zones);
        setZones(saved ?? seed());
        setModel3d(normaliseCalibration(data?.calibration)?.model3d ?? null);
      })
      .catch(() => setZones(seed()));
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug]);

  const list = view === "front" ? zones.front : zones.back;
  useEffect(() => { if (list.length && !list.some((z) => z.id === activeId)) setActiveId(list[0].id); }, [list, activeId]);

  const updateBox = useCallback((id: string, box: Box) => {
    setZones((prev) => ({ ...prev, [view]: prev[view].map((z) => (z.id === id ? { ...z, box } : z)) }));
  }, [view]);

  // Drag in rect-relative space (matches how the configurator reads zones).
  useEffect(() => {
    if (!drag) return;
    const move = (e: PointerEvent) => {
      const el = stageRef.current?.getBoundingClientRect();
      if (!el) return;
      const dxC = (e.clientX - drag.sx) / el.width / rect.w; // → rect-relative
      const dyC = (e.clientY - drag.sy) / el.height / rect.h;
      const o = drag.origin;
      let b: Box;
      if (drag.mode === "move") {
        b = { ...o, x: clamp(o.x + dxC, 0, 1 - o.w), y: clamp(o.y + dyC, 0, 1 - o.h) };
      } else {
        let x0 = o.x, y0 = o.y, x1 = o.x + o.w, y1 = o.y + o.h;
        if (drag.mode.includes("w")) x0 = clamp(o.x + dxC, 0, x1 - MIN);
        if (drag.mode.includes("e")) x1 = clamp(o.x + o.w + dxC, x0 + MIN, 1);
        if (drag.mode.includes("n")) y0 = clamp(o.y + dyC, 0, y1 - MIN);
        if (drag.mode.includes("s")) y1 = clamp(o.y + o.h + dyC, y0 + MIN, 1);
        b = { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
      }
      updateBox(drag.id, b);
    };
    const up = () => setDrag(null);
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    return () => { window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); };
  }, [drag, rect.w, rect.h, updateBox]);

  const startDrag = (id: string, mode: DragMode) => (e: React.PointerEvent) => {
    e.preventDefault(); e.stopPropagation();
    setActiveId(id);
    const z = list.find((zz) => zz.id === id);
    if (z) setDrag({ id, mode, sx: e.clientX, sy: e.clientY, origin: { ...z.box } });
  };

  const addZone = () => {
    const id = `zone-${Date.now().toString(36)}`;
    const box = { x: 0.4, y: 0.34, w: 0.2, h: 0.16 };
    setZones((prev) => ({ ...prev, [view]: [...prev[view], { id, label: "New zone", box }] }));
    setActiveId(id);
  };
  const removeZone = (id: string) =>
    setZones((prev) => ({ ...prev, [view]: prev[view].filter((z) => z.id !== id) }));
  const renameZone = (id: string, label: string) =>
    setZones((prev) => ({ ...prev, [view]: prev[view].map((z) => (z.id === id ? { ...z, label } : z)) }));

  const inchesFor = (id: string) => {
    const h = hits[id];
    if (!model3d || !h || h.widthWorld <= 0) return null;
    return model3dPlacement(model3d, h, view);
  };

  const save = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/zones/${slug}`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ zones }),
      });
      if (res.ok) setSavedAt(new Date().toLocaleTimeString());
    } finally {
      setSaving(false);
    }
  };

  if (!modelUrl) {
    return (
      <div className="z3d">
        <aside className="z3d-side">
          <p className="z3d-side-h">SKUs</p>
          <ul className="z3d-skus">
            {products.map((p) => (
              <li key={p.slug}>
                <button type="button" className={`z3d-sku${p.slug === slug ? " is-on" : ""}`} onClick={() => setSlug(p.slug)}>
                  <span>{p.displayName}</span>
                  <em>{modelUrls[p.slug] ? "3D" : "no model"}</em>
                </button>
              </li>
            ))}
          </ul>
        </aside>
        <div className="z3d-empty">No 3D model for this SKU yet — upload a GLB on its Assets page to author zones in 3D.</div>
      </div>
    );
  }

  return (
    <div className="z3d">
      <aside className="z3d-side">
        <p className="z3d-side-h">SKUs</p>
        <ul className="z3d-skus">
          {products.map((p) => (
            <li key={p.slug}>
              <button type="button" className={`z3d-sku${p.slug === slug ? " is-on" : ""}`} onClick={() => setSlug(p.slug)}>
                <span>{p.displayName}</span>
                <em>{modelUrls[p.slug] ? "3D" : "no model"}</em>
              </button>
            </li>
          ))}
        </ul>
      </aside>

      <section className="z3d-main">
        <header className="z3d-head">
          <div>
            <h2 className="z3d-title">{product.displayName}</h2>
            <p className="z3d-sub">
              Drag the boxes onto the garment. Sizes are real inches off the 3D surface · {model3d ? `${model3d.confidence} calibration` : "no 3D calibration — run it on the Assets page"}.
            </p>
          </div>
          <div className="z3d-viewtabs">
            <button type="button" className={`z3d-tab${view === "front" ? " is-on" : ""}`} onClick={() => setView("front")}>Front</button>
            <button type="button" className={`z3d-tab${view === "back" ? " is-on" : ""}`} onClick={() => setView("back")}>Back</button>
          </div>
        </header>

        <div className="z3d-stage" ref={stageRef}>
          <Canvas flat shadows camera={{ position: [0, 0.2, 3.2], fov: 35 }} dpr={[1, 2]} gl={{ antialias: true }}>
            <color attach="background" args={["#EEEAE3"]} />
            <ambientLight intensity={0.6} />
            <hemisphereLight args={["#ffffff", "#d8d2c8", 0.3]} />
            <directionalLight position={[3, 5, 4]} intensity={0.95} />
            <directionalLight position={[-4, 2, -2]} intensity={0.3} />
            <Suspense fallback={<Html center>Loading…</Html>}>
              <Backdrop url={modelUrl} hex={hex} view={view} zones={list} model3d={model3d} idle={!drag} onRect={setRect} onHits={setHits} />
              <ContactShadows position={[0, -0.8, 0]} opacity={0.28} scale={4} blur={2.6} far={2.5} />
            </Suspense>
            <OrbitControls enableRotate={false} enablePan={false} enableZoom={false} />
          </Canvas>

          <div className="z3d-overlay">
            {list.map((z) => {
              const on = z.id === activeId;
              const spec = inchesFor(z.id);
              const fit = spec ? methodFit(spec.widthIn) : null;
              return (
                <div
                  key={z.id}
                  className={`z3d-box${on ? " is-on" : ""}`}
                  style={{
                    left: `${(rect.x + z.box.x * rect.w) * 100}%`,
                    top: `${(rect.y + z.box.y * rect.h) * 100}%`,
                    width: `${z.box.w * rect.w * 100}%`,
                    height: `${z.box.h * rect.h * 100}%`,
                  }}
                  onPointerDown={startDrag(z.id, "move")}
                >
                  <span className="z3d-box-label">
                    {z.label}
                    {spec ? (
                      <span className={`z3d-box-dims${fit?.over ? " is-over" : ""}`}>
                        {spec.widthIn}&Prime;×{spec.heightIn}&Prime; · {spec.belowHpsIn}&Prime; ↓HPS · {fit?.over ? "⚠ over max" : fit?.label}
                      </span>
                    ) : null}
                  </span>
                  {on ? (
                    <>
                      <span className="z3d-h z3d-h--nw" onPointerDown={startDrag(z.id, "nw")} />
                      <span className="z3d-h z3d-h--ne" onPointerDown={startDrag(z.id, "ne")} />
                      <span className="z3d-h z3d-h--sw" onPointerDown={startDrag(z.id, "sw")} />
                      <span className="z3d-h z3d-h--se" onPointerDown={startDrag(z.id, "se")} />
                    </>
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>

        <div className="z3d-zones">
          {list.map((z) => (
            <div key={z.id} className={`z3d-chip${z.id === activeId ? " is-on" : ""}`}>
              <button type="button" className="z3d-chip-pick" onClick={() => setActiveId(z.id)}>
                {z.id === activeId ? (
                  <input className="z3d-chip-input" value={z.label} onChange={(e) => renameZone(z.id, e.target.value)} onClick={(e) => e.stopPropagation()} />
                ) : (
                  <span>{z.label}</span>
                )}
              </button>
              <button type="button" className="z3d-chip-x" onClick={() => removeZone(z.id)} aria-label={`Remove ${z.label}`}>✕</button>
            </div>
          ))}
          <button type="button" className="z3d-add" onClick={addZone}>+ Add zone</button>
        </div>

        <div className="z3d-actions">
          <button type="button" className="z3d-save" onClick={save} disabled={saving}>
            {saving ? "Saving…" : "Save zones"}
          </button>
          {savedAt ? <span className="z3d-saved">Saved {savedAt} ✓</span> : null}
          <span className="z3d-hint">Boxes are stored relative to the garment, so they land identically in the customer’s 3D configurator.</span>
        </div>
      </section>
    </div>
  );
}
