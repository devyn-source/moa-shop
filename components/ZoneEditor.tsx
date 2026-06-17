"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ProductShot } from "./ProductShot";
import {
  getDefaultZones,
  normaliseZonesPayload,
  defaultCalibration,
  derivePlacement,
  normaliseCalibration,
  defaultMeasurements,
  normaliseMeasurements,
  type Box,
  type ProductZones,
  type ProductCalibration,
  type ViewCalibration,
  type ProductMeasurements,
  type View,
  type Zone
} from "@/lib/zones";
import type { CatalogProduct } from "@/lib/types";

type GuideKind = "hps" | "cf" | "scaleA" | "scaleB" | "scaleY";
const RULER_Y = 0.5; // default vertical position of the chest-width ruler

type DragMode = "move" | "nw" | "ne" | "sw" | "se" | "rotate";
type DragState = {
  zoneId: string;
  mode: DragMode;
  startX: number; // canvas-relative px
  startY: number;
  origin: Box;
  width: number; // canvas px width
  height: number;
  centerX?: number; // for rotate (canvas-relative px)
  centerY?: number;
};

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const MIN = 0.02; // smallest allowed box dimension as a fraction

// Max imprint WIDTH (inches) by decoration method — the box caps the art, so a
// box wider than a method's max means that method can't fill it. Guides the
// operator on which methods a zone supports as they size it.
const IMPRINT_MAX = { embroidery: 5, dtf: 12, screen: 14 };
function methodFit(widthIn: number): { label: string; over: boolean } {
  if (widthIn > IMPRINT_MAX.screen) return { label: "over print max", over: true };
  const fits: string[] = [];
  if (widthIn <= IMPRINT_MAX.embroidery) fits.push("emb");
  if (widthIn <= IMPRINT_MAX.dtf) fits.push("DTF");
  if (widthIn <= IMPRINT_MAX.screen) fits.push("screen");
  return { label: fits.join(" · ") || "—", over: false };
}

function applyDrag(state: DragState, x: number, y: number): Box {
  const dx = (x - state.startX) / state.width;
  const dy = (y - state.startY) / state.height;
  const o = state.origin;
  const out = { ...o };
  if (state.mode === "rotate") {
    const cx = state.centerX ?? 0;
    const cy = state.centerY ?? 0;
    // 0° = handle straight up (north of centre), positive = clockwise.
    const angle = (Math.atan2(y - cy, x - cx) * 180) / Math.PI + 90;
    const normalised = ((angle % 360) + 360) % 360;
    out.r = Math.round(normalised);
    return out;
  }
  if (state.mode === "move") {
    out.x = clamp(o.x + dx, 0, 1 - o.w);
    out.y = clamp(o.y + dy, 0, 1 - o.h);
  } else {
    // Corner resize — anchor the opposite corner.
    let x0 = o.x;
    let y0 = o.y;
    let x1 = o.x + o.w;
    let y1 = o.y + o.h;
    if (state.mode === "nw" || state.mode === "sw") x0 = clamp(o.x + dx, 0, x1 - MIN);
    if (state.mode === "ne" || state.mode === "se") x1 = clamp(o.x + o.w + dx, x0 + MIN, 1);
    if (state.mode === "nw" || state.mode === "ne") y0 = clamp(o.y + dy, 0, y1 - MIN);
    if (state.mode === "sw" || state.mode === "se") y1 = clamp(o.y + o.h + dy, y0 + MIN, 1);
    out.x = x0;
    out.y = y0;
    out.w = x1 - x0;
    out.h = y1 - y0;
  }
  return out;
}

function defaultBox(): Box {
  return { x: 0.4, y: 0.4, w: 0.2, h: 0.15 };
}

