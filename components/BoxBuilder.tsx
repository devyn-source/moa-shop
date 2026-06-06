"use client";

import { useCallback, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ProductShot } from "./ProductShot";
import { PdpConfigurator, type BundleItemConfig } from "./PdpConfigurator";
import { useCart } from "./CartProvider";
import { buildFullBundleCartLines, priceFullBundle } from "@/lib/bundle";
import { currency, getPriceTier, round2 } from "@/lib/pricing";
import { PR_BOX_PROMO } from "@/lib/promo";
import type { CatalogProduct } from "@/lib/types";

export type InitialComponent = { productId: string };

type BoxItem = { key: string; config: BundleItemConfig };

type PackArt = {
  artworkFileName?: string;
  artworkFileUrl?: string;
  uploading?: boolean;
  uploadError?: string;
  notes?: string;
};

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
  const [packagingIds, setPackagingIds] = useState<string[]>(() =>
    packaging.filter((p) => p.packagingRequired).map((p) => p.id)
  );
  const [packArt, setPackArt] = useState<Record<string, PackArt>>({});
  const [submitting, setSubmitting] = useState(false);
  const [modal, setModal] = useState<{ product: CatalogProduct; seed?: BundleItemConfig["seed"]; editKey?: string } | null>(null);

  // --- program size (rescales every item's size run) ---
  const updateBoxQty = useCallback(
    (n: number) => {
      const q = Math.max(1, Math.round(n) || 1);
      setBoxQty(q);
      setItems((prev) => prev.map((it) => ({ ...it, config: rescaleConfig(it.config, eligibleById.get(it.config.productId), q) })));
    },
    [eligibleById]
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
      setItems((prev) => {
        if (modal?.editKey) return prev.map((it) => (it.key === modal.editKey ? { ...it, config: cfg } : it));
        return [...prev, { key: nextKey(), config: cfg }];
      });
      setModal(null);
    },
    [modal]
  );

  // --- packaging ---
  const togglePackaging = useCallback(
    (id: string) => {
      if (packagingById.get(id)?.packagingRequired) return;
      setPackagingIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
    },
    [packagingById]
  );
  const updatePackArt = useCallback((id: string, patch: Partial<PackArt>) => {
    setPackArt((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } }));
  }, []);
  const uploadPackArt = useCallback(
    async (id: string, file: File | undefined | null) => {
      if (!file) return;
      updatePackArt(id, { uploading: true, uploadError: undefined, artworkFileName: file.name });
      try {
        const fd = new FormData();
        fd.append("file", file);
        const res = await fetch("/api/upload-artwork", { method: "POST", body: fd });
        const data = (await res.json()) as { url?: string; error?: string };
        if (!res.ok || !data.url) throw new Error(data.error || "Upload failed");
        updatePackArt(id, { uploading: false, artworkFileUrl: data.url });
      } catch (err) {
        updatePackArt(id, { uploading: false, artworkFileUrl: undefined, uploadError: err instanceof Error ? err.message : "Upload failed" });
      }
    },
    [updatePackArt]
  );

  const selectedPackaging = useMemo(
    () => packagingIds.map((id) => packagingById.get(id)).filter(Boolean) as CatalogProduct[],
    [packagingIds, packagingById]
  );

  const price = useMemo(
    () => priceFullBundle(items.map((i) => i.config), selectedPackaging, boxQty, promo),
    [items, selectedPackaging, boxQty, promo]
  );

  const canAdd = items.length > 0 && selectedPackaging.length > 0 && !submitting;
  const packagingUploading = Object.values(packArt).some((a) => a?.uploading);

  const handleAdd = useCallback(() => {
    if (!canAdd) return;
    setSubmitting(true);
    const { lines } = buildFullBundleCartLines({
      bundleId: crypto.randomUUID(),
      bundleLabel: "PR Box",
      items: items.map((i) => i.config),
      packaging: packagingIds
        .map((id) => {
          const p = packagingById.get(id);
          if (!p) return null;
          const a = packArt[id];
          return { product: p, artworkFileName: a?.artworkFileName, artworkFileUrl: a?.artworkFileUrl, artworkNotes: a?.notes };
        })
        .filter(Boolean) as { product: CatalogProduct }[],
      boxQty,
      promo
    });
    addBundle(lines);
    router.push("/cart");
  }, [canAdd, items, packagingIds, packArt, packagingById, boxQty, promo, addBundle, router]);

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
              {items.map((it) => {
                const cfg = it.config;
                const p = eligibleById.get(cfg.productId);
                const variant = p?.variants.find((v) => v.id === cfg.variantId) ?? p?.variants[0];
                return (
                  <li className="bb-summary" key={it.key}>
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
                        <span className="bb-summary-price">{currency(cfg.totalUsd)}</span>
                      </div>
                    </div>
                  </li>
                );
              })}
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
            <span className="label">Customize each branded piece</span>
          </div>
          <ul className="bb-items">
            {packagingIds.map((id) => {
              const asset = packagingById.get(id);
              if (!asset) return null;
              const art = packArt[id];
              const required = Boolean(asset.packagingRequired);
              const tier = getPriceTier(asset, boxQty);
              return (
                <li className="bb-item" key={id}>
                  <div className="bb-item-shot"><ProductShot product={asset} variant={asset.variants[0]} view="front" /></div>
                  <div className="bb-item-body">
                    <div className="bb-item-top">
                      <h3>{asset.displayName}{required ? <span className="bb-pack-req"> · included</span> : null}</h3>
                      {required ? null : <button type="button" className="cart-remove" aria-label="Remove packaging" onClick={() => togglePackaging(id)}>✕</button>}
                    </div>
                    <div className="bb-field bb-field--row">
                      <label className="bb-mini bb-mini--art">
                        <span className="bb-field-label">Artwork / branding</span>
                        <input type="file" accept="image/*,.pdf,.ai,.eps,.svg" onChange={(e) => uploadPackArt(id, e.target.files?.[0])} />
                      </label>
                      <label className="bb-mini bb-mini--notes">
                        <span className="bb-field-label">Notes</span>
                        <input type="text" placeholder="e.g. logo centered, gold foil" value={art?.notes ?? ""} onChange={(e) => updatePackArt(id, { notes: e.target.value })} />
                      </label>
                    </div>
                    <div className="bb-item-foot">
                      <span className="bb-art-status">
                        {art?.uploading ? "Uploading artwork…" : art?.uploadError ? `⚠ ${art.uploadError}` : art?.artworkFileUrl ? `✓ ${art.artworkFileName}` : "No artwork yet (optional now)"}
                      </span>
                      <span className="bb-item-price"><b>{currency(tier.perUnitUsd)}/box</b></span>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
          {packaging.some((a) => !packagingIds.includes(a.id)) ? (
            <div className="bb-pack-add">
              <span className="bb-field-label">Add packaging</span>
              <div className="bb-chips">
                {packaging.filter((a) => !packagingIds.includes(a.id)).map((asset) => (
                  <button type="button" key={asset.id} className="bb-chip" onClick={() => togglePackaging(asset.id)}>
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

          <div className="price-line bb-subtotal"><span>Subtotal</span><strong>{currency(price.grossUsd)}</strong></div>
          {price.qualifies ? (
            <div className="price-line bb-discount"><span>Bundle discount ({Math.round(price.percent * 100)}%)</span><strong>−{currency(price.discountUsd)}</strong></div>
          ) : items.length > 0 ? (
            <div className="bb-unmet">
              <span className="bb-unmet-title">Unlock {Math.round(promo.discount.value * 100)}% off:</span>
              <ul>{price.unmetReasons.map((r) => <li key={r}>{r}</li>)}</ul>
            </div>
          ) : null}

          <div className="price-total-big bb-box-total">
            <span className="from-label">Program total</span>
            <span className="price-total-num">{currency(price.totalUsd)}</span>
            <span className="price-total-sub">{boxQty.toLocaleString()} boxes · {items.length} item{items.length === 1 ? "" : "s"} each</span>
          </div>

          <button type="button" className="button button--lg button--full" disabled={!canAdd} onClick={handleAdd} style={{ marginTop: 12 }}>
            {packagingUploading ? "Uploading…" : submitting ? "Adding…" : "Add box to cart →"}
          </button>
          <p className="trust-note">Each item + packaging becomes a production line under one PR Box. Customize any item in the full configurator.</p>
        </div>
      </aside>

      {/* full PDP configurator modal */}
      {modal ? (
        <div className="bb-modal-overlay" role="dialog" aria-modal="true" onClick={() => setModal(null)}>
          <div className="bb-modal" onClick={(e) => e.stopPropagation()}>
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
          </div>
        </div>
      ) : null}
    </div>
  );
}
