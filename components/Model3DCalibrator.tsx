"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import { ContactShadows, useGLTF, Html } from "@react-three/drei";
import * as THREE from "three";
import { model3dPlacement, STUDIO_FIT_UNITS, type Model3DCalibration } from "@/lib/zones";

// 3D calibration tool. The operator drags the TRUE HPS line and hem line onto the
// model; the scale is anchored to the real body length across that span (so a
// stand collar above the HPS skews neither the datum nor the scale). Live
// cross-check (implied chest vs spec) + confidence verify accuracy per SKU.

type Report = {
  modelUrl: string;
  rawSize: { x: number; y: number; z: number };
  worldHeight: number;
  bodyLengthIn: number;
  chestWidthIn: number | null;
  hpsFrac: number;
  hemFrac: number;
  source: string;
};
type RectT = { x: number; y: number; w: number; h: number };

const confClass = (c: string) => (c === "high" ? "m3dcal-badge--high" : c === "medium" ? "m3dcal-badge--med" : "m3dcal-badge--low");
const r2 = (n: number) => Math.round(n * 100) / 100;

function useNormalizedModel(url: string, fit: number) {
  const { scene } = useGLTF(url);
  return useMemo(() => {
    const c = scene.clone(true);
    const b1 = new THREE.Box3().setFromObject(c);
    c.scale.setScalar(fit / (Math.max(...b1.getSize(new THREE.Vector3()).toArray()) || 1));
    const b2 = new THREE.Box3().setFromObject(c);
    c.position.sub(b2.getCenter(new THREE.Vector3()));
    c.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      (Array.isArray(m.material) ? m.material : [m.material]).forEach((mm) => {
        const s = mm as THREE.MeshStandardMaterial;
        s.map = null; s.color = new THREE.Color("#C9C4B8"); s.roughness = 0.9; s.metalness = 0; s.needsUpdate = true;
      });
    });
    return c;
  }, [scene, fit]);
}

function Backdrop({ url, onRect }: { url: string; onRect: (r: RectT) => void }) {
  const cloned = useNormalizedModel(url, STUDIO_FIT_UNITS);
  const { camera, size } = useThree();
  useEffect(() => {
    cloned.rotation.y = 0;
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
  }, [cloned, camera, size.width, size.height]);
  return <primitive object={cloned} />;
}

