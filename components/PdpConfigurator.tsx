"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ProductShot } from "./ProductShot";
import { DraggableArt, type ArtTransform } from "./DraggableArt";
import { useCart } from "./CartProvider";
import { currency, formatLeadTime } from "@/lib/pricing";
import { getDefaultZones, normaliseZonesPayload, isZoneSpecable, normaliseCalibration, derivePlacement, type ProductZones, type ProductCalibration } from "@/lib/zones";
import { PMS_PALETTE, type PmsColor } from "@/lib/pantones";
import type { CatalogProduct } from "@/lib/types";

type Step = "color" | "decoration" | "placement" | "size";

// Spreads a MOQ across every available size as evenly as possible.
function distributeAcross(sizes: string[], total: number): Record<string, number> {
  if (!sizes.length) return {};
  const base = Math.floor(total / sizes.length);
  const remainder = total - base * sizes.length;
  return sizes.reduce<Record<string, number>>((acc, s, i) => {
    acc[s] = base + (i < remainder ? 1 : 0);
    return acc;
  }, {});
}

const STEPS: { key: Step; label: string }[] = [
  { key: "color", label: "Color" },
  { key: "placement", label: "Artwork placement" },
  { key: "decoration", label: "Decoration" },
  { key: "size", label: "Size & quantity" }
];

// When present, the configurator opens in EDIT mode — pre-filled from an
// existing order, and the CTA regenerates that order's proof instead of adding
// a new cart line. This is the self-serve "request changes" → re-proof loop.
export type EditSeed = {
  orderId: string;
  variantId?: string;
  decorationIds?: string[];
  pantones?: PmsColor[];
  view?: "front" | "back";
  zoneId?: string;
  art?: ArtTransform;
  artworkFileUrl?: string;
  artworkFileName?: string;
  sizeQty?: Record<string, number>;
};

