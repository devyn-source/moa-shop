"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { ProductShot } from "./ProductShot";
import { PdpConfigurator, type BundleItemConfig } from "./PdpConfigurator";
import { useCart } from "./CartProvider";
import { analytics } from "@/lib/analytics";
import { buildFullBundleCartLines, packagingUnitPrice, priceFullBundle, type FullBundlePackaging } from "@/lib/bundle";
import { currency, getPriceTier, round2 } from "@/lib/pricing";
import { PR_BOX_PROMO } from "@/lib/promo";
import type { CatalogProduct } from "@/lib/types";

export type InitialComponent = { productId: string };

type BoxItem = { key: string; config: BundleItemConfig };

let seq = 0;
const nextKey = () => `bi-${seq++}-${crypto.randomUUID().slice(0, 8)}`;

function distributeAcross(sizes: string[], total: number): Record<string, number> {
  if (!sizes.length) return {};
  const base = Math.floor(total / sizes.length);
  const rem = total - base * sizes.length;
  return sizes.reduce<Record<string, number>>((acc, s, i) => {
    acc[s] = base + (i < rem ? 1 : 0);
    return acc;
  }, {});
}

// Canonical PROGRAM size run. Each recipient's box is a single size, so the size
// breakdown lives at the box-program level — every sized piece inherits it; one-
// size pieces (caps/totes) just take the full box count.
const BOX_SIZES = ["XS", "S", "M", "L", "XL", "XXL"];

function sumSizes(s: Record<string, number>): number {
  return Object.values(s).reduce((a, b) => a + (b || 0), 0);
}

// Map the program breakdown onto one product's sizes. One-size pieces take the
// full count; sized pieces inherit the run, folding any size they don't offer
// (e.g. a jacket with no XS) into their smallest size so totals still match.
function applyBoxSizes(boxSizes: Record<string, number>, productSizes: string[]): Record<string, number> {
  const total = sumSizes(boxSizes);
  if (productSizes.length <= 1) return { [productSizes[0] ?? "ONE"]: total };
  const out: Record<string, number> = {};
  for (const s of productSizes) out[s] = 0;
  let overflow = 0;
  for (const [size, n] of Object.entries(boxSizes)) {
    if (!n) continue;
    if (size in out) out[size] += n;
    else overflow += n;
  }
  if (overflow) out[productSizes[0]] += overflow;
  return out;
}

// A default (un-customized) configuration — what "add item" / a kit preset drops
// in. The buyer then opens the FULL PDP to customize (color, artwork, decoration);
// the size run is inherited from the program breakdown, not set per piece.
function defaultConfig(p: CatalogProduct, boxSizes: Record<string, number>): BundleItemConfig {
  const variant = p.variants.find((v) => v.isAvailable) ?? p.variants[0];
  const sizeQty = applyBoxSizes(boxSizes, p.sizes);
  const qty = sumSizes(sizeQty);
  const perUnitUsd = getPriceTier(p, Math.max(p.moq, qty)).perUnitUsd;
  return {
    productId: p.id,
    slug: p.slug,
    displayName: p.displayName,
    skuCode: p.skuCode,
    variantId: variant.id,
    colorLabel: variant.colorLabel,
    colorHex: variant.colorHex,
    image: p.greyFront ?? variant.frontImage,
    decorationIds: [],
    decorationLabel: "Undecorated",
    sizeQty,
    quantity: qty,
    perUnitUsd,
    decorationAdderUsd: 0,
    subtotalUsd: round2(perUnitUsd * qty),
    totalUsd: round2(perUnitUsd * qty),
    artworkFileName: "Artwork file pending",
    artworkFileUrl: undefined,
    artworkNotes: "",
    wovenLabel: false,
    seed: { variantId: variant.id, sizeQty, view: "front" }
  };
}

// Re-apply the PROGRAM size breakdown to an item: inherit the run, re-price at
// that volume (keeping its decoration/woven adders).
function rescaleConfig(cfg: BundleItemConfig, p: CatalogProduct | undefined, boxSizes: Record<string, number>): BundleItemConfig {
  if (!p) return cfg;
  const sizeQty = applyBoxSizes(boxSizes, p.sizes);
  const qty = sumSizes(sizeQty);
  const perUnitUsd = getPriceTier(p, Math.max(p.moq, qty)).perUnitUsd;
  return {
    ...cfg,
    sizeQty,
    quantity: qty,
    perUnitUsd,
    subtotalUsd: round2(perUnitUsd * qty),
    totalUsd: round2((perUnitUsd + cfg.decorationAdderUsd) * qty),
    seed: { ...cfg.seed, sizeQty }
  };
}

