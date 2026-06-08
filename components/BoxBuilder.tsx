"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { ProductShot } from "./ProductShot";
import { PdpConfigurator, type BundleItemConfig } from "./PdpConfigurator";
import { useCart } from "./CartProvider";
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

// A default (un-customized) configuration — what "add item" / a kit preset drops
// in. The buyer then opens the FULL PDP to customize (color, artwork placement,
// decoration, size run, woven label, …).
function defaultConfig(p: CatalogProduct, boxQty: number): BundleItemConfig {
  const variant = p.variants.find((v) => v.isAvailable) ?? p.variants[0];
  const qty = Math.max(p.moq, boxQty);
  const sizeQty = distributeAcross(p.sizes, qty);
  const perUnitUsd = getPriceTier(p, qty).perUnitUsd;
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

// Re-scale an item to a new program size: redistribute its size run to total the
// new box qty, re-price at that volume (keeping its decoration/woven adders).
function rescaleConfig(cfg: BundleItemConfig, p: CatalogProduct | undefined, newQty: number): BundleItemConfig {
  if (!p) return cfg;
  const qty = Math.max(p.moq, newQty);
  const sizes = p.sizes.length ? p.sizes : Object.keys(cfg.sizeQty);
  const sizeQty = distributeAcross(sizes, qty);
  const perUnitUsd = getPriceTier(p, qty).perUnitUsd;
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

  const [boxQty, setBoxQty] = useState<number>(promo.qualify.minBoxes);
  const [items, setItems] = useState<BoxItem[]>(() =>
    (initialComponents ?? [])
      .map((ic) => {
        const p = eligible.find((e) => e.id === ic.productId);
        return p ? { key: nextKey(), config: defaultConfig(p, promo.qualify.minBoxes) } : null;
      })
      .filter(Boolean) as BoxItem[]
  );
  // Packaging is configured in the FULL configurator, exactly like garment items
  // (one config per piece; 1 per box). Required pieces (the box) are pre-added.
  const [packItems, setPackItems] = useState<BoxItem[]>(() =>
    packaging.filter((p) => p.packagingRequired).map((p) => ({ key: nextKey(), config: defaultConfig(p, promo.qualify.minBoxes) }))
  );
  const [submitting, setSubmitting] = useState(false);
  const [modal, setModal] = useState<{ product: CatalogProduct; seed?: BundleItemConfig["seed"]; editKey?: string } | null>(null);

  // --- program size (rescales every item's size run) ---
  const updateBoxQty = useCallback(
    (n: number) => {
      const q = Math.max(1, Math.round(n) || 1);
      setBoxQty(q);
      setItems((prev) => prev.map((it) => ({ ...it, config: rescaleConfig(it.config, eligibleById.get(it.config.productId), q) })));
      setPackItems((prev) => prev.map((it) => ({ ...it, config: rescaleConfig(it.config, packagingById.get(it.config.productId), q) })));
    },
    [eligibleById, packagingById]
  );

  // --- items ---
  const addItem = useCallback(
    (productId: string) => {
      const p = eligibleById.get(productId);
      if (!p) return;
      setItems((prev) => [...prev, { key: nextKey(), config: defaultConfig(p, boxQty) }]);
    },
    [eligibleById, boxQty]
  );
  const removeItem = useCallback((key: string) => setItems((prev) => prev.filter((it) => it.key !== key)), []);
  const handleModalUse = useCallback(
    (cfg: BundleItemConfig) => {
      const setList = modal?.product.category === "packaging" ? setPackItems : setItems;
      setList((prev) => {
        if (modal?.editKey) return prev.map((it) => (it.key === modal.editKey ? { ...it, config: cfg } : it));
        return [...prev, { key: nextKey(), config: cfg }];
      });
      setModal(null);
    },
    [modal]
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
      setPackItems((prev) => (prev.some((it) => it.config.productId === id) ? prev : [...prev, { key: nextKey(), config: defaultConfig(p, boxQty) }]));
    },
    [packagingById, boxQty]
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
          return p ? { product: p, branded: packBrandedOf(it.config, p) } : null;
        })
        .filter(Boolean) as { product: CatalogProduct; branded: boolean }[],
    [packItems, packagingById, packBrandedOf]
  );

  const price = useMemo(
    () => priceFullBundle(items.map((i) => i.config), selectedPackaging, boxQty, promo),
    [items, selectedPackaging, boxQty, promo]
  );

  const canAdd = items.length > 0 && selectedPackaging.length > 0 && !submitting;

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
          return { product: p, branded: packBrandedOf(c, p), artworkFileName: c.artworkFileName, artworkFileUrl: c.artworkFileUrl, artworkNotes: c.artworkNotes, variantId: c.variantId, colorLabel: c.colorLabel, colorHex: c.colorHex };
        })
        .filter(Boolean) as FullBundlePackaging[],
      boxQty,
      promo
    });
    addBundle(lines);
    router.push("/cart");
  }, [canAdd, items, packItems, packagingById, packBrandedOf, boxQty, promo, addBundle, router]);

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
                          <button type="button" className="bb-customize" onClick={() => p && setModal({ product: p, seed: cfg.seed, editKey: it.key })}>
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
              const unit = packagingUnitPrice(p, boxQty, branded).perUnitUsd;
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
                      {` · ${currency(unit)}/box`}
                    </p>
                    <div className="bb-summary-foot">
                      {printable ? (
                        <button type="button" className="bb-customize" onClick={() => setModal({ product: p, seed: cfg.seed, editKey: it.key })}>
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
          <p className="bb-moq-note">One of each item per box · each item&apos;s size run totals {boxQty.toLocaleString()}.</p>

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
            onClick={() => setModal(null)}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.22, ease: EASE }}
          >
            <motion.div
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