export default function Model3DCalibrator({ slug, hasModel, modelUrl }: { slug: string; hasModel: boolean; modelUrl: string | null }) {
  const [report, setReport] = useState<Report | null>(null);
  const [hpsFrac, setHpsFrac] = useState(0);
  const [hemFrac, setHemFrac] = useState(1);
  const [rect, setRect] = useState<RectT>({ x: 0.2, y: 0.1, w: 0.6, h: 0.8 });
  const [dragging, setDragging] = useState<"hps" | "hem" | null>(null);
  const [loading, setLoading] = useState(false);
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [applied, setApplied] = useState(false);
  const stageRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null); setApplied(false);
    try {
      // Seed the lines from the stored calibration if present.
      const z = await fetch(`/api/zones/${slug}`).then((r) => (r.ok ? r.json() : null)).catch(() => null);
      const stored = z?.calibration?.model3d;
      const r = await fetch(`/api/admin/calibrate-3d/${slug}`);
      const d = await r.json();
      if (!r.ok) { setError(d.error || "Couldn't compute the calibration."); setReport(null); return; }
      setReport(d.report);
      setHpsFrac(typeof stored?.hpsFrac === "number" ? stored.hpsFrac : d.report.hpsFrac ?? 0);
      setHemFrac(typeof stored?.hemFrac === "number" ? stored.hemFrac : d.report.hemFrac ?? 1);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, [slug]);

  useEffect(() => { if (hasModel) load(); }, [hasModel, load]);

  // Live calibration derived from the report + the operator's HPS/hem lines.
  const live = useMemo(() => {
    if (!report) return null;
    const fit = STUDIO_FIT_UNITS;
    const wh = report.worldHeight;
    const top = wh / 2;
    const hpsWorldY = top - hpsFrac * wh;
    const span = Math.max(1e-4, (hemFrac - hpsFrac) * wh);
    const ipw = report.bodyLengthIn / span;
    const maxRaw = Math.max(report.rawSize.x, report.rawSize.y, report.rawSize.z) || 1;
    const impliedWidthIn = (report.rawSize.x / maxRaw) * fit * ipw;
    let ratio: number | null = null;
    let conf: Model3DCalibration["confidence"] = report.source.includes("dxf") ? "medium" : "low";
    if (report.chestWidthIn) {
      let best = Infinity;
      for (const c of [report.chestWidthIn, report.chestWidthIn / 2]) {
        const e = Math.abs(Math.log(impliedWidthIn / c));
        if (e < best) { best = e; ratio = impliedWidthIn / c; }
      }
      conf = best < 0.2 ? "high" : best < 0.45 ? "medium" : "low";
    } else if (report.source.includes("dxf")) conf = "high";
    const collarIn = hpsFrac * wh * ipw; // how far the HPS sits below the model top (≈ collar height)
    const cal: Model3DCalibration = {
      fitUnits: fit, inchesPerWorld: ipw, hpsWorldY, cfWorldX: 0,
      bodyLengthIn: report.bodyLengthIn, chestWidthIn: report.chestWidthIn,
      hpsFrac, hemFrac, confidence: conf, source: report.source as Model3DCalibration["source"],
    };
    // sanity sample: a 3.5" left-chest logo placed 3" below the HPS line
    const sample = model3dPlacement(cal, {
      centerWorldX: 3.5 / ipw, centerWorldY: hpsWorldY - 4.75 / ipw, widthWorld: 3.5 / ipw, heightWorld: 3.5 / ipw,
    }, "front");
    return { ipw, impliedWidthIn, ratio, conf, collarIn, sample };
  }, [report, hpsFrac, hemFrac]);

  // Drag the HPS / hem line vertically (fraction of the model's projected rect).
  useEffect(() => {
    if (!dragging) return;
    const move = (e: PointerEvent) => {
      const el = stageRef.current?.getBoundingClientRect();
      if (!el) return;
      const yCanvas = (e.clientY - el.top) / el.height;
      const frac = (yCanvas - rect.y) / rect.h;
      if (dragging === "hps") setHpsFrac(Math.min(hemFrac - 0.05, Math.max(0, frac)));
      else setHemFrac(Math.max(hpsFrac + 0.05, Math.min(1, frac)));
    };
    const up = () => setDragging(null);
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    return () => { window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); };
  }, [dragging, rect.y, rect.h, hpsFrac, hemFrac]);

  // Snap the HPS line so the model's implied chest matches the spec chest — the
  // two independent measurements (body length + chest) then agree (ratio → 1.0×),
  // which is the most accurate datum. The operator still eyeballs the line.
  const autoFit = () => {
    if (!report?.chestWidthIn) return;
    const fit = STUDIO_FIT_UNITS;
    const maxRaw = Math.max(report.rawSize.x, report.rawSize.y, report.rawSize.z) || 1;
    const modelWidthWorld = (report.rawSize.x / maxRaw) * fit;
    const wh = report.worldHeight;
    const cands = report.source.includes("dxf") ? [report.chestWidthIn] : [report.chestWidthIn, report.chestWidthIn / 2];
    let best: number | null = null, bestErr = Infinity;
    for (const c of cands) {
      const span = (report.bodyLengthIn * modelWidthWorld) / c;
      const hf = hemFrac - span / wh;
      if (hf >= 0 && hf <= 0.35) { const err = Math.abs(hf - 0.06); if (err < bestErr) { bestErr = err; best = hf; } }
    }
    if (best != null) setHpsFrac(Math.round(best * 1000) / 1000);
  };

  const apply = async () => {
    setApplying(true); setError(null);
    try {
      const r = await fetch(`/api/admin/calibrate-3d/${slug}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ hpsFrac, hemFrac }),
      });
      const d = await r.json();
      if (!r.ok) setError(d.error || "Couldn't apply.");
      else setApplied(true);
    } catch (e) {
      setError(String(e));
    } finally {
      setApplying(false);
    }
  };

  if (!hasModel || !modelUrl) {
    return (
      <section className="m3dcal">
        <header className="m3dcal-head"><h2 className="m3dcal-title">3D Calibration</h2></header>
        <p className="m3dcal-empty">No 3D model (GLB) for this SKU yet. Upload one above, then calibrate.</p>
      </section>
    );
  }

  const lineTop = (frac: number) => `${(rect.y + frac * rect.h) * 100}%`;

  return (
    <section className="m3dcal">
      <header className="m3dcal-head">
        <h2 className="m3dcal-title">3D Calibration</h2>
        {live ? <span className={`m3dcal-badge ${confClass(live.conf)}`}>{live.conf} confidence</span> : null}
      </header>
      <p className="m3dcal-lede">
        Drag the <b style={{ color: "var(--color-terracotta)" }}>HPS</b> line to the true high-point shoulder and the{" "}
        <b>hem</b> line to the bottom of the body. The scale anchors to the real body length across that span, so a
        collar above the HPS can’t skew the placement.
      </p>

      {error ? <p className="m3dcal-error">{error}</p> : null}

      <div className="m3dcal-cal">
        <div className="m3dcal-stage" ref={stageRef}>
          <Canvas flat camera={{ position: [0, 0.2, 3.2], fov: 35 }} dpr={[1, 2]} gl={{ antialias: true }}>
            <color attach="background" args={["#EEEAE3"]} />
            <ambientLight intensity={0.6} />
            <hemisphereLight args={["#ffffff", "#d8d2c8", 0.3]} />
            <directionalLight position={[3, 5, 4]} intensity={0.95} />
            <Suspense fallback={<Html center>Loading…</Html>}>
              <Backdrop url={modelUrl} onRect={setRect} />
              <ContactShadows position={[0, -0.8, 0]} opacity={0.25} scale={4} blur={2.6} far={2.5} />
            </Suspense>
          </Canvas>
          {/* HPS + hem guide lines */}
          <div className="m3dcal-guide m3dcal-guide--hps" style={{ top: lineTop(hpsFrac) }} onPointerDown={() => setDragging("hps")}>
            <span className="m3dcal-guide-tag">HPS{live ? ` · ${r2(live.collarIn)}″ below top` : ""}</span>
          </div>
          <div className="m3dcal-guide m3dcal-guide--hem" style={{ top: lineTop(hemFrac) }} onPointerDown={() => setDragging("hem")}>
            <span className="m3dcal-guide-tag m3dcal-guide-tag--hem">HEM</span>
          </div>
        </div>

        <div className="m3dcal-readout">
          <div className="m3dcal-grid">
            <div className="m3dcal-stat">
              <span className="m3dcal-label">Inches / world</span>
              <strong className="m3dcal-value">{live ? r2(live.ipw) : "—"}</strong>
              <span className="m3dcal-sub">the scale</span>
            </div>
            <div className="m3dcal-stat">
              <span className="m3dcal-label">Body length</span>
              <strong className="m3dcal-value">{report ? r2(report.bodyLengthIn) : "—"}&Prime;</strong>
              <span className="m3dcal-sub">HPS→hem · {report?.source}</span>
            </div>
            <div className="m3dcal-stat">
              <span className="m3dcal-label">Chest cross-check</span>
              <strong className="m3dcal-value">{live?.ratio ? `${r2(live.ratio)}×` : "—"}</strong>
              <span className="m3dcal-sub">{live ? `model ${r2(live.impliedWidthIn)}″ vs spec ${report?.chestWidthIn ?? "—"}″` : "—"}</span>
            </div>
          </div>
          {live ? (
            <div className="m3dcal-sanity">
              <span className="m3dcal-sanity-label">A 3.5&Prime; left-chest logo prints at</span>
              <span className="m3dcal-sanity-val">
                {live.sample.widthIn}&Prime; wide · {live.sample.belowHpsIn}&Prime; below HPS · {live.sample.horizontal}
              </span>
            </div>
          ) : null}
          <div className="m3dcal-actions">
            <button type="button" className="m3dcal-btn m3dcal-btn--ghost" onClick={load} disabled={loading || applying}>
              {loading ? "Loading…" : "Reset"}
            </button>
            <button type="button" className="m3dcal-btn m3dcal-btn--ghost" onClick={autoFit} disabled={loading || applying || !report?.chestWidthIn} title="Snap the HPS line so chest matches spec (ratio → 1.0×)">
              Auto-fit HPS
            </button>
            <button type="button" className="m3dcal-btn m3dcal-btn--primary" onClick={apply} disabled={applying || loading || !report}>
              {applying ? "Applying…" : "Apply calibration"}
            </button>
            {applied ? <span className="m3dcal-applied">Saved ✓</span> : null}
          </div>
        </div>
      </div>
    </section>
  );
}
