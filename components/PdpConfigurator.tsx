"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ProductShot } from "./ProductShot";
import { useToast } from "./ToastProvider";
import { METHOD_MEDIA } from "@/lib/method-media";
import { DraggableArt, type ArtTransform } from "./DraggableArt";
import Garment3DClient from "./Garment3DClient";
import Garment3DDecoratorClient from "./Garment3DDecoratorClient";
import Garment3DPreviewClient from "./Garment3DPreviewClient";
import type { StudioCapture } from "./Garment3DDecorator";
import { useCart } from "./CartProvider";
import { currency, formatLeadTime, formatDeliveredBy, WOVEN_LABEL_ADDER_USD, EXTRA_PLACEMENT_ADDER_USD } from "@/lib/pricing";
import { getDefaultZones, normaliseZonesPayload, isZoneSpecable, normaliseCalibration, derivePlacement, type ProductZones, type ProductCalibration } from "@/lib/zones";
import { PMS_PALETTE, type PmsColor } from "@/lib/pantones";
import type { CatalogProduct } from "@/lib/types";
import { analytics } from "@/lib/analytics";
import { presetsFor, presetSpec, type PlacementPreset } from "@/lib/presets";
import { readArtColours, nearestPms } from "@/lib/art-colours";
import { WovenLabelModal, type WovenLabel } from "./WovenLabelModal";

// Upsell rates mirror the server's pricing source (lib/pricing.ts) so the live
// breakdown and the charged total can never disagree. The first placement is
// included; each extra location (full back, sleeve) adds the flat per-unit fee.
const WOVEN_LABEL_ADDER = WOVEN_LABEL_ADDER_USD;
const EXTRA_PLACEMENT_ADDER = EXTRA_PLACEMENT_ADDER_USD;

// A finalised additional placement (beyond the one in the live editor). Each
// carries its own artwork + zone so a buyer can put a chest logo on the front
// and a different graphic on the back.
type ExtraPlacement = {
  id: string;
  view: "front" | "back";
  zoneId: string;
  zoneLabel: string;
  box: { x: number; y: number; w: number; h: number; r?: number };
  art: ArtTransform;
  artworkUrl: string;
  artworkName: string | null;
  artMeta: { width: number; height: number } | null;
};

type Step = "color" | "fabric" | "decoration" | "placement" | "size";

// Spreads a MOQ across every available size as evenly as possible.
// The size curve most orders follow (M and L heavy). Used for the default run.
function typicalSplit(sizes: string[], total: number): Record<string, number> {
  if (sizes.length <= 1) return sizes.length ? { [sizes[0]]: total } : {};
  const W: Record<string, number> = { XS: 0.05, S: 0.15, M: 0.3, L: 0.3, XL: 0.15, XXL: 0.05, "2XL": 0.05, "3XL": 0.03 };
  const w = sizes.map((s) => W[s] ?? 1 / sizes.length);
  const sum = w.reduce((a, b) => a + b, 0);
  const out: Record<string, number> = {};
  sizes.forEach((s, i) => (out[s] = Math.round((total * w[i]) / sum)));
  const mid = sizes.includes("M") ? "M" : sizes[Math.floor(sizes.length / 2)];
  out[mid] = Math.max(0, out[mid] + total - Object.values(out).reduce((a, b) => a + b, 0));
  return out;
}

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
  { key: "color", label: "Colour" },
  { key: "placement", label: "Artwork" },
  { key: "fabric", label: "Fabric" },
  { key: "decoration", label: "Decoration" },
  { key: "size", label: "Size & quantity" }
];

// When present, the configurator opens in EDIT mode — pre-filled from an
// existing order, and the CTA regenerates that order's proof instead of adding
// a new cart line. This is the self-serve "request changes" → re-proof loop.
export type EditSeed = {
  orderId?: string;
  variantId?: string;
  decorationIds?: string[];
  pantones?: PmsColor[];
  view?: "front" | "back";
  zoneId?: string;
  art?: ArtTransform;
  artworkFileUrl?: string;
  artworkFileName?: string;
  sizeQty?: Record<string, number>;
  extraPlacements?: ExtraPlacement[];
  // Canonical placement list (box + art + view) — works for BOTH 2D and the 3D
  // Studio, so a shared config restores the exact placement on either path.
  placements?: import("@/lib/types").ArtworkPlacement[];
};

// A fully-configured box item produced by the PDP in bundle mode. It is the
// EXACT cart payload a standalone order produces (all features: multi-placement,
// woven label, size run, decoration) PLUS the seed extras needed to re-open it
// in the configurator for editing.
export type BundleItemConfig = {
  productId: string;
  slug: string;
  displayName: string;
  skuCode: string;
  variantId: string;
  colorLabel: string;
  colorHex?: string;
  image?: string;
  decorationIds: string[];
  decorationLabel: string;
  sizeQty: Record<string, number>;
  quantity: number;
  perUnitUsd: number;
  decorationAdderUsd: number;
  subtotalUsd: number;
  totalUsd: number;
  artworkFileName: string;
  artworkFileUrl?: string;
  artworkNotes: string;
  artworkPlacement?: import("@/lib/types").ArtworkPlacement;
  artworkPlacements?: import("@/lib/types").ArtworkPlacement[];
  wovenLabel?: boolean;
  // re-edit seed extras
  seed: EditSeed;
};

export type BundleMode = {
  boxQty: number; // program size — the size run totals to this
  editing?: boolean; // CTA says "Save changes" instead of "Add to box"
  onUse: (cfg: BundleItemConfig) => void;
  onCancel?: () => void;
};