// Premium easing shared with the global CSS system.
const EASE = [0.22, 1, 0.36, 1] as const;

// Smoothly counts the displayed price to its target — small delight on every change.
function MoneyCount({ value }: { value: number }) {
  const [shown, setShown] = useState(value);
  const ref = useRef(value);
  useEffect(() => {
    const reduce = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const from = ref.current;
    const to = value;
    if (reduce || Math.abs(from - to) < 0.005) {
      ref.current = to;
      setShown(to);
      return;
    }
    const start = performance.now();
    const dur = 420;
    let raf = 0;
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / dur);
      const e = 1 - Math.pow(1 - p, 3); // easeOutCubic
      const v = from + (to - from) * e;
      ref.current = v;
      setShown(v);
      if (p < 1) raf = requestAnimationFrame(tick);
      else {
        ref.current = to;
        setShown(to);
      }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value]);
  return <>{currency(shown)}</>;
}

export function BoxBuilder({
  product,
  eligible,
  packaging,
  initialComponents
}: {
  product: CatalogProduct;
  eligible: CatalogProduct[];
  packaging: CatalogProduct[];
  initialComponents?: InitialComponent[];
}) {
  const router = useRouter();
  const { addBundle } = useCart();
  const promo = PR_BOX_PROMO;

  const eligibleById = useMemo(() => new Map(eligible.map((p) => [p.id, p])), [eligible]);
  const packagingById = useMemo(() => new Map(packaging.map((p) => [p.id, p])), [packaging]);

  // Program-level size breakdown — the single source of truth for every item's
  // size run. boxQty (the box count) is just its total.
  const initialBoxSizes = useMemo(() => distributeAcross(BOX_SIZES, promo.qualify.minBoxes), [promo.qualify.minBoxes]);
  const [boxSizes, setBoxSizes] = useState<Record<string, number>>(initialBoxSizes);
  const boxQty = useMemo(() => sumSizes(boxSizes), [boxSizes]);
  const [items, setItems] = useState<BoxItem[]>(() =>
    (initialComponents ?? [])
      .map((ic) => {
        const p = eligible.find((e) => e.id === ic.productId);
        return p ? { key: nextKey(), config: defaultConfig(p, initialBoxSizes) } : null;
      })
      .filter(Boolean) as BoxItem[]
  );
  // Packaging is configured in the FULL configurator, exactly like garment items
  // (one config per piece; 1 per box). Required pieces (the box) are pre-added.
  const [packItems, setPackItems] = useState<BoxItem[]>(() =>
    packaging.filter((p) => p.packagingRequired).map((p) => ({ key: nextKey(), config: defaultConfig(p, initialBoxSizes) }))
  );
  const [submitting, setSubmitting] = useState(false);
  const [modal, setModal] = useState<{ product: CatalogProduct; seed?: BundleItemConfig["seed"]; editKey?: string } | null>(null);
  const modalRef = useRef<HTMLDivElement>(null);

  // Builder-start — fires once, on the first meaningful interaction (first item
  // added or first config open).
  const builderStartedRef = useRef(false);
  const trackBuilderStart = useCallback(() => {
    if (builderStartedRef.current) return;
    builderStartedRef.current = true;
    analytics.track("box_builder_started", { slug: product.slug, bundle: true });
  }, [product.slug]);

  // Modal a11y — Escape-to-close (mirrors WovenLabelModal) + focus the dialog on
  // open, return focus to the trigger element on close.
  const modalOpen = Boolean(modal);
  useEffect(() => {
    if (!modalOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setModal(null);
    window.addEventListener("keydown", onKey);
    const trigger = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    modalRef.current?.focus();
    return () => {
      window.removeEventListener("keydown", onKey);
      trigger?.focus();
    };
  }, [modalOpen]);

  // --- program size breakdown (re-applies to every item's size run) ---
  const applyProgramSizes = useCallback(
    (next: Record<string, number>) => {
      setBoxSizes(next);
      setItems((prev) => prev.map((it) => ({ ...it, config: rescaleConfig(it.config, eligibleById.get(it.config.productId), next) })));
      setPackItems((prev) => prev.map((it) => ({ ...it, config: rescaleConfig(it.config, packagingById.get(it.config.productId), next) })));
    },
    [eligibleById, packagingById]
  );
  // Total stepper — redistribute evenly across the size set.
  const updateBoxQty = useCallback(
    (n: number) => applyProgramSizes(distributeAcross(BOX_SIZES, Math.max(1, Math.round(n) || 1))),
    [applyProgramSizes]
  );
  // A single size cell.
  const updateBoxSize = useCallback(
    (size: string, n: number) => applyProgramSizes({ ...boxSizes, [size]: Math.max(0, Math.round(n) || 0) }),
    [boxSizes, applyProgramSizes]
  );

  // --- items ---
  const addItem = useCallback(
    (productId: string) => {
      const p = eligibleById.get(productId);
      if (!p) return;
      trackBuilderStart();
      setItems((prev) => [...prev, { key: nextKey(), config: defaultConfig(p, boxSizes) }]);
    },
    [eligibleById, boxSizes, trackBuilderStart]
  );
  const removeItem = useCallback((key: string) => setItems((prev) => prev.filter((it) => it.key !== key)), []);
  const handleModalUse = useCallback(
    (cfg: BundleItemConfig) => {
      const isPack = modal?.product.category === "packaging";
      const setList = isPack ? setPackItems : setItems;
      // Keep the size run program-driven — re-apply the breakdown to the saved config.
      const synced = rescaleConfig(cfg, modal?.product, boxSizes);
      setList((prev) => {
        if (modal?.editKey) return prev.map((it) => (it.key === modal.editKey ? { ...it, config: synced } : it));
        return [...prev, { key: nextKey(), config: synced }];
      });
      setModal(null);
    },
    [modal, boxSizes]
  );

  // --- packaging ---
  // A piece is "branded" once the customer has placed artwork in the configurator
  // (non-printable pieces are always plain). The print upcharge applies when branded.
  const packBrandedOf = useCallback(
    (cfg: BundleItemConfig, p: CatalogProduct) => p.printable !== false && Boolean(cfg.artworkFileUrl),
    []
  );
  const addPackaging = useCallback(
    (id: string) => {
      const p = packagingById.get(id);
      if (!p) return;
      trackBuilderStart();
      setPackItems((prev) => (prev.some((it) => it.config.productId === id) ? prev : [...prev, { key: nextKey(), config: defaultConfig(p, boxSizes) }]));
    },
    [packagingById, boxSizes, trackBuilderStart]
  );
  const removePackaging = useCallback(
    (key: string) => {
      setPackItems((prev) => prev.filter((it) => it.key !== key || packagingById.get(it.config.productId)?.packagingRequired));
    },
    [packagingById]
  );

  const selectedPackaging = useMemo(
    () =>
      packItems
        .map((it) => {
          const p = packagingById.get(it.config.productId);
          return p ? { product: p, branded: packBrandedOf(it.config, p), finishAdderUsd: it.config.decorationAdderUsd } : null;
        })
        .filter(Boolean) as { product: CatalogProduct; branded: boolean; finishAdderUsd?: number }[],
    [packItems, packagingById, packBrandedOf]
  );

  const price = useMemo(
    () => priceFullBundle(items.map((i) => i.config), selectedPackaging, boxQty, promo),
    [items, selectedPackaging, boxQty, promo]
  );

  const canAdd = items.length > 0 && selectedPackaging.length > 0 && boxQty >= promo.qualify.minBoxes && !submitting;

  const handleAdd = useCallback(() => {
    if (!canAdd) return;
    setSubmitting(true);
    const { lines } = buildFullBundleCartLines({
      bundleId: crypto.randomUUID(),
      bundleLabel: "PR Box",
      items: items.map((i) => i.config),
      packaging: packItems
        .map((it) => {
          const p = packagingById.get(it.config.productId);
          if (!p) return null;
          const c = it.config;
          const branded = packBrandedOf(c, p);
          return { product: p, branded, artworkFileName: c.artworkFileName, artworkFileUrl: c.artworkFileUrl, artworkNotes: c.artworkNotes, variantId: c.variantId, colorLabel: c.colorLabel, colorHex: c.colorHex, finishAdderUsd: c.decorationAdderUsd, finishLabel: branded && c.decorationLabel && c.decorationLabel !== "Undecorated" ? c.decorationLabel : undefined, decorationIds: c.decorationIds };
        })
        .filter(Boolean) as FullBundlePackaging[],
      boxQty,
      promo
    });
    analytics.addToCart({
      slug: product.slug, name: "PR Box", category: "bundle", bundle: true,
      boxes: boxQty, items: items.length, packaging: packItems.length,
      quantity: boxQty, value: round2(price.totalUsd),
    });
    addBundle(lines);
    router.push("/cart");
  }, [canAdd, items, packItems, packagingById, packBrandedOf, boxQty, promo, addBundle, router, product.slug, price.totalUsd]);

  return (
    <div className="boxbuilder">
      <div className="boxbuilder-main">
        <header className="boxbuilder-head">
          <p className="eyebrow">{promo.label}</p>
          <h1>{product.displayName}</h1>
          <p className="boxbuilder-sub">{product.description}</p>
        </header>

        {/* contents — each item is configured in the FULL product configurator */}
        <section className="bb-section">
          <div className="bb-section-head">
            <h2>Box contents</h2>
            <span className="label">{items.length} item{items.length === 1 ? "" : "s"}</span>
          </div>

          {items.length === 0 ? (
            <p className="bb-empty">Add items below, then customize each in the full configurator.</p>
          ) : (
            <ul className="bb-summaries">
              <AnimatePresence initial={false} mode="popLayout">
                {items.map((it) => {
                  const cfg = it.config;
                  const p = eligibleById.get(cfg.productId);
                  const variant = p?.variants.find((v) => v.id === cfg.variantId) ?? p?.variants[0];
                  return (
                    <motion.li
                      className="bb-summary"
                      key={it.key}
                      layout
                      initial={{ opacity: 0, y: 10, scale: 0.98 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.96, transition: { duration: 0.18, ease: EASE } }}
                      transition={{ duration: 0.34, ease: EASE }}
                    >
                      <div className="bb-summary-shot">
                        {p ? <ProductShot product={p} variant={variant} view="front" /> : null}
                      </div>
                      <div className="bb-summary-body">
                        <div className="bb-summary-top">
                          <h3>{cfg.displayName}</h3>
                          <button type="button" className="cart-remove" aria-label="Remove item" onClick={() => removeItem(it.key)}>✕</button>
                        </div>
                        <p className="bb-summary-meta">
                          {cfg.colorLabel} · {cfg.decorationLabel} · {cfg.quantity.toLocaleString()} units
                          {cfg.artworkFileUrl ? " · artwork ✓" : ""}
                          {cfg.wovenLabel ? " · woven label" : ""}
                        </p>
                        <div className="bb-summary-foot">
                          <button type="button" className="bb-customize" onClick={() => { if (!p) return; trackBuilderStart(); setModal({ product: p, seed: cfg.seed, editKey: it.key }); }}>
                            Customize in full configurator →
                          </button>
                          <span className="bb-summary-price">
                            <MoneyCount value={cfg.totalUsd} />
                          </span>
                        </div>
                      </div>
                    </motion.li>
                  );
                })}
              </AnimatePresence>
            </ul>
          )}
        </section>

        {/* add items */}
        <section className="bb-section">
          <div className="bb-section-head"><h2>Add items</h2></div>
          <div className="bb-picker">
            {eligible.map((p) => (
              <button type="button" key={p.id} className="bb-pick" onClick={() => addItem(p.id)}>
                <span className="bb-pick-shot"><ProductShot product={p} variant={p.variants[0]} view="front" /></span>
                <span className="bb-pick-name">{p.displayName}</span>
                <span className="bb-pick-add" aria-hidden>+</span>
              </button>
            ))}
          </div>
        </section>

        {/* packaging — each branded piece is customizable */}
        <section className="bb-section">
          <div className="bb-section-head">
            <h2>Packaging</h2>
            <span className="label">Configure each piece</span>
          </div>
          <ul className="bb-summaries">
            <AnimatePresence initial={false} mode="popLayout">
            {packItems.map((it) => {
              const cfg = it.config;
              const p = packagingById.get(cfg.productId);
              if (!p) return null;
              const required = Boolean(p.packagingRequired);
              const printable = p.printable !== false;
              const branded = packBrandedOf(cfg, p);
              const finishAdder = branded ? (cfg.decorationAdderUsd ?? 0) : 0;
              const finishLabel = branded && cfg.decorationLabel && cfg.decorationLabel !== "Undecorated" ? cfg.decorationLabel : null;
              const unit = round2(packagingUnitPrice(p, boxQty, branded).perUnitUsd + finishAdder);
              return (
                <motion.li
                  className="bb-summary"
                  key={it.key}
                  layout
                  initial={{ opacity: 0, y: 10, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.96, transition: { duration: 0.18, ease: EASE } }}
                  transition={{ duration: 0.34, ease: EASE }}
                >
                  <div className="bb-summary-shot"><ProductShot product={p} variant={p.variants[0]} view="front" /></div>
                  <div className="bb-summary-body">
                    <div className="bb-summary-top">
                      <h3>{p.displayName}{required ? <span className="bb-pack-req"> · included</span> : null}</h3>
                      {required ? null : <button type="button" className="cart-remove" aria-label="Remove packaging" onClick={() => removePackaging(it.key)}>✕</button>}
                    </div>
                    <p className="bb-summary-meta">
                      {p.variants.length > 1 ? `${cfg.colorLabel} · ` : ""}
                      {!printable ? "Plain — not printed" : branded ? "Branded · artwork ✓" : "Blank — no print"}
                      {finishLabel ? ` · ${finishLabel}` : ""}
                      {` · ${currency(unit)}/box`}
                    </p>
                    <div className="bb-summary-foot">
                      {printable ? (
                        <button type="button" className="bb-customize" onClick={() => { trackBuilderStart(); setModal({ product: p, seed: cfg.seed, editKey: it.key }); }}>
                          {branded ? "Edit in full configurator →" : "Add branding in configurator →"}
                        </button>
                      ) : <span className="bb-art-status">Always plain</span>}
                      <span className="bb-summary-price">{currency(round2(unit * boxQty))}</span>
                    </div>
                  </div>
                </motion.li>
              );
            })}
            </AnimatePresence>
          </ul>
          {packaging.some((a) => !packItems.some((it) => it.config.productId === a.id)) ? (
            <div className="bb-pack-add">
              <span className="bb-field-label">Add packaging</span>
              <div className="bb-chips">
                {packaging.filter((a) => !packItems.some((it) => it.config.productId === a.id)).map((asset) => (
                  <button type="button" key={asset.id} className="bb-chip" onClick={() => addPackaging(asset.id)}>
                    + {asset.displayName} <b>{currency(getPriceTier(asset, boxQty).perUnitUsd)}/box</b>
                  </button>
                ))}
              </div>
            </div>
          ) : null}
        </section>
      </div>

      {/* sticky summary */}
      <aside className="boxbuilder-summary panel">
        <div className="bb-summary-pad">
          <p className="eyebrow">Your PR Box</p>

          <div className="bb-qty">
            <span className="bb-field-label">Boxes</span>
            <div className="bb-stepper">
              <button type="button" aria-label="Fewer boxes" onClick={() => updateBoxQty(boxQty - 10)}>−</button>
              <input type="number" min={1} value={boxQty} onChange={(e) => updateBoxQty(Number(e.target.value) || 1)} />
              <button type="button" aria-label="More boxes" onClick={() => updateBoxQty(boxQty + 10)}>+</button>
            </div>
          </div>
          <div className="bb-sizes">
            <span className="bb-field-label">Size breakdown</span>
            <div className="bb-size-grid">
              {BOX_SIZES.map((s) => (
                <label className="bb-size-cell" key={s}>
                  <span className="bb-size-name">{s}</span>
                  <input
                    type="number"
                    min={0}
                    value={boxSizes[s] ?? 0}
                    onChange={(e) => updateBoxSize(s, Number(e.target.value) || 0)}
                    aria-label={`${s} boxes`}
                  />
                </label>
              ))}
            </div>
          </div>
          <p className="bb-moq-note">
            {boxQty < promo.qualify.minBoxes
              ? `Minimum ${promo.qualify.minBoxes} boxes — add ${promo.qualify.minBoxes - boxQty} more.`
              : `${boxQty.toLocaleString()} boxes · every item produced in this size run (caps & totes one-size).`}
          </p>

          <div className="bb-breakdown">
            {items.length === 0 && selectedPackaging.length === 0 ? (
              <p className="bb-empty">Add items and packaging.</p>
            ) : (
              <>
                {items.map((it) => (
                  <div className="price-line" key={it.key}>
                    <span>{it.config.displayName}</span>
                    <strong>{currency(it.config.totalUsd)}</strong>
                  </div>
                ))}
                {price.packagingLines.map((l) => (
                  <div className="price-line" key={l.product.id}>
                    <span>{l.product.displayName} ×{boxQty.toLocaleString()}</span>
                    <strong>{currency(l.totalUsd)}</strong>
                  </div>
                ))}
              </>
            )}
          </div>

          <div className="price-line bb-subtotal"><span>Subtotal</span><strong><MoneyCount value={price.grossUsd} /></strong></div>
          <AnimatePresence initial={false} mode="wait">
            {price.qualifies ? (
              <motion.div
                key="discount"
                className="price-line bb-discount"
                initial={{ opacity: 0, height: 0, marginTop: 0 }}
                animate={{ opacity: 1, height: "auto", marginTop: 0 }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.28, ease: EASE }}
              >
                <span>Bundle discount ({Math.round(price.percent * 100)}%)</span>
                <strong>−<MoneyCount value={price.discountUsd} /></strong>
              </motion.div>
            ) : items.length > 0 ? (
              <motion.div
                key="unmet"
                className="bb-unmet"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.28, ease: EASE }}
              >
                <span className="bb-unmet-title">Unlock {Math.round(promo.discount.value * 100)}% off:</span>
                <ul>{price.unmetReasons.map((r) => <li key={r}>{r}</li>)}</ul>
              </motion.div>
            ) : null}
          </AnimatePresence>

          <div className="price-total-big bb-box-total">
            <span className="from-label">Program total</span>
            <motion.span
              key={price.qualifies ? "q" : "n"}
              className="price-total-num"
              initial={{ scale: 0.96 }}
              animate={{ scale: 1 }}
              transition={{ duration: 0.3, ease: EASE }}
            >
              <MoneyCount value={price.totalUsd} />
            </motion.span>
            <span className="price-total-sub">{boxQty.toLocaleString()} boxes · {items.length} item{items.length === 1 ? "" : "s"} each</span>
          </div>

          <button type="button" className="button button--lg button--full" disabled={!canAdd} onClick={handleAdd} style={{ marginTop: 12 }}>
            {submitting ? "Adding…" : "Add box to cart →"}
          </button>
          <p className="trust-note">Each item + packaging becomes a production line under one PR Box. Customize any item in the full configurator.</p>
        </div>
      </aside>

      {/* full PDP configurator modal */}
      <AnimatePresence>
        {modal ? (
          <motion.div
            className="bb-modal-overlay"
            role="dialog"
            aria-modal="true"
            aria-label={`Configure ${modal.product.displayName}`}
            onClick={() => setModal(null)}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.22, ease: EASE }}
          >
            <motion.div
              ref={modalRef}
              tabIndex={-1}
              className="bb-modal"
              onClick={(e) => e.stopPropagation()}
              initial={{ opacity: 0, y: 18, scale: 0.975 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.985 }}
              transition={{ duration: 0.36, ease: EASE }}
            >
              <div className="bb-modal-head">
                <span className="bb-modal-title">Configure · {modal.product.displayName}</span>
                <button type="button" className="bb-modal-x" aria-label="Close" onClick={() => setModal(null)}>✕</button>
              </div>
              <div className="bb-modal-body">
                <PdpConfigurator
                  product={modal.product}
                  seed={modal.seed}
                  bundle={{ boxQty, editing: Boolean(modal.editKey), onUse: handleModalUse, onCancel: () => setModal(null) }}
                />
              </div>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
