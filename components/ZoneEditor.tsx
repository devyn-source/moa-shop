"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ProductShot } from "./ProductShot";
import {
  getDefaultZones,
  normaliseZonesPayload,
  type Box,
  type ProductZones,
  type View,
  type Zone
} from "@/lib/zones";
import type { CatalogProduct } from "@/lib/types";

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
      })
      .catch(() => {
        setZones(getDefaultZones(product));
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
        body: JSON.stringify({ zones })
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
          {hasBack ? (
            <div className="pdpx-view-pills">
              <button type="button" className={`pdpx-pill${view === "front" ? " is-on" : ""}`} onClick={() => setView("front")}>Front</button>
              <button type="button" className={`pdpx-pill${view === "back" ? " is-on" : ""}`} onClick={() => setView("back")}>Back</button>
            </div>
          ) : null}
        </header>

        <div
          ref={canvasRef}
          className="ze-canvas"
          onPointerDown={() => setActiveId(null)}
        >
          <ProductShot product={product} variant={heroVariant} view={view} />
          {currentView.map((zone) => {
            const on = zone.id === activeId;
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
                <span className="ze-zone-label">{zone.label}</span>
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
        </div>

        <p className="ze-hint">
          Click + drag inside a box to move · drag the corners to resize · click empty canvas to deselect.
        </p>
      </section>

      <aside className="ze-rail">
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

        <div className="ze-actions">
          <button type="button" className="pdpx-cta ze-save" onClick={save} disabled={saving}>
            {saving ? "Saving…" : `Save ${product.displayName} zones`}
          </button>
          <button type="button" className="ze-reset" onClick={resetToDefaults}>
            Reset to defaults
          </button>
          {error ? <p className="ze-error">{error}</p> : null}
        </div>
      </aside>
    </div>
  );
}