export function PdpConfigurator({
  product,
  editOrder,
  seed,
  bundle,
  modelUrl
}: {
  product: CatalogProduct;
  editOrder?: EditSeed;
  seed?: EditSeed;
  bundle?: BundleMode;
  // Public GLB URL for this SKU (sku-models bucket) — enables the 3D viewer.
  modelUrl?: string | null;
}) {
  // editOrder = editing an existing order (CTA updates it). seed = a shared config
  // pre-fill (CTA adds to cart normally). Both seed the same initial state.
  const seed0 = editOrder ?? seed;
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
  // Packaging pieces (PR Box) configure ONLY artwork placement — no color/
  // decoration/size run (1 per box). Freeform placement (no calibrated zones).
  const isPackaging = product.category === "packaging";
  // Packaging: color step only if the piece is colorable (>1 variant, e.g. the box);
  // always the placement step. No decoration/size.
  const visibleSteps = (
    isPackaging
      ? STEPS.filter(
          (s) =>
            s.key === "placement" ||
            (s.key === "color" && product.variants.length > 1) ||
            (s.key === "decoration" && product.decorations.length > 0)
        )
      : // In a PR Box, the size run is set once at the program level — hide the
        // per-item size step here so each piece inherits the box breakdown.
        bundle
        ? STEPS.filter((s) => s.key !== "size" && s.key !== "fabric")
        : STEPS
  )
    // Fabric step only when the SKU has fabric tiers to choose from.
    .filter((s) => s.key !== "fabric" || Boolean(product.fabricOptions?.length))
    .map((s) => (isPackaging && s.key === "decoration" ? { ...s, label: "Finish" } : s));
  const [variantId, setVariantId] = useState(seed0?.variantId ?? defaultVariant?.id ?? "");
  const [view, setView] = useState<"front" | "back">(seed0?.view ?? "front");
  const [step, setStep] = useState<Step>(
    isPackaging ? (product.variants.length > 1 ? "color" : "placement") : seed0 ? "placement" : "color"
  );
  const [decorationIds, setDecorationIds] = useState<string[]>(seed0?.decorationIds ?? []);
  const [pantones, setPantones] = useState<PmsColor[]>(seed0?.pantones ?? []);
  const [artworkUrl, setArtworkUrl] = useState<string | null>(seed0?.artworkFileUrl ?? null);
  const [artworkName, setArtworkName] = useState<string | null>(seed0?.artworkFileName ?? null);
  // Native pixel dims of a raster upload — for print-resolution QA against the
  // ACTUAL physical print size (the 1200px upload floor only knows absolute px).
  const [artMeta, setArtMeta] = useState<{ width: number; height: number } | null>(null);
  const [placementId, setPlacementId] = useState<string | null>(seed0?.zoneId ?? null);
  // Free position + size of the artwork WITHIN the chosen bounding box.
  // Reset to "fill the box" whenever the shopper picks a different zone — but
  // NOT on the initial mount in edit mode (we'd wipe the seeded placement).
  const [artTransform, setArtTransform] = useState<ArtTransform>(seed0?.art ?? { ox: 0, oy: 0, sx: 1, sy: 1 });
  const skipArtReset = useRef(Boolean(seed0));
  useEffect(() => {
    if (skipArtReset.current) {
      skipArtReset.current = false;
      return;
    }
    setArtTransform({ ox: 0, oy: 0, sx: 1, sy: 1 });
  }, [placementId, view]);
  const [sizeQty, setSizeQty] = useState<Record<string, number>>(() =>
    seed0?.sizeQty ?? (bundle ? distributeAcross(product.sizes, Math.max(product.moq, bundle.boxQty)) : typicalSplit(product.sizes, product.moq))
  );
  const [submitting, setSubmitting] = useState(false);
  const [downloading, setDownloading] = useState(false);
  // 2D recolor mock vs the rotatable 3D model. Policy: where a SKU has a GLB,
  // 3D REPLACES 2D as the default hero — the 2D flat is kept only as a fallback
  // and for artwork placement (you can't drag art onto a spinning model).
  const has3d = Boolean(modelUrl);
  // 3D SKUs place artwork ON the model (decal → captured UV). Non-3D SKUs keep
  // the proven 2D flat zone flow. Blast radius = only SKUs that have a GLB.
  const use3dPlacement = has3d;
  const [stageMode, setStageMode] = useState<"2d" | "3d">(has3d ? "3d" : "2d");
  const [place3d, setPlace3d] = useState<StudioCapture[]>(() =>
    has3d && seed0?.placements?.length
      ? seed0.placements.map((p, i) => ({
          id: `seed-${i}`,
          view: p.view,
          zoneId: p.zoneId,
          zoneLabel: p.zoneLabel,
          box: p.box,
          art: p.art,
          spec3d: p.spec3d,
          widthIn: p.spec3d?.widthIn ?? null,
          dpi: null,
        }))
      : []
  );
  const is3d = has3d && stageMode === "3d";
  // MOA standard placements in real inches (3D styles). The first one is applied
  // as soon as artwork lands, so the logo is on the garment immediately.
  const presets = useMemo(() => (use3dPlacement ? presetsFor(product.slug, product.category) : []), [use3dPlacement, product.slug, product.category]);
  const [preset, setPreset] = useState<(PlacementPreset & { key: string }) | null>(null);
  const applyPreset3d = (p: PlacementPreset) => setPreset({ ...p, key: `${p.id}-${Date.now()}` });

  // Same artwork on another style: the last upload (and its method, inks and
  // placement) is remembered in this browser for a week and offered on the next PDP.
  type SavedArt = { url: string; name: string; meta: { width: number; height: number } | null; decorationIds?: string[]; pantones?: PmsColor[]; presetId?: string; ts: number };
  const ART_KEY = "moa:last-artwork";
  const rememberArt = (a: Omit<SavedArt, "ts">) => {
    try { localStorage.setItem(ART_KEY, JSON.stringify({ ...a, ts: Date.now() })); } catch { /* storage unavailable */ }
  };
  const [lastArt, setLastArt] = useState<SavedArt | null>(null);
  const applyLastArt = (a: SavedArt) => {
    const match = presets.find((p) => p.id === a.presetId) ?? presets[0];
    if (match) applyPreset3d(match);
    const ok = (a.decorationIds ?? []).filter((id) => product.decorations.some((d) => d.id === id));
    if (ok.length && !decorationIds.length) { setDecorationIds(ok); setPantones(a.pantones ?? []); }
    setArtworkName(a.name);
    setArtMeta(a.meta);
    setArtworkUrl(a.url);
    setLastArt(null);
    analytics.track("artwork_reused", { slug: product.slug });
  };
  useEffect(() => {
    if (seed0 || bundle) return;
    try {
      const a = JSON.parse(localStorage.getItem(ART_KEY) || "null") as SavedArt | null;
      if (a?.url && Date.now() - a.ts < 7 * 864e5) setLastArt(a);
    } catch { /* storage unavailable */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // The decal editor takes over the stage during the placement step; 3D is the
  // hero on every other step. (No user-facing 2D/3D toggle for model SKUs.)
  const placing3d = use3dPlacement && step === "placement";
  useEffect(() => {
    if (has3d) setStageMode("3d");
  }, [has3d]);
  useEffect(() => {
    if (artworkUrl && presets.length && !preset && !place3d.some((p) => p.id !== "current")) applyPreset3d(presets[0]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [artworkUrl, presets.length]);
  useEffect(() => {
    if (!artworkUrl || artworkUrl.startsWith("blob:")) return;
    try {
      const a = JSON.parse(localStorage.getItem("moa:last-artwork") || "null");
      if (a?.url === artworkUrl) localStorage.setItem("moa:last-artwork", JSON.stringify({ ...a, decorationIds, pantones, presetId: preset?.id ?? a.presetId }));
    } catch { /* storage unavailable */ }
  }, [artworkUrl, decorationIds, pantones, preset?.id]);
  const [wovenLabel, setWovenLabel] = useState<WovenLabel | null>(null);
  const [fabricOptionId, setFabricOptionId] = useState<string>(product.fabricOptions?.[0]?.id ?? "");
  const fabricOption = product.fabricOptions?.find((o) => o.id === fabricOptionId);
  const fabricAdder = fabricOption?.upchargeUsd ?? 0;
  const [wovenOpen, setWovenOpen] = useState(false);
  // Additional placements beyond the one being edited in the live stage. The
  // editor below always edits the "current" placement; saving it pushes a
  // finalised copy here and clears the editor for the next location.
  const [savedPlacements, setSavedPlacements] = useState<ExtraPlacement[]>(seed0?.extraPlacements ?? []);
  const fileRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const { addItem } = useCart();
  const { toast } = useToast();

  // Fire product_viewed once per SKU (Shopify-style funnel entry).
  useEffect(() => {
    const from = Math.min(...product.priceTiers.map((t) => t.perUnitUsd));
    analytics.productViewed({ slug: product.slug, name: product.displayName, category: product.category, from_price: from });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [product.slug]);

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
  const wovenAdder = wovenLabel ? WOVEN_LABEL_ADDER : 0;

  // Only offer placements we can spec to ~95% (calibrated + supported reference
  // frame). Uncalibrated SKUs and unsupported zones (sleeves/hats/etc.) are
  // hidden until their reference is built — so we never quote a placement we
  // can't put exact numbers on.
  const placements = (view === "back" ? zones.back : zones.front).filter((p) =>
    isPackaging ? true : isZoneSpecable(p.id, view, product.category, calibration)
  );
  const placement = placements.find((p) => p.id === placementId) ?? null;

  // The live editor counts as a placement once it has both art and a zone.
  // First placement is included in the decoration price; each additional one
  // (saved below, or the editor on top of saved ones) adds the flat fee.
  const editorComplete = Boolean(artworkUrl && placement);
  const placementCount = use3dPlacement
    ? artworkUrl && place3d.length ? place3d.length : 0
    : savedPlacements.length + (editorComplete ? 1 : 0);
  const extraPlacementCount = Math.max(0, placementCount - 1);
  const extraPlacementAdder = extraPlacementCount * EXTRA_PLACEMENT_ADDER;
  const perUnit = tier.perUnitUsd + decorationAdder + wovenAdder + extraPlacementAdder + fabricAdder;
  const subtotal = perUnit * qty;

  // Snapshot the live editor into the saved list and clear it for the next
  // location. Requires art + a chosen zone (editorComplete).
  const saveCurrentPlacement = () => {
    if (!editorComplete || !placement || !artworkUrl) return;
    setSavedPlacements((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        view,
        zoneId: placement.id,
        zoneLabel: placement.label,
        box: placement.box,
        art: artTransform,
        artworkUrl,
        artworkName,
        artMeta,
      },
    ]);
    // Clear the editor (keep the current view) so the next placement starts fresh.
    setPlacementId(null);
    setArtworkUrl(null);
    setArtworkName(null);
    setArtMeta(null);
    setArtTransform({ ox: 0, oy: 0, sx: 1, sy: 1 });
    if (fileRef.current) fileRef.current.value = "";
    analytics.track("placement_added", { slug: product.slug });
  };

  const removeSavedPlacement = (id: string) =>
    setSavedPlacements((prev) => prev.filter((p) => p.id !== id));

  // All placements as structured ArtworkPlacement records, in creation order:
  // saved (banked first) lead, the live editor placement (most recent) trails.
  // out[0] is the primary — what the proof renders + downstream singular
  // consumers read.
  const allPlacements = useMemo(() => {
    const method = decoSelected.map((d) => d.label).join(" + ") || undefined;
    const colors = pantones.length || undefined;
    const pms = pantones.length ? pantones : undefined;
    const maxColors = decoSelected[0]?.maxColors;
    // 3D SKUs: a single placement carrying the captured UV. Zone label is a rough
    // wearer-relative read of uv.x; the BOX is nominal (proof fallback) — the real
    // inch spec is derived from placement3d.uv via the pattern (Phase 2).
    // 3D Studio: emits a STANDARD placement (zone box + art transform), so the
    // existing derivePlacement → real-inch dims / DPI / proof / tech-pack all
    // work natively — the 3D garment is just the editing surface.
    if (use3dPlacement) {
      if (!place3d.length || !artworkUrl) return [];
      return place3d.map((p) => ({
        view: p.view,
        zoneId: p.zoneId,
        zoneLabel: p.zoneLabel,
        box: p.box,
        art: p.art,
        method,
        colors,
        pantones: pms,
        maxColors,
        artworkFileUrl: artworkUrl ?? undefined,
        artworkFileName: artworkName ?? undefined,
        // exact 3D-anchored spec (off the mesh surface) — production truth
        spec3d: p.spec3d ?? undefined,
      }));
    }
    const out: import("@/lib/types").ArtworkPlacement[] = savedPlacements.map((s) => ({
      view: s.view,
      zoneId: s.zoneId,
      zoneLabel: s.zoneLabel,
      box: s.box,
      art: s.art,
      method,
      colors,
      pantones: pms,
      maxColors,
      artworkFileUrl: s.artworkUrl,
      artworkFileName: s.artworkName ?? undefined,
    }));
    if (editorComplete && placement) {
      out.push({
        view,
        zoneId: placement.id,
        zoneLabel: placement.label,
        box: placement.box,
        art: artTransform,
        method,
        colors,
        pantones: pms,
        maxColors,
        artworkFileUrl: artworkUrl ?? undefined,
        artworkFileName: artworkName ?? undefined,
      });
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editorComplete, placement, view, artTransform, decoSelected, pantones, artworkUrl, artworkName, savedPlacements, use3dPlacement, place3d, zones]);

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
  const dpi3d = use3dPlacement ? place3d.reduce<number | null>((m, p) => (p.dpi == null ? m : m == null ? p.dpi : Math.min(m, p.dpi)), null) : null;
  const effDpi = use3dPlacement ? dpi3d : printDpi;
  const lowRes = effDpi != null && effDpi < 150;
  const blockRes = effDpi != null && effDpi < 100;

  const stepDone = (s: Step): boolean => {
    if (s === "color") return Boolean(variant);
    if (s === "decoration") return decorationIds.length > 0;
    if (s === "placement") return placementCount > 0;
    if (s === "size") return qty >= product.moq;
    return false;
  };

  // The row shows what has been chosen, never an instruction; empty until chosen.
  const stepValue = (s: Step): string => {
    if (s === "color") return variant?.colorLabel ?? "";
    if (s === "fabric") return fabricOption?.label ?? "";
    if (s === "decoration") return decoSelected.map((d) => d.label).join(", ");
    if (s === "placement") {
      if (!artworkUrl) return "";
      const labels = use3dPlacement ? [...new Set(place3d.map((p) => p.zoneLabel))] : [placement?.label, ...savedPlacements.map((p) => p.zoneLabel)].filter(Boolean);
      return labels.join(", ");
    }
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

  // Suggest a method + Pantone inks from the artwork itself (only if the buyer
  // hasn't chosen yet). Few flat colours -> screen print; more -> embroidery;
  // photographic art -> left for our team to advise in the proof.
  const [artNote, setArtNote] = useState<string | null>(null);
  const suggestFromArt = async (url: string) => {
    const read = await readArtColours(url);
    if (!read) { setArtNote(null); return; }
    if (read.photo) { setArtNote("This artwork has photographic detail. Our team confirms the best method in your proof."); return; }
    if (decorationIds.length) return;
    const has = (id: string) => product.decorations.some((d) => d.id === id && d.isAvailable !== false);
    const method = read.colours.length <= 4 && has("screen_print") ? "screen_print" : has("embroidery") ? "embroidery" : null;
    if (!method) return;
    const cap = product.decorations.find((d) => d.id === method)?.maxColors ?? 8;
    const inks = [...new Map(read.colours.map((h) => nearestPms(h)).map((p) => [p.code, p])).values()].slice(0, cap);
    setDecorationIds([method]);
    setPantones(inks);
    const label = product.decorations.find((d) => d.id === method)?.label ?? method;
    setArtNote(`We found ${inks.length} ${inks.length === 1 ? "colour" : "colours"} in your artwork, matched to Pantone. ${label} is selected. Change either under Decoration.`);
  };

  const handleFile = async (file: File | undefined | null) => {
    if (!file) return;
    setArtNote(null);
    setUploadError(null);
    setUploadWarning(null);
    // Show a local preview immediately while the upload runs.
    const localPreview = URL.createObjectURL(file);
    setArtworkUrl(localPreview);
    if (/^image\/(png|jpe?g|webp|svg\+xml)$/.test(file.type)) void suggestFromArt(localPreview);
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
      const meta = data.kind === "raster" && data.meta?.width && data.meta?.height ? { width: data.meta.width, height: data.meta.height } : null;
      setArtMeta(meta);
      rememberArt({ url: data.url, name: file.name, meta });
      analytics.artworkUploaded({ slug: product.slug, file: file.name, kind: data.kind ?? "unknown", low_res: Boolean(data.warning) });
    } catch (err) {
      URL.revokeObjectURL(localPreview);
      setArtworkUrl(null);
      setArtworkName(null);
      setUploadError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  // Quick size-run presets — fill the matrix to MOQ instead of typing each size.
  const applyPreset = (kind: "even" | "curve" | "clear") => {
    const sizes = product.sizes;
    if (kind === "clear") return setSizeQty({});
    const target = Math.max(product.moq, qty || 0);
    if (sizes.length === 1) return setSizeQty({ [sizes[0]]: target });
    const next: Record<string, number> = {};
    if (kind === "even") {
      const base = Math.floor(target / sizes.length);
      sizes.forEach((s) => (next[s] = base));
    } else {
      const W: Record<string, number> = { XS: 0.05, S: 0.15, M: 0.3, L: 0.3, XL: 0.15, XXL: 0.05, "2XL": 0.05, "3XL": 0.03 };
      const w = sizes.map((s) => W[s] ?? 1 / sizes.length);
      const sum = w.reduce((a, b) => a + b, 0);
      sizes.forEach((s, i) => (next[s] = Math.round((target * w[i]) / sum)));
    }
    // true up rounding so the run hits the target exactly, on the middle size
    const mid = sizes.includes("M") ? "M" : sizes[Math.floor(sizes.length / 2)];
    next[mid] = Math.max(0, (next[mid] || 0) + (target - Object.values(next).reduce((a, b) => a + b, 0)));
    setSizeQty(next);
  };

  // Fill the size run to an exact total (clicking a tier, or a custom quantity).
  const fillToTotal = (total: number) => {
    const sizes = product.sizes;
    const n = Math.max(0, Math.round(total || 0));
    if (sizes.length === 1) return setSizeQty({ [sizes[0]]: n });
    const W: Record<string, number> = { XS: 0.05, S: 0.15, M: 0.3, L: 0.3, XL: 0.15, XXL: 0.05, "2XL": 0.05, "3XL": 0.03 };
    const w = sizes.map((s) => W[s] ?? 1 / sizes.length);
    const sum = w.reduce((a, b) => a + b, 0);
    const next: Record<string, number> = {};
    sizes.forEach((s, i) => (next[s] = Math.round((n * w[i]) / sum)));
    const mid = sizes.includes("M") ? "M" : sizes[Math.floor(sizes.length / 2)];
    next[mid] = Math.max(0, (next[mid] || 0) + (n - Object.values(next).reduce((a, b) => a + b, 0)));
    setSizeQty(next);
  };

  // Download the live preview as a PNG mockup. Flatten the 3D tilt first for a
  // clean capture; lazy-load html-to-image so it's off the main bundle.
  const handleDownload = async () => {
    if (!stageRef.current) return;
    setDownloading(true);
    setTilt({ x: 0, y: 0 });
    try {
      await new Promise((r) => setTimeout(r, 60));
      let dataUrl: string;
      if (is3d) {
        // WebGL: read the rendered frame straight off the canvas. Works because
        // the 3D Canvas is created with preserveDrawingBuffer (see Garment3D).
        const canvas = stageRef.current.querySelector("canvas");
        if (!canvas) throw new Error("no 3d canvas");
        dataUrl = canvas.toDataURL("image/png");
      } else {
        const { toPng } = await import("html-to-image");
        dataUrl = await toPng(stageRef.current, { pixelRatio: 2, cacheBust: true, backgroundColor: "#EEEAE3" });
      }
      const a = document.createElement("a");
      a.href = dataUrl;
      a.download = `${product.slug}-${variant?.colorLabel ?? "mockup"}${is3d ? "-3d" : ""}.png`.replace(/\s+/g, "-").toLowerCase();
      a.click();
      analytics.track("mockup_downloaded", { slug: product.slug, mode: is3d ? "3d" : "2d" });
    } catch {
      /* ignore — download is best-effort */
    } finally {
      setDownloading(false);
    }
  };

  const handleAddToCart = () => {
    if (belowMoq || !variant || submitting || blockRes) return;
    const decorationLabel = (decoSelected.length
      ? decoSelected.map((d) => d.label).join(" + ")
      : "Undecorated") + (wovenLabel ? " + Woven label" : "");
    const perUnitTotal = tier.perUnitUsd + decorationAdder + wovenAdder + extraPlacementAdder + fabricAdder;
    const decorationLabelFull = decorationLabel + (placementCount > 1 ? ` · ${placementCount} placements` : "");
    analytics.addToCart({
      slug: product.slug, name: product.displayName, category: product.category,
      color: variant.colorLabel, decoration: decorationLabelFull, quantity: qty,
      unit_price: perUnitTotal, value: perUnitTotal * qty,
    });
    const primary = allPlacements[0];
    const placementNotes = allPlacements.map((p, i) => {
      const head = `Placement ${i + 1}: ${p.zoneLabel}${p.view === "back" ? " (back)" : " (front)"}${i === 0 ? " · included" : ` · +${currency(EXTRA_PLACEMENT_ADDER)}/unit`}`;
      const box = `  Box: x=${p.box.x.toFixed(3)} y=${p.box.y.toFixed(3)} w=${p.box.w.toFixed(3)} h=${p.box.h.toFixed(3)}${p.box.r ? ` r=${Math.round(p.box.r)}°` : ""}`;
      const art = `  Art-in-box: ox=${p.art.ox.toFixed(3)} oy=${p.art.oy.toFixed(3)} sx=${p.art.sx.toFixed(3)} sy=${p.art.sy.toFixed(3)}${p.art.r ? ` r=${Math.round(p.art.r)}°` : ""}`;
      const file = p.artworkFileUrl ? `  Art file: ${p.artworkFileName ?? "uploaded"} (${p.artworkFileUrl})` : "";
      return [head, box, art, file].filter(Boolean).join("\n");
    });
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
      decorationLabel: decorationLabelFull,
      sizeQty,
      quantity: qty,
      perUnitUsd: tier.perUnitUsd,
      decorationAdderUsd: decorationAdder + wovenAdder + extraPlacementAdder,
      subtotalUsd: tier.perUnitUsd * qty,
      totalUsd: perUnitTotal * qty,
      artworkFileName: primary?.artworkFileName ?? artworkName ?? "Artwork file pending",
      artworkFileUrl: primary?.artworkFileUrl ?? artworkUrl ?? undefined,
      artworkNotes: [
        ...placementNotes,
        ...(wovenLabel ? [`Woven label: ${wovenLabel.logoUrl ? `logo ${wovenLabel.logoName} (${wovenLabel.logoUrl})` : `"${wovenLabel.text}"`} · label fabric ${wovenLabel.labelColor} · thread ${wovenLabel.thread} · inside neck${wovenLabel.logoTransform ? ` · logo box ox=${wovenLabel.logoTransform.ox.toFixed(2)} oy=${wovenLabel.logoTransform.oy.toFixed(2)} w=${wovenLabel.logoTransform.sx.toFixed(2)} h=${wovenLabel.logoTransform.sy.toFixed(2)}` : ""}`] : []),
      ].join("\n"),
      // Structured placement — primary threads to the tech pack/proof; the full
      // set rides along for multi-placement orders.
      artworkPlacement: primary,
      artworkPlacements: allPlacements.length ? allPlacements : undefined,
      wovenLabel: Boolean(wovenLabel),
      fabricOptionId: product.fabricOptions?.length ? fabricOptionId : undefined,
      fabricLabel: fabricOption?.label,
      fabricUpchargeUsd: fabricAdder,
    });
    toast("Added to your order", { href: "/cart", cta: "View cart" });
  };

  // BUNDLE MODE — same full payload as add-to-cart, but handed to the box (no
  // standalone cart line). Carries every feature + the seed to re-open for edit.
  const handleAddToBox = () => {
    if (!bundle || belowMoq || !variant || blockRes) return;
    const decorationLabel =
      (decoSelected.length ? decoSelected.map((d) => d.label).join(" + ") : "Undecorated") +
      (wovenLabel ? " + Woven label" : "");
    const decorationLabelFull = decorationLabel + (placementCount > 1 ? ` · ${placementCount} placements` : "");
    const perUnitTotal = tier.perUnitUsd + decorationAdder + wovenAdder + extraPlacementAdder + fabricAdder;
    const primary = allPlacements[0];
    bundle.onUse({
      productId: product.id,
      slug: product.slug,
      displayName: product.displayName,
      skuCode: product.skuCode,
      variantId: variant.id,
      colorLabel: variant.colorLabel,
      colorHex: variant.colorHex,
      image: product.greyFront ?? variant.frontImage,
      decorationIds,
      decorationLabel: decorationLabelFull,
      sizeQty,
      quantity: qty,
      perUnitUsd: tier.perUnitUsd,
      decorationAdderUsd: decorationAdder + wovenAdder + extraPlacementAdder,
      subtotalUsd: tier.perUnitUsd * qty,
      totalUsd: perUnitTotal * qty,
      artworkFileName: primary?.artworkFileName ?? artworkName ?? "Artwork file pending",
      artworkFileUrl: primary?.artworkFileUrl ?? artworkUrl ?? undefined,
      artworkNotes:
        allPlacements
          .map((p, i) => `Placement ${i + 1}: ${p.zoneLabel}${p.view === "back" ? " (back)" : " (front)"}${i === 0 ? " · included" : " · +placement"}`)
          .join("\n") + (wovenLabel ? "\nWoven label: yes" : ""),
      artworkPlacement: primary,
      artworkPlacements: allPlacements.length ? allPlacements : undefined,
      wovenLabel: Boolean(wovenLabel),
      seed: {
        variantId: variant.id,
        decorationIds,
        pantones,
        view,
        zoneId: placementId ?? undefined,
        art: artTransform,
        artworkFileUrl: artworkUrl ?? undefined,
        artworkFileName: artworkName ?? undefined,
        sizeQty,
        extraPlacements: savedPlacements.length ? savedPlacements : undefined
      }
    });
  };

  // EDIT MODE — regenerate the existing order's proof from the adjusted config.
  const [done, setDone] = useState(false);
  const [updateError, setUpdateError] = useState<string | null>(null);
  const handleUpdate = async () => {
    if (!editOrder || belowMoq || !variant || submitting || blockRes) return;
    setSubmitting(true);
    setUpdateError(null);
    const decorationLabel = decoSelected.length ? decoSelected.map((d) => d.label).join(" + ") : "Undecorated";
    const primary = allPlacements[0];
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
          artworkFileUrl: primary?.artworkFileUrl ?? artworkUrl ?? undefined,
          artworkFileName: primary?.artworkFileName ?? artworkName ?? undefined,
          sizeBreakdown: sizeQty,
          quantity: qty,
          artworkPlacement: primary,
          artworkPlacements: allPlacements.length ? allPlacements : undefined,
        }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => null);
        setUpdateError(d?.error || "Couldn't update. Try again.");
        setSubmitting(false);
        return;
      }
      setDone(true);
    } catch {
      setUpdateError("Couldn't update. Try again.");
      setSubmitting(false);
    }
  };

  if (done) {
    return (
      <section className="pdpx">
        <div className="pdpx-stage" style={{ textAlign: "center", padding: "64px 24px" }}>
          <p className="pdpx-eyebrow" style={{ color: "var(--color-terracotta)" }}>Updated</p>
          <h2 style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 28, textTransform: "uppercase", letterSpacing: "0.5px", margin: "10px 0 12px" }}>Fresh proof on the way</h2>
          <p style={{ fontSize: 16, lineHeight: 1.6, color: "var(--color-neutral)", maxWidth: 460, margin: "0 auto" }}>
            We&apos;ve saved your changes. The MOA team reviews them and your updated proof arrives within 24 business hours. Nothing goes to production until you approve the new version.
          </p>
        </div>
      </section>
    );
  }

  // New orders go through a review first: the spec in plain words is what we produce.
  const [reviewOpen, setReviewOpen] = useState(false);
  const onCta = bundle ? handleAddToBox : editOrder ? handleUpdate : () => setReviewOpen(true);

  // One CTA definition, rendered in the rail and in the pinned bottom bar.
  const ctaButton = (className: string) => (
    <button type="button" className={className} onClick={onCta} disabled={belowMoq || submitting || blockRes}>

            {blockRes
              ? "Resolution too low for this size"
              : belowMoq
              ? `Add ${(product.moq - qty).toLocaleString()} more to reach MOQ`
              : bundle
              ? bundle.editing
                ? "Save changes"
                : "Add to box"
              : editOrder
              ? submitting
                ? "Updating proof…"
                : "Update proof"
              : submitting
              ? "Adding to order…"
              : "Review order"}
    </button>
  );

  return (
    <section className="pdpx">
      <div className="pdpx-stage">
        <div className="pdpx-stage-toolbar">
          <span className="pdpx-eyebrow">{product.category}</span>
          {is3d ? (
            <span className="pdpx-eyebrow pdpx-eyebrow--muted">Drag to rotate</span>
          ) : hasBack ? (
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
          <button type="button" className="pdpx-download pdpx-download--icon" onClick={handleDownload} disabled={downloading} aria-label="Download image" title="Download image">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden><path d="M8 2v8M4.5 6.5L8 10l3.5-3.5M2.5 13.5h11" stroke="currentColor" strokeWidth="1.6" /></svg>
          </button>
        </div>

        {/* Both views stay mounted and crossfade — color changes morph in place
            via the tint transition, view changes opacity-crossfade between the
            two image layers, and the entrance keyframe only plays on first load. */}
        <div
          ref={stageRef}
          className={`pdpx-canvas${downloading ? " is-capturing" : ""}${is3d ? " is-3d" : ""}`}
          onPointerMove={is3d ? undefined : onStagePointerMove}
          onPointerLeave={is3d ? undefined : onStagePointerLeave}
        >
          {placing3d && artworkUrl && modelUrl ? (
            <div className="pdpx-canvas-3d">
              <Garment3DDecoratorClient url={modelUrl} artUrl={artworkUrl} hex={variant?.colorHex || "#C9C4B8"} zones={zones.front} backZones={zones.back} artPxWidth={artMeta?.width} model3d={calibration?.model3d} method={decoSelected.map((d) => d.label).join(" + ") || undefined} initialPlacements={place3d} preset={preset} hideZoneChips={presets.length > 0} onChange={setPlace3d} />
            </div>
          ) : is3d && modelUrl ? (
            <div className="pdpx-canvas-3d">
              {place3d.length && artworkUrl ? (
                /* Keep the placed artwork on the garment across all other steps. */
                <Garment3DPreviewClient url={modelUrl} hex={variant?.colorHex || "#C9C4B8"} artUrl={artworkUrl} placements={place3d} />
              ) : (
                <Garment3DClient url={modelUrl} hex={variant?.colorHex} showSwatches={false} />
              )}
            </div>
          ) : (
          <div
            className="pdpx-canvas-tilt"
            style={{ transform: `perspective(1400px) rotateY(${tilt.x}deg) rotateX(${tilt.y}deg)` }}
          >
            <div className={`pdpx-canvas-breathe${idle ? " is-breathing" : ""}`}>
              <span className="pdpx-ground-shadow" aria-hidden />
              <span className={`pdpx-view-layer${view === "front" ? " is-on" : ""}`}>
                {/* The PDP's LCP — the initial front stage shot loads eagerly. */}
                <ProductShot product={product} variant={variant} view="front" priority sizes="(max-width: 900px) 92vw, 700px" />
              </span>
              {hasBack ? (
                <span className={`pdpx-view-layer${view === "back" ? " is-on" : ""}`}>
                  <ProductShot product={product} variant={variant} view="back" sizes="(max-width: 900px) 92vw, 700px" />
                </span>
              ) : null}
              {/* Saved placements on this view — static (the editor above is the
                  one you're actively positioning). */}
              {savedPlacements
                .filter((s) => s.view === view)
                .map((s) => (
                  <span
                    key={s.id}
                    className="pdpx-place-box pdpx-place-box--saved"
                    style={{
                      left: `${s.box.x * 100}%`,
                      top: `${s.box.y * 100}%`,
                      width: `${s.box.w * 100}%`,
                      height: `${s.box.h * 100}%`,
                      transform: `rotate(${s.box.r ?? 0}deg)`,
                      transformOrigin: "center center"
                    }}
                  >
                    <span
                      className="pdpx-art-static"
                      style={{
                        left: `${s.art.ox * 100}%`,
                        top: `${s.art.oy * 100}%`,
                        width: `${s.art.sx * 100}%`,
                        height: `${s.art.sy * 100}%`,
                        transform: `rotate(${s.art.r ?? 0}deg)`,
                        transformOrigin: "center center",
                        backgroundImage: `url("${s.artworkUrl}")`
                      }}
                    />
                  </span>
                ))}
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
          )}
        </div>

        <p className="pdpx-shotnote">
          {is3d
            ? `3D preview, ${variant?.colorLabel} · drag to rotate, scroll to zoom`
            : `Live preview, ${variant?.colorLabel}${placement ? ` · ${placement.label}` : ""}`}
        </p>
      </div>

      <aside className="pdpx-rail">
        <div className="pdpx-rail-head">
          <p className="pdpx-style">Style {product.skuCode}</p>
          <h1 className="pdpx-title">{product.displayName}</h1>
          <p className="pdpx-lede">{product.headline}</p>
        </div>

        <div className="pdpx-steps">
          {visibleSteps.map((s, i) => {
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

                <AnimatePresence initial={false}>
                {open ? (
                  <motion.div
                    key="body"
                    style={{ overflow: "hidden" }}
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{
                      height: { duration: 0.42, ease: [0.22, 1, 0.36, 1] },
                      opacity: { duration: 0.26, ease: [0.22, 1, 0.36, 1] }
                    }}
                  >
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
                            onClick={() => { setVariantId(v.id); analytics.variantSelected({ slug: product.slug, color: v.colorLabel }); if (!artworkUrl) setTimeout(() => setStep("placement"), 350); }}
                          />
                        ))}
                        {(() => {
                          const sv = product.variants.find((v) => v.id === variantId);
                          return sv ? (
                            <p style={{ width: "100%", fontSize: 12, color: "var(--color-neutral)", marginTop: 10 }}>
                              {sv.colorLabel}
                              {sv.colorTcx ? ` · Pantone ${sv.colorTcx}` : ""}
                            </p>
                          ) : null;
                        })()}
                      </div>
                    ) : null}

                    {s.key === "fabric" ? (
                      <div className="pdpx-fabrics">
                        {product.fabricOptions?.map((o) => {
                          const on = o.id === fabricOptionId;
                          return (
                            <button
                              key={o.id}
                              type="button"
                              className={`pdpx-fabric${on ? " is-on" : ""}`}
                              onClick={() => setFabricOptionId(o.id)}
                            >
                              <span className="pdpx-fabric-tier">{o.tier}</span>
                              <span className="pdpx-fabric-name">{o.label}</span>
                              <span className="pdpx-fabric-comp">
                                {o.composition}
                                {o.weight ? ` · ${o.weight}` : ""}
                                {o.liner ? ` · ${o.liner}` : ""}
                              </span>
                              <span className="pdpx-fabric-price">
                                {o.upchargeUsd > 0 ? `+${currency(o.upchargeUsd)}/unit` : "Included"}
                              </span>
                            </button>
                          );
                        })}
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
                              onClick={() => {
                                if (!on) analytics.decorationSelected({ slug: product.slug, method: d.label });
                                setDecorationIds((prev) =>
                                  on ? prev.filter((x) => x !== d.id) : [...prev, d.id]
                                );
                              }}
                            >
                              {METHOD_MEDIA[d.id] ? (
                                <span className="pdpx-deco-shot">
                                  <Image src={METHOD_MEDIA[d.id]!.image} alt="" width={800} height={800} sizes="96px" />
                                </span>
                              ) : null}
                              <span className="pdpx-deco-text">
                                <strong>{d.label}</strong>
                                <em>{d.description}</em>
                              </span>
                              <span className="pdpx-deco-adder">+{currency(d.perUnitAdderUsd)}/unit</span>
                            </button>
                          );
                        })}
                        {decorationIds.length > 0 ? (
                          <div className="pdpx-inks">
                            <p className="pdpx-place-label">Ink colours <span className="pdpx-inks-count">{pantones.length} of {colorCap}</span></p>
                            <div className="pdpx-inks-grid">
                              {PMS_PALETTE.map((c) => {
                                const on = pantones.some((p) => p.code === c.code);
                                const full = pantones.length >= colorCap;
                                return (
                                  <button
                                    key={c.code}
                                    type="button"
                                    className={`pdpx-ink${on ? " is-on" : ""}`}
                                    title={`${c.name}, ${c.code}`}
                                    aria-label={`${c.name}, ${c.code}`}
                                    aria-pressed={on}
                                    disabled={!on && full}
                                    style={{ background: c.hex }}
                                    onClick={() => setPantones((prev) => (on ? prev.filter((p) => p.code !== c.code) : prev.length < colorCap ? [...prev, c] : prev))}
                                  />
                                );
                              })}
                            </div>
                            {pantones.length ? (
                              <ul className="pdpx-ink-list">
                                {pantones.map((p) => (
                                  <li key={p.code}><span style={{ background: p.hex }} aria-hidden />{p.name}<em>{p.code}</em></li>
                                ))}
                              </ul>
                            ) : (
                              <p className="pdpx-place-hint">Pick the ink colours in your artwork.</p>
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
                        {lastArt && !artworkUrl ? (
                          <div className="pdpx-reuse">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img className="pdpx-reuse-thumb" src={lastArt.url} alt="" />
                            <span className="pdpx-reuse-text">
                              <strong>Use the same artwork</strong>
                              <span>{lastArt.name}, with the same method, inks and placement.</span>
                            </span>
                            <button type="button" className="pdpx-reuse-btn" onClick={() => applyLastArt(lastArt)}>Use it</button>
                          </div>
                        ) : null}
                        <button
                          type="button"
                          className={`pdpx-drop${dragOver ? " is-dragover" : ""}`}
                          onClick={() => fileRef.current?.click()}
                          disabled={uploading}
                          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                          onDragEnter={(e) => { e.preventDefault(); setDragOver(true); }}
                          onDragLeave={() => setDragOver(false)}
                          onDrop={(e) => { e.preventDefault(); setDragOver(false); handleFile(e.dataTransfer.files?.[0]); }}
                        >
                          <span className="pdpx-drop-eyebrow">Your artwork</span>
                          <span className="pdpx-drop-cta">
                            {uploading ? "Uploading…" : artworkName ? artworkName : "Upload artwork"}
                          </span>
                          <span className={`pdpx-drop-hint${uploadError ? " is-error" : uploadWarning && artworkUrl && !uploading ? " is-warn" : artworkUrl && !uploading ? " is-ok" : ""}`}>
                            {uploadError
                              ? uploadError
                              : uploadWarning && artworkUrl && !uploading
                              ? uploadWarning
                              : artworkUrl && !uploading
                              ? "Uploaded · high-resolution, print-ready"
                              : "PNG, JPG, SVG, WEBP, PDF, vector preferred"}
                          </span>
                        </button>

                        {use3dPlacement ? (
                          artworkUrl && presets.length ? (
                            <div className="pdpx-presets">
                              <p className="pdpx-place-label">Placement</p>
                              <div className="pdpx-preset-list" role="group" aria-label="Placement">
                                {presets.map((p) => (
                                  <button key={p.id} type="button" className={`pdpx-preset${preset?.id === p.id ? " is-on" : ""}`} onClick={() => applyPreset3d(p)}>
                                    <span className="pdpx-preset-name">{p.label}</span>
                                    <span className="pdpx-preset-spec">{presetSpec(p)}</span>
                                  </button>
                                ))}
                              </div>
                              <p className="pdpx-place-hint">Drag the artwork on the garment to fine tune it. Save a placement to add another one.</p>
                              {artNote ? <p className="pdpx-art-note">{artNote}</p> : null}
                            </div>
                          ) : (
                            <p className="pdpx-place-hint">
                              {artworkUrl ? "Drag the artwork on the garment to place it." : "Upload your artwork and it goes straight onto the garment at our standard placement."}
                            </p>
                          )
                        ) : (
                          <>
                        <p className="pdpx-place-label">Step 02, Location</p>
                        {placements.length === 0 ? (
                          <p className="pdpx-place-hint">
                            Placement options for this {view} are being finalised. We only show locations we can spec to the inch. More open up as each style is calibrated.
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
                              maximum print area. MOA finalises the spec during artwork QA.
                            </p>
                            <div className="pdpx-place-actions">
                              {hasBack && view === "front" ? (
                                <button type="button" className="pdpx-link" onClick={mirrorToBack}>
                                  Mirror to back
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

                        {/* Multi-placement — bank the current location, build more.
                            First placement is included; each extra is a flat add-on. */}
                        <div className="pdpx-places-multi">
                          {savedPlacements.length > 0 ? (
                            <ul className="pdpx-saved-list">
                              {savedPlacements.map((s) => (
                                <li key={s.id} className="pdpx-saved-chip">
                                  <span
                                    className="pdpx-saved-thumb"
                                    style={{ backgroundImage: `url("${s.artworkUrl}")` }}
                                    aria-hidden
                                  />
                                  <span className="pdpx-saved-meta">
                                    <strong>{s.zoneLabel}</strong>
                                    <em>{s.view === "back" ? "Back" : "Front"}</em>
                                  </span>
                                  <button
                                    type="button"
                                    className="pdpx-saved-x"
                                    onClick={() => removeSavedPlacement(s.id)}
                                    aria-label={`Remove ${s.zoneLabel}`}
                                  >
                                    ✕
                                  </button>
                                </li>
                              ))}
                            </ul>
                          ) : null}
                          <button
                            type="button"
                            className="pdpx-add-placement"
                            disabled={!editorComplete}
                            onClick={saveCurrentPlacement}
                          >
                            <span className="pdpx-add-placement-label">+ Save &amp; add another placement</span>
                            <span className="pdpx-add-placement-price">+{currency(EXTRA_PLACEMENT_ADDER)}/unit each</span>
                          </button>
                          <p className="pdpx-place-hint">
                            {editorComplete
                              ? `Bank this location, then put a different graphic on the back, a sleeve, or anywhere we can spec. First placement included; each extra +${currency(EXTRA_PLACEMENT_ADDER)}/unit.`
                              : `Want it in more than one spot? Add artwork + a location above, then save it to start another. First placement included; each extra +${currency(EXTRA_PLACEMENT_ADDER)}/unit.`}
                          </p>
                        </div>
                          </>
                        )}
                      </div>
                    ) : null}

                    {s.key === "size" ? (() => {
                      const tiers = [...product.priceTiers].sort((x, y) => x.minQty - y.minQty);
                      const next = tiers.find((t) => t.minQty > qty);
                      const bump = (n: number) => fillToTotal(Math.max(product.moq, qty + n));
                      const setSize = (size: string, n: number) => setSizeQty((prev) => ({ ...prev, [size]: Math.max(0, n) }));
                      return (
                      <div className="pdpx-size pdpx-size2">
                        <div className="pdpx-ladder" role="group" aria-label="Price per unit by quantity">
                          {tiers.map((t) => {
                            const active = qty >= t.minQty && (t.maxQty == null || qty <= t.maxQty);
                            return (
                              <button type="button" key={t.minQty} className={`pdpx-rung${active ? " is-on" : ""}`} onClick={() => fillToTotal(t.minQty)} aria-pressed={active}>
                                <strong>{currency(t.perUnitUsd)}</strong>
                                <span>{t.minQty}{t.maxQty ? `-${t.maxQty}` : "+"}</span>
                              </button>
                            );
                          })}
                        </div>
                        {next ? (
                          <p className="pdpx-nudge">Add {(next.minQty - qty).toLocaleString()} more for {currency(next.perUnitUsd)} per unit.</p>
                        ) : null}

                        <div className="pdpx-total-row">
                          <span className="pdpx-place-label">Total</span>
                          <div className="pdpx-stepper pdpx-stepper--lg">
                            <button type="button" aria-label="Fewer" onClick={() => bump(-10)} disabled={qty <= product.moq}>
                              <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden><path d="M3 7h8" stroke="currentColor" strokeWidth="1.8" /></svg>
                            </button>
                            <input type="number" min={product.moq} step={1} value={qty || ""} onChange={(e) => fillToTotal(parseInt(e.target.value || "0", 10) || 0)} aria-label="Total units" />
                            <button type="button" aria-label="More" onClick={() => bump(10)}>
                              <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden><path d="M3 7h8M7 3v8" stroke="currentColor" strokeWidth="1.8" /></svg>
                            </button>
                          </div>
                        </div>

                        {product.sizes.length > 1 ? (
                          <>
                            <div className="pdpx-split">
                              <span className="pdpx-place-label">Sizes</span>
                              <span className="pdpx-split-btns">
                                <button type="button" onClick={() => applyPreset("curve")}>Typical split</button>
                                <button type="button" onClick={() => applyPreset("even")}>Even split</button>
                              </span>
                            </div>
                            <div className="pdpx-sizegrid">
                              {product.sizes.map((size) => (
                                <div key={size} className="pdpx-sizecell">
                                  <span className="pdpx-sizecell-name">{size}</span>
                                  <div className="pdpx-stepper">
                                    <button type="button" aria-label={`Fewer ${size}`} onClick={() => setSize(size, (sizeQty[size] ?? 0) - 1)}>
                                      <svg width="10" height="10" viewBox="0 0 14 14" aria-hidden><path d="M3 7h8" stroke="currentColor" strokeWidth="2" /></svg>
                                    </button>
                                    <input type="number" min={0} step={1} value={sizeQty[size] ?? 0} onChange={(e) => setSize(size, parseInt(e.target.value || "0", 10) || 0)} aria-label={`${size} units`} />
                                    <button type="button" aria-label={`More ${size}`} onClick={() => setSize(size, (sizeQty[size] ?? 0) + 1)}>
                                      <svg width="10" height="10" viewBox="0 0 14 14" aria-hidden><path d="M3 7h8M7 3v8" stroke="currentColor" strokeWidth="2" /></svg>
                                    </button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </>
                        ) : null}
                        <p className={`pdpx-min${belowMoq ? " is-warn" : ""}`}>
                          {belowMoq ? `${(product.moq - qty).toLocaleString()} more to reach the ${product.moq} piece minimum.` : `${product.moq} piece minimum met.`}
                        </p>
                      </div>
                      );
                    })() : null}
                  </div>
                  </motion.div>
                ) : null}
                </AnimatePresence>
              </div>
            );
          })}
        </div>

        <p className="pdpx-delivered">
          Delivered by {formatDeliveredBy(product.leadTimeDays)}
          <span className="pdpx-delivered-est"> · {formatLeadTime(product.leadTimeDays)} from today, est.</span>
        </p>

        {/* Woven-label upsell — garments only (boxes/packaging don't take labels) */}
        {!isPackaging ? (
          <button type="button" className={`pdpx-woven${wovenLabel ? " is-on" : ""}`} onClick={() => setWovenOpen(true)}>
            {wovenLabel ? (
              <>
                <span className="pdpx-woven-text"><strong>Woven label</strong> · “{wovenLabel.text}”</span>
                <span className="pdpx-woven-edit">Edit</span>
              </>
            ) : (
              <>
                <span className="pdpx-woven-text"><strong>+ Add a woven label</strong>: your brand, sewn in</span>
                <span className="pdpx-woven-price">+{currency(WOVEN_LABEL_ADDER)}/unit</span>
              </>
            )}
          </button>
        ) : null}

        <div className="pdpx-foot">
          <div className="pdpx-breakdown">
            {decoSelected.length > 0 || wovenLabel || extraPlacementCount > 0 ? (
              <>
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
                {extraPlacementCount > 0 ? (
                  <div className="pdpx-breakdown-row pdpx-breakdown-row--adder">
                    <span>+ {extraPlacementCount} extra placement{extraPlacementCount > 1 ? "s" : ""}</span>
                    <span>+{currency(extraPlacementAdder)}</span>
                  </div>
                ) : null}
                {wovenLabel ? (
                  <div className="pdpx-breakdown-row pdpx-breakdown-row--adder">
                    <span>+ Woven label</span>
                    <span>+{currency(WOVEN_LABEL_ADDER)}</span>
                  </div>
                ) : null}
                <div className="pdpx-breakdown-row pdpx-breakdown-row--sum">
                  <span>Per unit · {qty.toLocaleString()} units</span>
                  <span>{currency(perUnit)}</span>
                </div>
              </>
            ) : (
              <div className="pdpx-breakdown-row pdpx-breakdown-row--sum">
                <span>Per unit · {qty.toLocaleString()} units</span>
                <span>{currency(perUnit)}</span>
              </div>
            )}
          </div>
          <div className="pdpx-price">
            <span className="pdpx-from">Subtotal</span>
            <strong className="pdpx-total">{currency(subtotal)}</strong>
          </div>
          <p className="pdpx-final-price-note">
            This is your final price, with decoration, placements and labels included. No quote,
            no revised invoice later.
          </p>
          {effDpi != null && (lowRes || blockRes) ? (
            <p className="pdpx-foot-note" style={{ color: blockRes ? "var(--color-terracotta)" : "var(--color-warning)", fontWeight: 700 }}>
              {blockRes
                ? `Artwork is too low-resolution for this print size (~${effDpi} DPI). Make the print smaller, or upload a higher-res image or vector (SVG/PDF).`
                : `Low resolution at this size (~${effDpi} DPI). It may look soft. A higher-res image or vector prints sharper.`}
            </p>
          ) : null}
          {bundle || editOrder ? ctaButton("pdpx-cta") : null}
          {updateError ? <p className="pdpx-foot-note" style={{ color: "var(--color-terracotta)" }}>{updateError}</p> : null}
          <p className="pdpx-foot-note">
            Every order passes MOA quality control before it ships.
          </p>
        </div>
      </aside>

      {/* The one pinned bar on every screen size: what you picked, price, and the CTA. */}
      <div className="pdpx-bottombar" aria-hidden={false}>
        <div className="pdpx-bottombar-inner">
          <div className="pdpx-bb-cell">
            <span>Style</span>
            <strong>{product.skuCode}</strong>
          </div>
          <div className="pdpx-bb-cell">
            <span>Colour</span>
            <strong>
              <span className="pdpx-bb-dot" style={{ background: variant?.colorHex }} />
              {variant?.colorLabel}
            </strong>
          </div>
          {(use3dPlacement ? place3d.length > 0 && artworkUrl : placement) ? (
            <div className="pdpx-bb-cell pdpx-bb-cell--hide-sm">
              <span>Placement</span>
              <strong>{use3dPlacement ? [...new Set(place3d.map((p) => p.zoneLabel))].join(" + ") : placement?.label}</strong>
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
          {ctaButton("pdpx-bb-cta")}
        </div>
      </div>


      {reviewOpen ? (
        <div className="pdpx-review" role="dialog" aria-modal="true" aria-label="Review your order" onClick={() => setReviewOpen(false)}>
          <div className="pdpx-review-card" onClick={(e) => e.stopPropagation()}>
            <div className="pdpx-review-stage">
              {modelUrl && artworkUrl && place3d.length ? (
                <Garment3DPreviewClient url={modelUrl} hex={variant?.colorHex || "#C9C4B8"} artUrl={artworkUrl} placements={place3d} />
              ) : (
                <ProductShot product={product} variant={variant} view={view} />
              )}
            </div>
            <div className="pdpx-review-spec">
              <p className="pdpx-eyebrow">Review your order</p>
              <h2 className="pdpx-review-title">{product.displayName}</h2>
              <dl className="pdpx-review-list">
                <div><dt>Colour</dt><dd>{variant?.colorLabel}{variant?.colorTcx ? `, ${variant.colorTcx}` : ""}</dd></div>
                {fabricOption ? <div><dt>Fabric</dt><dd>{fabricOption.label}</dd></div> : null}
                {allPlacements.map((pl, i) => (
                  <div key={i}>
                    <dt>{allPlacements.length > 1 ? `Placement ${i + 1}` : "Placement"}</dt>
                    <dd>
                      {pl.zoneLabel}
                      {pl.spec3d ? `: ${pl.spec3d.widthIn} in wide, ${pl.spec3d.belowHpsIn} in below HPS, ${pl.spec3d.horizontal.replace(/"/g, " in")}` : ""}
                    </dd>
                  </div>
                ))}
                <div><dt>Decoration</dt><dd>{decoSelected.map((d) => d.label).join(" and ") || "Our team advises in your proof"}</dd></div>
                {pantones.length ? <div><dt>Inks</dt><dd>{pantones.map((p) => `${p.name} (${p.code})`).join(", ")}</dd></div> : null}
                {wovenLabel ? <div><dt>Woven label</dt><dd>{wovenLabel.text}</dd></div> : null}
                <div><dt>Sizes</dt><dd>{product.sizes.filter((z) => (sizeQty[z] ?? 0) > 0).map((z) => `${z} ${sizeQty[z]}`).join(", ")} ({qty.toLocaleString()} units)</dd></div>
                <div><dt>Per unit</dt><dd>{currency(perUnit)}</dd></div>
                <div><dt>Delivered by</dt><dd>{formatDeliveredBy(product.leadTimeDays)}</dd></div>
              </dl>
              <div className="pdpx-review-total"><span>Subtotal</span><strong>{currency(subtotal)}</strong></div>
              <p className="pdpx-foot-note">This is the spec we produce. Our team checks it and your proof arrives within 24 business hours. Nothing is made until you approve it.</p>
              <div className="pdpx-review-actions">
                <button type="button" className="pdpx-review-back" onClick={() => setReviewOpen(false)}>Edit</button>
                <button type="button" className="pdpx-cta" onClick={() => { setReviewOpen(false); handleAddToCart(); }} disabled={submitting}>Add to order</button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
      <WovenLabelModal
        open={wovenOpen}
        initial={wovenLabel}
        adderUsd={WOVEN_LABEL_ADDER}
        onClose={() => setWovenOpen(false)}
        onSave={(label) => { setWovenLabel(label); setWovenOpen(false); analytics.track("woven_label_added", { slug: product.slug }); }}
        onRemove={() => { setWovenLabel(null); setWovenOpen(false); }}
      />
    </section>
  );
}