export function PdpConfigurator({ product, editOrder }: { product: CatalogProduct; editOrder?: EditSeed }) {
  // Defaults from lib/zones; if /studio has authored a Supabase override for
  // this slug we swap it in on mount.
  const [zones, setZones] = useState<ProductZones>(() => getDefaultZones(product));
  const [calibration, setCalibration] = useState<ProductCalibration | null>(null);
  useEffect(() => {
    let cancelled = false;
    fetch(`/api/zones/${product.slug}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (cancelled) return;
        const override = normaliseZonesPayload(data?.zones);
        if (override && (override.front.length || override.back.length)) {
          setZones({
            front: override.front.length ? override.front : zones.front,
            back: override.back.length ? override.back : zones.back
          });
        }
        setCalibration(normaliseCalibration(data?.calibration));
      })
      .catch(() => {
        // network failure → keep defaults
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [product.slug]);
  const defaultVariant = product.variants.find((v) => v.frontImage) ?? product.variants[0];
  const [variantId, setVariantId] = useState(editOrder?.variantId ?? defaultVariant?.id ?? "");
  const [view, setView] = useState<"front" | "back">(editOrder?.view ?? "front");
  const [step, setStep] = useState<Step>(editOrder ? "placement" : "color");
  const [decorationIds, setDecorationIds] = useState<string[]>(editOrder?.decorationIds ?? []);
  const [pantones, setPantones] = useState<PmsColor[]>(editOrder?.pantones ?? []);
  const [artworkUrl, setArtworkUrl] = useState<string | null>(editOrder?.artworkFileUrl ?? null);
  const [artworkName, setArtworkName] = useState<string | null>(editOrder?.artworkFileName ?? null);
  // Native pixel dims of a raster upload — for print-resolution QA against the
  // ACTUAL physical print size (the 1200px upload floor only knows absolute px).
  const [artMeta, setArtMeta] = useState<{ width: number; height: number } | null>(null);
  const [placementId, setPlacementId] = useState<string | null>(editOrder?.zoneId ?? null);
  // Free position + size of the artwork WITHIN the chosen bounding box.
  // Reset to "fill the box" whenever the shopper picks a different zone — but
  // NOT on the initial mount in edit mode (we'd wipe the seeded placement).
  const [artTransform, setArtTransform] = useState<ArtTransform>(editOrder?.art ?? { ox: 0, oy: 0, sx: 1, sy: 1 });
  const skipArtReset = useRef(Boolean(editOrder));
  useEffect(() => {
    if (skipArtReset.current) {
      skipArtReset.current = false;
      return;
    }
    setArtTransform({ ox: 0, oy: 0, sx: 1, sy: 1 });
  }, [placementId, view]);
  const [sizeQty, setSizeQty] = useState<Record<string, number>>(() =>
    editOrder?.sizeQty ?? distributeAcross(product.sizes, product.moq)
  );
  const [submitting, setSubmitting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const { addItem } = useCart();

  const qty = useMemo(() => Object.values(sizeQty).reduce((s, n) => s + (n || 0), 0), [sizeQty]);
  const belowMoq = qty < product.moq;

  const variant = product.variants.find((v) => v.id === variantId) ?? product.variants[0];
  const hasBack = Boolean(product.greyBack) || product.variants.some((v) => v.backImage);

  const tier = useMemo(() => {
    const sorted = [...product.priceTiers].sort((a, b) => a.minQty - b.minQty);
    return sorted.find((t) => qty >= t.minQty && (t.maxQty == null || qty <= t.maxQty)) ?? sorted[0];
  }, [product.priceTiers, qty]);

  const decoSelected = product.decorations.filter((d) => decorationIds.includes(d.id));
  const decorationAdder = decoSelected.reduce((s, d) => s + d.perUnitAdderUsd, 0);
  // Ink-color cap = the most restrictive selected method's max (default 8 for
  // methods without a max, e.g. embroidery thread colors). Clamp the pick to it.
  const colorCap = decoSelected.length ? Math.min(...decoSelected.map((d) => d.maxColors ?? 8)) : 1;
  // Trim the spot-color selection if the method changes to a tighter cap.
  useEffect(() => {
    setPantones((p) => p.slice(0, colorCap));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [decorationIds]);
  const perUnit = tier.perUnitUsd + decorationAdder;
  const subtotal = perUnit * qty;

  // Only offer placements we can spec to ~95% (calibrated + supported reference
  // frame). Uncalibrated SKUs and unsupported zones (sleeves/hats/etc.) are
  // hidden until their reference is built — so we never quote a placement we
  // can't put exact numbers on.
  const placements = (view === "back" ? zones.back : zones.front).filter((p) =>
    isZoneSpecable(p.id, view, product.category, calibration)
  );
  const placement = placements.find((p) => p.id === placementId) ?? null;

  // Print-resolution QA: native art pixels spread across the REAL printed width
  // (derived from this SKU's calibration). Vectors skip it (scalable). <150 DPI
  // warns; <100 DPI blocks — it would print visibly blurry at that size.
  const printDpi = useMemo(() => {
    if (!artMeta || !placement) return null;
    const cal = calibration?.[view];
    if (!cal) return null;
    const d = derivePlacement(cal, placement.box, artTransform, view);
    if (!d.widthIn || d.widthIn <= 0) return null;
    return Math.round(artMeta.width / d.widthIn);
  }, [artMeta, placement, calibration, view, artTransform]);
  const lowRes = printDpi != null && printDpi < 150;
  const blockRes = printDpi != null && printDpi < 100;

  const stepDone = (s: Step): boolean => {
    if (s === "color") return Boolean(variant);
    if (s === "decoration") return decorationIds.length > 0;
    if (s === "placement") return Boolean(artworkUrl) && Boolean(placement);
    if (s === "size") return qty >= product.moq;
    return false;
  };

  const stepValue = (s: Step): string => {
    if (s === "color") return variant?.colorLabel ?? "—";
    if (s === "decoration")
      return decoSelected.length ? decoSelected.map((d) => d.label).join(" · ") : "Choose method";
    if (s === "placement") return placement?.label ?? (artworkUrl ? "Pick a location" : "Upload artwork");
    if (s === "size") return `${qty.toLocaleString()} units`;
    return "";
  };

  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadWarning, setUploadWarning] = useState<string | null>(null);

  // --- Configurator-stage motion: cursor parallax + ambient idle breathe ---
  const stageRef = useRef<HTMLDivElement>(null);
  const [tilt, setTilt] = useState({ x: 0, y: 0 });
  const [idle, setIdle] = useState(false);
  const idleTimer = useRef<number | null>(null);
  const resetIdle = useCallback(() => {
    setIdle(false);
    if (idleTimer.current) window.clearTimeout(idleTimer.current);
    idleTimer.current = window.setTimeout(() => setIdle(true), 8000);
  }, []);
  useEffect(() => {
    resetIdle();
    return () => {
      if (idleTimer.current) window.clearTimeout(idleTimer.current);
    };
  }, [resetIdle]);
  const onStagePointerMove = (e: React.PointerEvent) => {
    resetIdle();
    const rect = stageRef.current?.getBoundingClientRect();
    if (!rect) return;
    const nx = ((e.clientX - rect.left) / rect.width - 0.5) * 2; // -1..1
    const ny = ((e.clientY - rect.top) / rect.height - 0.5) * 2;
    setTilt({ x: nx * 2, y: ny * -2 }); // ±2deg
  };
  const onStagePointerLeave = () => setTilt({ x: 0, y: 0 });

  const removeArtwork = () => {
    if (artworkUrl?.startsWith("blob:")) URL.revokeObjectURL(artworkUrl);
    setArtworkUrl(null);
    setArtworkName(null);
    setArtMeta(null);
    setUploadError(null);
    if (fileRef.current) fileRef.current.value = "";
  };

  const mirrorToBack = () => {
    if (!hasBack || !artworkUrl) return;
    setView("back");
    const backZone = zones.back.find((z) => z.id === "center-back") ?? zones.back[0];
    if (backZone) setPlacementId(backZone.id);
    setArtTransform({ ox: 0, oy: 0, sx: 1, sy: 1 });
  };

  const handleFile = async (file: File | undefined | null) => {
    if (!file) return;
    setUploadError(null);
    setUploadWarning(null);
    // Show a local preview immediately while the upload runs.
    const localPreview = URL.createObjectURL(file);
    setArtworkUrl(localPreview);
    setArtworkName(file.name);
    if (!placementId) {
      setPlacementId(placements[0]?.id ?? null);
    }
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/upload-artwork", { method: "POST", body: fd });
      const data = (await res.json()) as { url?: string; error?: string; warning?: string; kind?: string; meta?: { width?: number; height?: number } };
      if (!res.ok || !data.url) {
        throw new Error(data.error || "Upload failed");
      }
      // Swap the local blob URL for the persisted public URL so it survives
      // navigation into the cart + ends up on the order.
      URL.revokeObjectURL(localPreview);
      setArtworkUrl(data.url);
      setUploadWarning(data.warning ?? null);
      setArtMeta(data.kind === "raster" && data.meta?.width && data.meta?.height ? { width: data.meta.width, height: data.meta.height } : null);
    } catch (err) {
      URL.revokeObjectURL(localPreview);
      setArtworkUrl(null);
      setArtworkName(null);
      setUploadError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const handleAddToCart = () => {
    if (belowMoq || !variant || submitting || blockRes) return;
    const decorationLabel = decoSelected.length
      ? decoSelected.map((d) => d.label).join(" + ")
      : "Undecorated";
    const perUnitTotal = tier.perUnitUsd + decorationAdder;
    addItem({
      productId: product.id,
      slug: product.slug,
      displayName: product.displayName,
      skuCode: product.skuCode,
      variantId: variant.id,
      colorLabel: variant.colorLabel,
      colorHex: variant.colorHex,
      image: product.greyFront ?? variant.frontImage,
      decorationIds,
      decorationLabel,
      sizeQty,
      quantity: qty,
      perUnitUsd: tier.perUnitUsd,
      decorationAdderUsd: decorationAdder,
      subtotalUsd: tier.perUnitUsd * qty,
      totalUsd: perUnitTotal * qty,
      artworkFileName: artworkName ?? "Artwork file pending",
      artworkFileUrl: artworkUrl ?? undefined,
      artworkNotes: placement
        ? [
            `Zone: ${placement.label}${view === "back" ? " (back)" : ""}`,
            `Box: x=${placement.box.x.toFixed(3)} y=${placement.box.y.toFixed(3)} w=${placement.box.w.toFixed(3)} h=${placement.box.h.toFixed(3)}${placement.box.r ? ` r=${Math.round(placement.box.r)}°` : ""}`,
            `Art-in-box: ox=${artTransform.ox.toFixed(3)} oy=${artTransform.oy.toFixed(3)} sx=${artTransform.sx.toFixed(3)} sy=${artTransform.sy.toFixed(3)}${artTransform.r ? ` r=${Math.round(artTransform.r)}°` : ""}`
          ].join("\n")
        : "",
      // Structured placement — the real spec that threads to the tech pack/proof.
      artworkPlacement: placement
        ? {
            view,
            zoneId: placement.id,
            zoneLabel: placement.label,
            box: placement.box,
            art: artTransform,
            method: decorationLabel,
            colors: pantones.length || undefined,
            pantones: pantones.length ? pantones : undefined,
            maxColors: decoSelected[0]?.maxColors
          }
        : undefined
    });
    setSubmitting(true);
    router.push("/cart");
  };

  // EDIT MODE — regenerate the existing order's proof from the adjusted config.
  const [done, setDone] = useState(false);
  const [updateError, setUpdateError] = useState<string | null>(null);
  const handleUpdate = async () => {
    if (!editOrder || belowMoq || !variant || submitting || blockRes) return;
    setSubmitting(true);
    setUpdateError(null);
    const decorationLabel = decoSelected.length ? decoSelected.map((d) => d.label).join(" + ") : "Undecorated";
    const artworkPlacement = placement
      ? {
          view,
          zoneId: placement.id,
          zoneLabel: placement.label,
          box: placement.box,
          art: artTransform,
          method: decorationLabel,
          colors: pantones.length || undefined,
          pantones: pantones.length ? pantones : undefined,
          maxColors: decoSelected[0]?.maxColors,
        }
      : undefined;
    try {
      const res = await fetch(`/api/orders/${editOrder.orderId}/update`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          variantId: variant.id,
          colorLabel: variant.colorLabel,
          colorHex: variant.colorHex,
          decorationIds,
          decorationLabel,
          artworkFileUrl: artworkUrl ?? undefined,
          artworkFileName: artworkName ?? undefined,
          sizeBreakdown: sizeQty,
          quantity: qty,
          artworkPlacement,
        }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => null);
        setUpdateError(d?.error || "Couldn't update — try again.");
        setSubmitting(false);
        return;
      }
      setDone(true);
    } catch {
      setUpdateError("Couldn't update — try again.");
      setSubmitting(false);
    }
  };

  if (done) {
    return (
      <section className="pdpx">
        <div className="pdpx-stage" style={{ textAlign: "center", padding: "64px 24px" }}>
          <p className="pdpx-eyebrow" style={{ color: "var(--color-terracotta)" }}>Updated</p>
          <h2 style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: "1.8rem", textTransform: "uppercase", letterSpacing: "0.5px", margin: "10px 0 12px" }}>Fresh proof on the way</h2>
          <p style={{ fontSize: 15, lineHeight: 1.6, color: "var(--color-neutral)", maxWidth: 460, margin: "0 auto" }}>
            We&apos;ve regenerated your proof with the changes and emailed it for approval. Nothing goes to production until you approve the new version.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="pdpx">
      <div className="pdpx-stage">
        <div className="pdpx-stage-toolbar">
          <span className="pdpx-eyebrow">{product.category}</span>
          {hasBack ? (
            <div className="pdpx-view-pills" role="tablist" aria-label="Garment view">
              <button
                type="button"
                role="tab"
                aria-selected={view === "front"}
                className={`pdpx-pill${view === "front" ? " is-on" : ""}`}
                onClick={() => setView("front")}
              >
                Front
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={view === "back"}
                className={`pdpx-pill${view === "back" ? " is-on" : ""}`}
                onClick={() => setView("back")}
              >
                Back
              </button>
            </div>
          ) : (
            <span className="pdpx-eyebrow pdpx-eyebrow--muted">{view} view</span>
          )}
        </div>

        {/* Both views stay mounted and crossfade — color changes morph in place
            via the tint transition, view changes opacity-crossfade between the
            two image layers, and the entrance keyframe only plays on first load. */}
        <div
          ref={stageRef}
          className="pdpx-canvas"
          onPointerMove={onStagePointerMove}
          onPointerLeave={onStagePointerLeave}
        >
          <div
            className="pdpx-canvas-tilt"
            style={{ transform: `perspective(1400px) rotateY(${tilt.x}deg) rotateX(${tilt.y}deg)` }}
          >
            <div className={`pdpx-canvas-breathe${idle ? " is-breathing" : ""}`}>
              <span className="pdpx-ground-shadow" aria-hidden />
              <span className={`pdpx-view-layer${view === "front" ? " is-on" : ""}`}>
                <ProductShot product={product} variant={variant} view="front" />
              </span>
              {hasBack ? (
                <span className={`pdpx-view-layer${view === "back" ? " is-on" : ""}`}>
                  <ProductShot product={product} variant={variant} view="back" />
                </span>
              ) : null}
              {artworkUrl && placement ? (
                <span
                  className="pdpx-place-box"
                  style={{
                    left: `${placement.box.x * 100}%`,
                    top: `${placement.box.y * 100}%`,
                    width: `${placement.box.w * 100}%`,
                    height: `${placement.box.h * 100}%`,
                    transform: `rotate(${placement.box.r ?? 0}deg)`,
                    transformOrigin: "center center"
                  }}
                >
                  <DraggableArt url={artworkUrl} transform={artTransform} onChange={setArtTransform} />
                </span>
              ) : null}
            </div>
          </div>
        </div>

        <p className="pdpx-shotnote">
          Live preview · {variant?.colorLabel}{placement ? ` · ${placement.label}` : ""}
        </p>
      </div>

      <aside className="pdpx-rail">
        <div className="pdpx-rail-head">
          <p className="pdpx-style">Style {product.skuCode}</p>
          <h1 className="pdpx-title">{product.displayName}</h1>
          <p className="pdpx-lede">{product.headline}</p>
        </div>

        <div className="pdpx-steps">
          {STEPS.map((s, i) => {
            const open = step === s.key;
            const done = stepDone(s.key);
            return (
              <div key={s.key} className={`pdpx-step${open ? " is-open" : ""}${done ? " is-done" : ""}`}>
                <button
                  type="button"
                  className="pdpx-step-head"
                  aria-expanded={open}
                  aria-controls={`pdpx-panel-${s.key}`}
                  onClick={() => setStep(s.key)}
                >
                  <span className="pdpx-step-num">{String(i + 1).padStart(2, "0")}</span>
                  <span className="pdpx-step-label">{s.label}</span>
                  <span className="pdpx-step-value">{stepValue(s.key)}</span>
                </button>

                {open ? (
                  <div id={`pdpx-panel-${s.key}`} role="region" aria-label={s.label} className="pdpx-step-body">
                    {s.key === "color" ? (
                      <div className="pdpx-colors">
                        {product.variants.map((v) => (
                          <button
                            key={v.id}
                            type="button"
                            className={`pdpx-swatch${variantId === v.id ? " is-on" : ""}`}
                            style={{ background: v.colorHex }}
                            data-label={v.colorLabel}
                            aria-label={v.colorLabel}
                            onClick={() => setVariantId(v.id)}
                          />
                        ))}
                        {(() => {
                          const sv = product.variants.find((v) => v.id === variantId);
                          return sv ? (
                            <p style={{ width: "100%", fontSize: "0.72rem", color: "var(--color-neutral)", marginTop: 10 }}>
                              {sv.colorLabel}
                              {sv.colorTcx ? ` · Pantone ${sv.colorTcx}` : ""}
                            </p>
                          ) : null;
                        })()}
                      </div>
                    ) : null}

                    {s.key === "decoration" ? (
                      <div className="pdpx-decos">
                        {product.decorations.map((d) => {
                          const on = decorationIds.includes(d.id);
                          return (
                            <button
                              key={d.id}
                              type="button"
                              className={`pdpx-deco${on ? " is-on" : ""}`}
                              onClick={() =>
                                setDecorationIds((prev) =>
                                  on ? prev.filter((x) => x !== d.id) : [...prev, d.id]
                                )
                              }
                            >
                              <span>
                                <strong>{d.label}</strong>
                                <em>{d.description}</em>
                              </span>
                              <span className="pdpx-deco-adder">+{currency(d.perUnitAdderUsd)}/unit</span>
                            </button>
                          );
                        })}
                        {decorationIds.length > 0 ? (
                          <div className="pdpx-inkcolors" style={{ marginTop: 16 }}>
                            <p className="pdpx-place-label">
                              Ink colors{pantones.length ? ` · ${pantones.length} of ${colorCap}` : ` · pick up to ${colorCap}`}
                            </p>
                            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 6 }}>
                              {PMS_PALETTE.map((c) => {
                                const on = pantones.some((p) => p.code === c.code);
                                const full = pantones.length >= colorCap;
                                return (
                                  <button
                                    key={c.code}
                                    type="button"
                                    title={`${c.name} · ${c.code}`}
                                    aria-pressed={on}
                                    disabled={!on && full}
                                    onClick={() =>
                                      setPantones((prev) =>
                                        on ? prev.filter((p) => p.code !== c.code) : prev.length < colorCap ? [...prev, c] : prev
                                      )
                                    }
                                    style={{
                                      width: 30,
                                      height: 30,
                                      borderRadius: 8,
                                      background: c.hex,
                                      border: on ? "2px solid var(--color-charcoal)" : "1px solid rgba(0,0,0,0.18)",
                                      boxShadow: on ? "0 0 0 2px var(--color-cream)" : "none",
                                      cursor: !on && full ? "not-allowed" : "pointer",
                                      opacity: !on && full ? 0.4 : 1
                                    }}
                                  />
                                );
                              })}
                            </div>
                            {pantones.length > 0 && (
                              <p style={{ fontSize: "0.72rem", color: "var(--color-neutral)", marginTop: 8, lineHeight: 1.4 }}>
                                {pantones.map((p) => `${p.name} (${p.code})`).join(" · ")}
                                {pantones.length === 1 ? " — your art prints in this ink." : " — your art's spot colors."}
                              </p>
                            )}
                          </div>
                        ) : null}
                      </div>
                    ) : null}

                    {s.key === "placement" ? (
                      <div className="pdpx-place">
                        <input
                          ref={fileRef}
                          type="file"
                          accept="image/png,image/jpeg,image/svg+xml,application/pdf,.ai,.eps"
                          className="pdpx-file"
                          onChange={(e) => handleFile(e.target.files?.[0])}
                        />
                        <button type="button" className="pdpx-drop" onClick={() => fileRef.current?.click()} disabled={uploading}>
                          <span className="pdpx-drop-eyebrow">Step 01</span>
                          <span className="pdpx-drop-cta">
                            {uploading ? "Uploading…" : artworkName ? artworkName : "Upload artwork"}
                          </span>
                          <span className="pdpx-drop-hint">
                            {uploadError
                              ? uploadError
                              : uploadWarning && artworkUrl && !uploading
                              ? uploadWarning
                              : artworkUrl && !uploading
                              ? "Uploaded · validated for print ✓"
                              : "PNG, JPG, SVG, WEBP, PDF — vector preferred"}
                          </span>
                        </button>

                        <p className="pdpx-place-label">Step 02 · Location</p>
                        {placements.length === 0 ? (
                          <p className="pdpx-place-hint">
                            Placement options for this {view} are being finalised. We only show locations we can spec to the inch — more open up as each style is calibrated.
                          </p>
                        ) : (
                          <div className="pdpx-locs">
                            {placements.map((p) => (
                              <button
                                key={p.id}
                                type="button"
                                className={`pdpx-loc${placementId === p.id ? " is-on" : ""}`}
                                onClick={() => setPlacementId(p.id)}
                              >
                                {p.label}
                              </button>
                            ))}
                          </div>
                        )}
                        {artworkUrl ? (
                          <>
                            <p className="pdpx-place-hint">
                              Drag to reposition, corners to resize, top circle to rotate. The dashed outline is the
                              maximum print area — MOA finalises the spec during artwork QA.
                            </p>
                            <div className="pdpx-place-actions">
                              {hasBack && view === "front" ? (
                                <button type="button" className="pdpx-link" onClick={mirrorToBack}>
                                  Mirror to back ↓
                                </button>
                              ) : null}
                              <button type="button" className="pdpx-link pdpx-link--danger" onClick={removeArtwork}>
                                Remove artwork
                              </button>
                            </div>
                          </>
                        ) : (
                          <p className="pdpx-place-hint">Drop a file above to see it on the garment.</p>
                        )}
                      </div>
                    ) : null}

                    {s.key === "size" ? (
                      <div className="pdpx-size">
                        <div className="pdpx-matrix">
                          {product.sizes.map((size) => (
                            <label key={size} className="pdpx-matrix-cell">
                              <span className="pdpx-matrix-size">{size}</span>
                              <input
                                type="number"
                                min={0}
                                step={1}
                                value={sizeQty[size] ?? 0}
                                onChange={(e) =>
                                  setSizeQty((prev) => ({
                                    ...prev,
                                    [size]: Math.max(0, parseInt(e.target.value || "0", 10) || 0)
                                  }))
                                }
                                className="pdpx-matrix-input"
                              />
                            </label>
                          ))}
                        </div>
                        <div className="pdpx-matrix-foot">
                          <span>Total · MOQ {product.moq}</span>
                          <strong className={belowMoq ? "is-warn" : undefined}>
                            {qty.toLocaleString()} units{belowMoq ? " — below MOQ" : ""}
                          </strong>
                        </div>
                        <div className="pdpx-tiers">
                          {product.priceTiers.map((t) => {
                            const active = qty >= t.minQty && (t.maxQty == null || qty <= t.maxQty);
                            return (
                              <div key={t.minQty} className={`pdpx-tier${active ? " is-active" : ""}`}>
                                <span>
                                  {t.minQty}
                                  {t.maxQty ? `–${t.maxQty}` : "+"} units
                                </span>
                                <strong>{currency(t.perUnitUsd)}/unit</strong>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>

        <div className="pdpx-foot">
          <div className="pdpx-breakdown">
            <div className="pdpx-breakdown-row">
              <span>Base unit</span>
              <span>{currency(tier.perUnitUsd)}</span>
            </div>
            {decoSelected.map((d) => (
              <div key={d.id} className="pdpx-breakdown-row pdpx-breakdown-row--adder">
                <span>+ {d.label}</span>
                <span>+{currency(d.perUnitAdderUsd)}</span>
              </div>
            ))}
            <div className="pdpx-breakdown-row pdpx-breakdown-row--sum">
              <span>Per unit · {qty.toLocaleString()} units</span>
              <span>{currency(perUnit)}</span>
            </div>
          </div>
          <div className="pdpx-price">
            <span className="pdpx-from">Subtotal</span>
            <strong className="pdpx-total">{currency(subtotal)}</strong>
          </div>
          {printDpi != null && (lowRes || blockRes) ? (
            <p className="pdpx-foot-note" style={{ color: blockRes ? "var(--color-terracotta)" : "var(--color-warning)", fontWeight: 600 }}>
              {blockRes
                ? `Artwork is too low-resolution for this print size (~${printDpi} DPI). Make the print smaller, or upload a higher-res image or vector (SVG/PDF).`
                : `Low resolution at this size (~${printDpi} DPI) — it may look soft. A higher-res image or vector prints sharper.`}
            </p>
          ) : null}
          <button
            type="button"
            className="pdpx-cta"
            onClick={editOrder ? handleUpdate : handleAddToCart}
            disabled={belowMoq || submitting || blockRes}
          >
            {blockRes
              ? "Resolution too low for this size"
              : belowMoq
              ? `Add ${(product.moq - qty).toLocaleString()} more to reach MOQ`
              : editOrder
              ? submitting
                ? "Updating proof…"
                : "Update proof →"
              : submitting
              ? "Adding to order…"
              : "Add to order →"}
          </button>
          {updateError ? <p className="pdpx-foot-note" style={{ color: "var(--color-terracotta)" }}>{updateError}</p> : null}
          <p className="pdpx-foot-note">
            Lead time {formatLeadTime(product.leadTimeDays)} · MOA-managed quality control · Artwork finalised in QA
          </p>
        </div>
      </aside>

      {/* Persistent configurator bar pinned to the bottom of the viewport on
          desktop — informational, no CTA. Hidden on mobile where the in-rail
          sticky CTA covers the same role. */}
      <div className="pdpx-bottombar" aria-hidden={false}>
        <div className="pdpx-bottombar-inner">
          <div className="pdpx-bb-cell">
            <span>Style</span>
            <strong>{product.skuCode}</strong>
          </div>
          <div className="pdpx-bb-cell">
            <span>Color</span>
            <strong>
              <span className="pdpx-bb-dot" style={{ background: variant?.colorHex }} />
              {variant?.colorLabel}
            </strong>
          </div>
          {placement ? (
            <div className="pdpx-bb-cell pdpx-bb-cell--hide-sm">
              <span>Placement</span>
              <strong>{placement.label}</strong>
            </div>
          ) : null}
          {decoSelected.length ? (
            <div className="pdpx-bb-cell pdpx-bb-cell--hide-sm">
              <span>Decoration</span>
              <strong>{decoSelected.map((d) => d.label).join(" + ")}</strong>
            </div>
          ) : null}
          <div className="pdpx-bb-cell pdpx-bb-cell--right">
            <span>{qty.toLocaleString()} units</span>
            <strong className="pdpx-bb-price">{currency(subtotal)}</strong>
          </div>
        </div>
      </div>
    </section>
  );
}