export function ZoneEditor({ products }: { products: CatalogProduct[] }) {
  const sorted = useMemo(
    () => [...products].sort((a, b) => a.displayName.localeCompare(b.displayName)),
    [products]
  );
  const [slug, setSlug] = useState<string>(sorted[0]?.slug ?? "");
  const product = useMemo(() => sorted.find((p) => p.slug === slug), [sorted, slug]);
  const [view, setView] = useState<View>("front");
  const [zones, setZones] = useState<ProductZones>({ front: [], back: [] });
  const [activeId, setActiveId] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [hasOverride, setHasOverride] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [drag, setDrag] = useState<DragState | null>(null);
  const canvasRef = useRef<HTMLDivElement>(null);

  // Calibration ("ruler") authoring — collar/HPS, center-front, chest-width.
  const [mode, setMode] = useState<"zones" | "calibrate" | "measure">("zones");
  const [calibration, setCalibration] = useState<ProductCalibration>({});
  const [guideDrag, setGuideDrag] = useState<GuideKind | null>(null);
  const cal: ViewCalibration = calibration[view] ?? defaultCalibration();
  const rulerY = cal.scaleY ?? RULER_Y;
  const setCal = useCallback(
    (patch: Partial<ViewCalibration>) => {
      setCalibration((prev) => ({ ...prev, [view]: { ...(prev[view] ?? defaultCalibration()), ...patch } }));
    },
    [view]
  );

  // Garment measurements (spec-sheet points of measure × sizes).
  const [measurements, setMeasurements] = useState<ProductMeasurements | null>(null);

  // Spec-driven auto-calibration.
  const [autoBusy, setAutoBusy] = useState(false);
  const [autoMsg, setAutoMsg] = useState<string | null>(null);

  // Load zones whenever the SKU changes.
  useEffect(() => {
    if (!product) return;
    let cancelled = false;
    setError(null);
    setActiveId(null);
    setSavedAt(null);
    setHasOverride(false);
    fetch(`/api/zones/${slug}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (cancelled) return;
        const persisted = normaliseZonesPayload(data?.zones);
        if (persisted && (persisted.front.length || persisted.back.length)) {
          setZones(persisted);
          setHasOverride(true);
          setSavedAt(new Date().toISOString());
        } else {
          setZones(getDefaultZones(product));
        }
        setCalibration(normaliseCalibration(data?.calibration) ?? {});
        setMeasurements(normaliseMeasurements(data?.measurements) ?? defaultMeasurements(product.category, product.sizes));
      })
      .catch(() => {
        setZones(getDefaultZones(product));
        setCalibration({});
        setMeasurements(defaultMeasurements(product.category, product.sizes));
      });
    return () => {
      cancelled = true;
    };
  }, [slug, product]);

  const updateZone = useCallback(
    (id: string, box: Box) => {
      setZones((prev) => ({
        ...prev,
        [view]: prev[view].map((z) => (z.id === id ? { ...z, box } : z))
      }));
    },
    [view]
  );

  // Window-level pointer move / up while dragging.
  useEffect(() => {
    if (!drag) return;
    const onMove = (e: PointerEvent) => {
      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return;
      const next = applyDrag(drag, e.clientX - rect.left, e.clientY - rect.top);
      updateZone(drag.zoneId, next);
    };
    const onUp = () => setDrag(null);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, [drag, updateZone]);

  // Calibration guide dragging — collar/CF lines and the chest-width endpoints.
  useEffect(() => {
    if (!guideDrag) return;
    const onMove = (e: PointerEvent) => {
      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return;
      const fx = clamp((e.clientX - rect.left) / rect.width, 0, 1);
      const fy = clamp((e.clientY - rect.top) / rect.height, 0, 1);
      if (guideDrag === "hps") setCal({ hpsY: fy });
      else if (guideDrag === "cf") setCal({ cfX: fx });
      else if (guideDrag === "scaleA") setCal({ scaleAx: fx });
      else if (guideDrag === "scaleB") setCal({ scaleBx: fx });
      else if (guideDrag === "scaleY") setCal({ scaleY: fy });
    };
    const onUp = () => setGuideDrag(null);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, [guideDrag, setCal]);

  const startDrag = (zone: Zone, mode: DragMode) => (e: React.PointerEvent) => {
    e.stopPropagation();
    e.preventDefault();
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    setActiveId(zone.id);
    const next: DragState = {
      zoneId: zone.id,
      mode,
      startX: e.clientX - rect.left,
      startY: e.clientY - rect.top,
      origin: { ...zone.box },
      width: rect.width,
      height: rect.height
    };
    if (mode === "rotate") {
      // Pre-compute the box centre in canvas-relative px for the rotate maths.
      next.centerX = (zone.box.x + zone.box.w / 2) * rect.width;
      next.centerY = (zone.box.y + zone.box.h / 2) * rect.height;
    }
    setDrag(next);
  };

  const addZone = () => {
    if (!product) return;
    const id = `zone-${Date.now()}`;
    const box = defaultBox();
    const newZone: Zone = { id, label: "New zone", box };
    setZones((prev) => ({ ...prev, [view]: [...prev[view], newZone] }));
    setActiveId(id);
  };

  const deleteZone = (id: string) => {
    setZones((prev) => ({ ...prev, [view]: prev[view].filter((z) => z.id !== id) }));
    if (activeId === id) setActiveId(null);
  };

  const updateLabel = (id: string, label: string) => {
    setZones((prev) => ({
      ...prev,
      [view]: prev[view].map((z) => (z.id === id ? { ...z, label } : z))
    }));
  };

  const updateRotation = (id: string, r: number) => {
    const normalised = Number.isFinite(r) ? ((Math.round(r) % 360) + 360) % 360 : 0;
    setZones((prev) => ({
      ...prev,
      [view]: prev[view].map((z) =>
        z.id === id ? { ...z, box: { ...z.box, r: normalised } } : z
      )
    }));
  };

  const updateId = (oldId: string, nextId: string) => {
    if (!nextId || nextId === oldId) return;
    const slugified = nextId
      .toLowerCase()
      .replace(/[^a-z0-9-]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40);
    if (!slugified) return;
    setZones((prev) => ({
      ...prev,
      [view]: prev[view].map((z) => (z.id === oldId ? { ...z, id: slugified } : z))
    }));
    if (activeId === oldId) setActiveId(slugified);
  };

  const resetToDefaults = () => {
    if (!product) return;
    setZones(getDefaultZones(product));
    setActiveId(null);
  };

  const save = async () => {
    if (!product) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/zones/${slug}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ zones, calibration, measurements })
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error ?? `Save failed (${res.status})`);
      }
      setSavedAt(new Date().toISOString());
      setHasOverride(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  if (!product) {
    return <div className="empty-state">No products found.</div>;
  }

  const currentView = zones[view] ?? [];
  const active = currentView.find((z) => z.id === activeId) ?? null;
  const hasBack = Boolean(product.greyBack) || product.variants.some((v) => v.backImage);
  const heroVariant =
    product.variants.find((v) => v.colorLabel === "Black") ??
    product.variants.find((v) => v.frontImage) ??
    product.variants[0];

  // Measurement table helpers (size columns from the SKU's size run).
  const sizeCols = product.sizes?.length ? product.sizes : ["OS"];
  const setMeasRows = (rows: ProductMeasurements["rows"]) =>
    setMeasurements((m) => (m ? { ...m, rows } : m));
  const setPom = (id: string, pom: string) =>
    setMeasRows((measurements?.rows ?? []).map((r) => (r.id === id ? { ...r, pom } : r)));
  const setVal = (id: string, size: string, raw: string) => {
    const n = raw === "" ? null : parseFloat(raw);
    setMeasRows(
      (measurements?.rows ?? []).map((r) =>
        r.id === id ? { ...r, values: { ...r.values, [size]: Number.isFinite(n as number) ? (n as number) : null } } : r
      )
    );
  };
  const addPom = () =>
    setMeasRows([
      ...(measurements?.rows ?? []),
      { id: `pom-${Date.now()}`, pom: "New measure", values: Object.fromEntries(sizeCols.map((s) => [s, null])) },
    ]);
  const removePom = (id: string) => setMeasRows((measurements?.rows ?? []).filter((r) => r.id !== id));

  const autoCalibrate = async () => {
    setAutoBusy(true);
    setAutoMsg(null);
    try {
      const res = await fetch(`/api/admin/auto-calibrate/${slug}`, { method: "POST" });
      const d = await res.json();
      if (d?.ok && d.calibration) {
        setCalibration(normaliseCalibration(d.calibration) ?? {});
        setSavedAt(new Date().toISOString());
        const conf = String(d.confidence).toUpperCase();
        setAutoMsg(`Auto-calibrated from spec · confidence ${conf} (chest/length ${d.ratio}). Front + back set & saved — review the guides${conf === "HIGH" ? "." : ", nudge if needed."}`);
      } else {
        setAutoMsg(d?.error || "Auto-calibrate failed.");
      }
    } catch {
      setAutoMsg("Auto-calibrate failed.");
    } finally {
      setAutoBusy(false);
    }
  };

  return (
    <div className="ze">
      <aside className="ze-sidebar">
        <p className="eyebrow">SKUs</p>
        <ul className="ze-skus">
          {sorted.map((p) => (
            <li key={p.slug}>
              <button
                type="button"
                className={`ze-sku${p.slug === slug ? " is-on" : ""}`}
                onClick={() => setSlug(p.slug)}
              >
                <span className="ze-sku-name">{p.displayName}</span>
                <span className="ze-sku-code">{p.skuCode}</span>
              </button>
            </li>
          ))}
        </ul>
      </aside>

      <section className="ze-canvas-wrap">
        <header className="ze-canvas-head">
          <div>
            <p className="eyebrow">{product.category}</p>
            <h2 className="ze-title">{product.displayName}</h2>
            <p className="ze-sub">
              Style {product.skuCode}
              {hasOverride ? " · saved override" : " · category default"}
              {savedAt ? ` · last saved ${new Date(savedAt).toLocaleTimeString()}` : ""}
            </p>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, alignItems: "flex-end" }}>
            <div className="pdpx-view-pills">
              <button type="button" className={`pdpx-pill${mode === "zones" ? " is-on" : ""}`} onClick={() => setMode("zones")}>Zones</button>
              <button type="button" className={`pdpx-pill${mode === "calibrate" ? " is-on" : ""}`} onClick={() => setMode("calibrate")}>Calibrate</button>
              <button type="button" className={`pdpx-pill${mode === "measure" ? " is-on" : ""}`} onClick={() => setMode("measure")}>Measure</button>
            </div>
            {hasBack ? (
              <div className="pdpx-view-pills">
                <button type="button" className={`pdpx-pill${view === "front" ? " is-on" : ""}`} onClick={() => setView("front")}>Front</button>
                <button type="button" className={`pdpx-pill${view === "back" ? " is-on" : ""}`} onClick={() => setView("back")}>Back</button>
              </div>
            ) : null}
          </div>
        </header>

        {mode === "measure" ? (
          <div style={{ overflowX: "auto", padding: "6px 2px 2px" }}>
            {!measurements ? (
              <p className="ze-hint">Loading measurements…</p>
            ) : (
              <table style={{ borderCollapse: "collapse", width: "100%", fontSize: "0.78rem" }}>
                <thead>
                  <tr>
                    <th style={{ textAlign: "left", padding: "8px 10px", borderBottom: `2px solid ${"#1E1E1E"}`, fontSize: "0.6rem", letterSpacing: "0.06em", textTransform: "uppercase", color: "#8A8680", whiteSpace: "nowrap" }}>
                      Point of measure ({measurements.unit})
                    </th>
                    {sizeCols.map((sz) => (
                      <th
                        key={sz}
                        style={{
                          padding: "8px 8px",
                          borderBottom: `2px solid #1E1E1E`,
                          fontSize: "0.68rem",
                          textTransform: "uppercase",
                          color: sz === measurements.sampleSize ? "#B04731" : "#1E1E1E",
                          minWidth: 56,
                        }}
                      >
                        {sz}
                        {sz === measurements.sampleSize ? <span style={{ display: "block", fontSize: "0.5rem", color: "#B04731" }}>sample</span> : null}
                      </th>
                    ))}
                    <th style={{ width: 28, borderBottom: `2px solid #1E1E1E` }} />
                  </tr>
                </thead>
                <tbody>
                  {measurements.rows.map((row) => (
                    <tr key={row.id}>
                      <td style={{ padding: "3px 6px 3px 0", borderBottom: "1px solid #E2DED6" }}>
                        <input
                          type="text"
                          value={row.pom}
                          onChange={(e) => setPom(row.id, e.target.value)}
                          style={{ width: "100%", minWidth: 180, border: "1px solid transparent", background: "transparent", padding: "5px 6px", fontSize: "0.8rem", color: "#1E1E1E", borderRadius: 4 }}
                        />
                      </td>
                      {sizeCols.map((sz) => (
                        <td key={sz} style={{ padding: "3px 4px", borderBottom: "1px solid #E2DED6", textAlign: "center", background: sz === measurements.sampleSize ? "rgba(176,71,49,0.05)" : "transparent" }}>
                          <input
                            type="number"
                            step={0.25}
                            value={row.values[sz] ?? ""}
                            onChange={(e) => setVal(row.id, sz, e.target.value)}
                            style={{ width: 50, border: "1px solid #E2DED6", background: "#fff", padding: "5px 4px", fontSize: "0.8rem", color: "#1E1E1E", borderRadius: 4, textAlign: "center" }}
                          />
                        </td>
                      ))}
                      <td style={{ textAlign: "center", borderBottom: "1px solid #E2DED6" }}>
                        <button type="button" onClick={() => removePom(row.id)} title="Remove" style={{ border: "none", background: "transparent", color: "#8A8680", cursor: "pointer", fontSize: "1rem", lineHeight: 1 }}>×</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        ) : (
        <>
        <div
          ref={canvasRef}
          className="ze-canvas"
          onPointerDown={() => setActiveId(null)}
        >
          <ProductShot product={product} variant={heroVariant} view={view} />
          {mode === "zones" && currentView.map((zone) => {
            const on = zone.id === activeId;
            // Live real-inch size of the box (via the view's calibration) + which
            // decoration methods can fill it. This is how the operator knows how
            // big a placement can get and where it sits.
            const d = derivePlacement(cal, zone.box, { ox: 0, oy: 0, sx: 1, sy: 1 }, view);
            const fit = methodFit(d.widthIn);
            return (
              <div
                key={zone.id}
                className={`ze-zone${on ? " is-active" : ""}`}
                style={{
                  left: `${zone.box.x * 100}%`,
                  top: `${zone.box.y * 100}%`,
                  width: `${zone.box.w * 100}%`,
                  height: `${zone.box.h * 100}%`,
                  transform: `rotate(${zone.box.r ?? 0}deg)`,
                  transformOrigin: "center center"
                }}
                onPointerDown={startDrag(zone, "move")}
              >
                <span className="ze-zone-label">
                  {zone.label}
                  <span className={`ze-zone-dims${fit.over ? " is-over" : ""}`}>
                    {d.widthIn}&Prime;×{d.heightIn}&Prime; · {d.topBelowCollarIn}&Prime; ↓HPS · {fit.over ? "⚠ over print max" : fit.label}
                  </span>
                </span>
                <span className="ze-handle ze-handle--nw" onPointerDown={startDrag(zone, "nw")} />
                <span className="ze-handle ze-handle--ne" onPointerDown={startDrag(zone, "ne")} />
                <span className="ze-handle ze-handle--sw" onPointerDown={startDrag(zone, "sw")} />
                <span className="ze-handle ze-handle--se" onPointerDown={startDrag(zone, "se")} />
                <span className="ze-handle-stem" />
                <span
                  className="ze-handle ze-handle--rotate"
                  onPointerDown={startDrag(zone, "rotate")}
                  title="Rotate"
                />
              </div>
            );
          })}

          {mode === "calibrate" && (
            <>
              {/* Collar / HPS line */}
              <div
                onPointerDown={(e) => { e.preventDefault(); e.stopPropagation(); setGuideDrag("hps"); }}
                style={{ position: "absolute", left: 0, right: 0, top: `${cal.hpsY * 100}%`, transform: "translateY(-8px)", height: 16, cursor: "ns-resize", zIndex: 20, display: "flex", alignItems: "center" }}
              >
                <div style={{ width: "100%", borderTop: "2px dashed #B04731" }} />
                <span style={{ position: "absolute", left: 6, top: -1, fontSize: 9, fontWeight: 700, letterSpacing: 0.5, color: "#B04731", background: "rgba(255,255,255,0.88)", padding: "1px 5px", borderRadius: 3 }}>COLLAR / HPS</span>
              </div>

              {/* Center-front line */}
              <div
                onPointerDown={(e) => { e.preventDefault(); e.stopPropagation(); setGuideDrag("cf"); }}
                style={{ position: "absolute", top: 0, bottom: 0, left: `${cal.cfX * 100}%`, transform: "translateX(-8px)", width: 16, cursor: "ew-resize", zIndex: 20, display: "flex", justifyContent: "center" }}
              >
                <div style={{ height: "100%", borderLeft: "2px dashed #8A8680" }} />
                <span style={{ position: "absolute", top: 6, left: 11, fontSize: 9, fontWeight: 700, letterSpacing: 0.5, color: "#8A8680", background: "rgba(255,255,255,0.88)", padding: "1px 5px", borderRadius: 3 }}>CF</span>
              </div>

              {/* Chest-width ruler — drag the chip up/down to the chest line (1" below armhole); drag the end stops in/out to the garment edges */}
              <div style={{ position: "absolute", top: `${rulerY * 100}%`, left: `${Math.min(cal.scaleAx, cal.scaleBx) * 100}%`, width: `${Math.abs(cal.scaleBx - cal.scaleAx) * 100}%`, borderTop: "2px solid #1E1E1E", zIndex: 21 }} />
              <span
                onPointerDown={(e) => { e.preventDefault(); e.stopPropagation(); setGuideDrag("scaleY"); }}
                style={{ position: "absolute", top: `${rulerY * 100}%`, left: "50%", transform: "translate(-50%,-50%)", cursor: "ns-resize", fontSize: 10, fontWeight: 700, background: "#1E1E1E", color: "#fff", padding: "3px 8px", borderRadius: 4, whiteSpace: "nowrap", zIndex: 24 }}
              >
                ↕ {cal.realInches}&quot; chest
              </span>
              <div
                onPointerDown={(e) => { e.preventDefault(); e.stopPropagation(); setGuideDrag("scaleA"); }}
                style={{ position: "absolute", top: `${rulerY * 100}%`, left: `${cal.scaleAx * 100}%`, transform: "translate(-50%,-50%)", width: 13, height: 22, background: "#1E1E1E", borderRadius: 3, cursor: "ew-resize", zIndex: 22, border: "2px solid #fff" }}
              />
              <div
                onPointerDown={(e) => { e.preventDefault(); e.stopPropagation(); setGuideDrag("scaleB"); }}
                style={{ position: "absolute", top: `${rulerY * 100}%`, left: `${cal.scaleBx * 100}%`, transform: "translate(-50%,-50%)", width: 13, height: 22, background: "#1E1E1E", borderRadius: 3, cursor: "ew-resize", zIndex: 22, border: "2px solid #fff" }}
              />
            </>
          )}
        </div>

        <p className="ze-hint">
          {mode === "zones"
            ? "Click + drag inside a box to move · drag the corners to resize · click empty canvas to deselect."
            : "Drag the COLLAR line to the seam, the CF line to garment center, and the two ruler stops to a known width — then type that width at right. Set front + back."}
        </p>
        </>
        )}
        {mode === "measure" ? (
          <p className="ze-hint">Type each garment measurement per size off your spec sheet. Add or remove rows as needed. The highlighted column is the sample size. Stored per SKU — not on the customer sheet yet, this seeds the full tech pack.</p>
        ) : null}
      </section>

      <aside className="ze-rail">
        {mode === "calibrate" ? (
          <div>
            <header className="ze-rail-head">
              <p className="eyebrow">Calibration · {view}</p>
            </header>
            <div style={{ display: "flex", flexDirection: "column", gap: 14, padding: "8px 2px" }}>
              <button type="button" className="pdpx-cta" onClick={autoCalibrate} disabled={autoBusy} style={{ width: "100%" }}>
                {autoBusy ? "Detecting garment…" : "⚡ Auto-calibrate from spec"}
              </button>
              {autoMsg ? (
                <p style={{ fontSize: "0.72rem", lineHeight: 1.5, color: autoMsg.includes("failed") || autoMsg.includes("No ") || autoMsg.includes("no ") ? "#B04731" : "#8A8680" }}>{autoMsg}</p>
              ) : (
                <p style={{ fontSize: "0.68rem", lineHeight: 1.45, color: "#8A8680" }}>Uses the SKU&apos;s base mockup + stored spec (body length / chest) to set the ruler automatically. Or set it by hand below.</p>
              )}
              <label className="ze-field">
                <span>Ruler width (inches)</span>
                <input
                  type="number"
                  min={1}
                  max={72}
                  step={0.5}
                  value={cal.realInches}
                  onChange={(e) => setCal({ realInches: parseFloat(e.target.value) || 0 })}
                />
              </label>
              <div className="ze-coords">
                <span>collar {cal.hpsY.toFixed(2)}</span>
                <span>cf {cal.cfX.toFixed(2)}</span>
                <span>ruler {cal.scaleAx.toFixed(2)}–{cal.scaleBx.toFixed(2)}</span>
              </div>
              <p style={{ fontSize: "0.72rem", color: "#8A8680", lineHeight: 1.5 }}>
                Scale ≈ {(cal.realInches / (Math.abs(cal.scaleBx - cal.scaleAx) || 1)).toFixed(1)}&quot; per canvas width. A full-front print (40% of width) ≈ {(0.4 * cal.realInches / (Math.abs(cal.scaleBx - cal.scaleAx) || 1)).toFixed(1)}&quot; wide.
              </p>
              {hasBack ? (
                <button
                  type="button"
                  className="ze-reset"
                  onClick={() => {
                    const other: View = view === "front" ? "back" : "front";
                    setCalibration((prev) => ({ ...prev, [other]: { ...cal } }));
                  }}
                >
                  Copy {view} → {view === "front" ? "back" : "front"}
                </button>
              ) : null}
            </div>
          </div>
        ) : mode === "measure" ? (
          <div>
            <header className="ze-rail-head">
              <p className="eyebrow">Measurements</p>
              <button type="button" className="ze-add" onClick={addPom}>+ Add POM</button>
            </header>
            <div style={{ display: "flex", flexDirection: "column", gap: 14, padding: "8px 2px" }}>
              <label className="ze-field">
                <span>Unit</span>
                <select
                  value={measurements?.unit ?? "in"}
                  onChange={(e) => setMeasurements((m) => (m ? { ...m, unit: e.target.value === "cm" ? "cm" : "in" } : m))}
                >
                  <option value="in">inches</option>
                  <option value="cm">cm</option>
                </select>
              </label>
              <label className="ze-field">
                <span>Sample size</span>
                <select
                  value={measurements?.sampleSize ?? ""}
                  onChange={(e) => setMeasurements((m) => (m ? { ...m, sampleSize: e.target.value } : m))}
                >
                  {sizeCols.map((sz) => (
                    <option key={sz} value={sz}>{sz}</option>
                  ))}
                </select>
              </label>
              <p style={{ fontSize: "0.72rem", color: "#8A8680", lineHeight: 1.5 }}>
                {measurements?.rows.length ?? 0} points of measure · {sizeCols.length} sizes. Filled from your spec sheet, stored per SKU.
              </p>
              <button
                type="button"
                className="ze-reset"
                onClick={() => setMeasurements(defaultMeasurements(product.category, product.sizes))}
              >
                Reset to default POM list
              </button>
            </div>
          </div>
        ) : (
        <>
        <header className="ze-rail-head">
          <p className="eyebrow">Zones · {view}</p>
          <button type="button" className="ze-add" onClick={addZone}>+ Add zone</button>
        </header>

        <ol className="ze-list">
          {currentView.map((zone) => {
            const on = zone.id === activeId;
            return (
              <li key={zone.id} className={`ze-item${on ? " is-active" : ""}`}>
                <button type="button" className="ze-item-head" onClick={() => setActiveId(zone.id)}>
                  <span className="ze-item-label">{zone.label}</span>
                  <span className="ze-item-id">{zone.id}</span>
                </button>
                {on ? (
                  <div className="ze-item-body">
                    <label className="ze-field">
                      <span>Label</span>
                      <input
                        type="text"
                        value={zone.label}
                        onChange={(e) => updateLabel(zone.id, e.target.value)}
                      />
                    </label>
                    <label className="ze-field">
                      <span>ID (slug)</span>
                      <input
                        type="text"
                        defaultValue={zone.id}
                        onBlur={(e) => updateId(zone.id, e.target.value)}
                      />
                    </label>
                    <label className="ze-field">
                      <span>Rotation (°)</span>
                      <input
                        type="number"
                        min={0}
                        max={359}
                        step={1}
                        value={Math.round(zone.box.r ?? 0)}
                        onChange={(e) => updateRotation(zone.id, parseInt(e.target.value || "0", 10) || 0)}
                      />
                    </label>
                    <div className="ze-coords">
                      <span>x {zone.box.x.toFixed(2)}</span>
                      <span>y {zone.box.y.toFixed(2)}</span>
                      <span>w {zone.box.w.toFixed(2)}</span>
                      <span>h {zone.box.h.toFixed(2)}</span>
                      <span>r {Math.round(zone.box.r ?? 0)}°</span>
                    </div>
                    <button type="button" className="ze-delete" onClick={() => deleteZone(zone.id)}>
                      Delete zone
                    </button>
                  </div>
                ) : null}
              </li>
            );
          })}
          {currentView.length === 0 ? (
            <li className="ze-empty">No zones for this view yet. Click + Add zone.</li>
          ) : null}
        </ol>
        </>
        )}

        <div className="ze-actions">
          <button type="button" className="pdpx-cta ze-save" onClick={save} disabled={saving}>
            {saving ? "Saving…" : `Save ${product.displayName}`}
          </button>
          {mode === "zones" ? (
            <button type="button" className="ze-reset" onClick={resetToDefaults}>
              Reset to defaults
            </button>
          ) : null}
          {error ? <p className="ze-error">{error}</p> : null}
        </div>
      </aside>
    </div>
  );
}
