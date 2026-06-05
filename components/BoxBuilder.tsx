"use client";

import { useCallback, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ProductShot } from "./ProductShot";
import { useCart } from "./CartProvider";
import { buildBundleCartLines } from "@/lib/bundle";
import { calculateBundlePrice, currency } from "@/lib/pricing";
import { PR_BOX_PROMO } from "@/lib/promo";
import type { CatalogProduct, CatalogVariant, DecorationMethod } from "@/lib/types";

type ComponentDraft = {
  key: string;
  productId: string;
  variantId: string;
  decorationIds: DecorationMethod[];
  perBoxQty: number;
  size: string;
  artworkFileName?: string;
  artworkFileUrl?: string;
  uploading?: boolean;
  uploadError?: string;
};

let draftSeq = 0;
const nextKey = () => `draft-${draftSeq++}-${crypto.randomUUID().slice(0, 8)}`;

export function BoxBuilder({
  product,
  eligible,
  packaging
}: {
  product: CatalogProduct;
  eligible: CatalogProduct[];
  packaging: CatalogProduct[];
}) {
  const router = useRouter();
  const { addBundle } = useCart();
  const promo = PR_BOX_PROMO;

  const eligibleById = useMemo(() => new Map(eligible.map((p) => [p.id, p])), [eligible]);
  const packagingById = useMemo(() => new Map(packaging.map((p) => [p.id, p])), [packaging]);

  const [components, setComponents] = useState<ComponentDraft[]>([]);
  const [packagingIds, setPackagingIds] = useState<string[]>(() =>
    packaging.filter((p) => p.packagingRequired).map((p) => p.id)
  );
  const [boxQty, setBoxQty] = useState<number>(promo.qualify.minBoxes);
  const [submitting, setSubmitting] = useState(false);

  const addComponent = useCallback(
    (productId: string) => {
      const p = eligibleById.get(productId);
      if (!p) return;
      const variant = p.variants.find((v) => v.isAvailable) ?? p.variants[0];
      const midSize = p.sizes[Math.floor(p.sizes.length / 2)] ?? p.sizes[0] ?? "ONE";
      setComponents((prev) => [
        ...prev,
        { key: nextKey(), productId, variantId: variant.id, decorationIds: [], perBoxQty: 1, size: midSize }
      ]);
    },
    [eligibleById]
  );

  const updateComponent = useCallback((key: string, patch: Partial<ComponentDraft>) => {
    setComponents((prev) => prev.map((d) => (d.key === key ? { ...d, ...patch } : d)));
  }, []);

  const removeComponent = useCallback((key: string) => {
    setComponents((prev) => prev.filter((d) => d.key !== key));
  }, []);

  const togglePackaging = useCallback(
    (id: string) => {
      const asset = packagingById.get(id);
      if (asset?.packagingRequired) return; // the box itself can't be removed
      setPackagingIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
    },
    [packagingById]
  );

  const uploadArtwork = useCallback(
    async (key: string, file: File | undefined | null) => {
      if (!file) return;
      updateComponent(key, { uploading: true, uploadError: undefined, artworkFileName: file.name });
      try {
        const fd = new FormData();
        fd.append("file", file);
        const res = await fetch("/api/upload-artwork", { method: "POST", body: fd });
        const data = (await res.json()) as { url?: string; error?: string };
        if (!res.ok || !data.url) throw new Error(data.error || "Upload failed");
        updateComponent(key, { uploading: false, artworkFileUrl: data.url });
      } catch (err) {
        updateComponent(key, {
          uploading: false,
          artworkFileUrl: undefined,
          uploadError: err instanceof Error ? err.message : "Upload failed"
        });
      }
    },
    [updateComponent]
  );

  // Resolve drafts -> priced inputs (skip anything whose product vanished).
  const resolved = useMemo(() => {
    const comps = components
      .map((d) => {
        const p = eligibleById.get(d.productId);
        const variant = p?.variants.find((v) => v.id === d.variantId) ?? p?.variants[0];
        return p && variant ? { draft: d, product: p, variant } : null;
      })
      .filter(Boolean) as { draft: ComponentDraft; product: CatalogProduct; variant: CatalogVariant }[];
    const packs = packagingIds.map((id) => packagingById.get(id)).filter(Boolean) as CatalogProduct[];
    return { comps, packs };
  }, [components, packagingIds, eligibleById, packagingById]);

  const price = useMemo(
    () =>
      calculateBundlePrice(
        resolved.comps.map((c) => ({ product: c.product, decorationIds: c.draft.decorationIds, perBoxQty: c.draft.perBoxQty })),
        resolved.packs.map((p) => ({ product: p, perBoxQty: 1 })),
        boxQty,
        promo
      ),
    [resolved, boxQty, promo]
  );

  const canAdd = resolved.comps.length > 0 && resolved.packs.length > 0 && !submitting;
  const uploading = components.some((d) => d.uploading);

  const handleAdd = useCallback(() => {
    if (!canAdd) return;
    setSubmitting(true);
    const { lines } = buildBundleCartLines({
      bundleId: crypto.randomUUID(),
      bundleLabel: "PR Box",
      components: resolved.comps.map((c) => ({
        product: c.product,
        variant: c.variant,
        decorationIds: c.draft.decorationIds,
        perBoxQty: c.draft.perBoxQty,
        size: c.draft.size,
        artworkFileName: c.draft.artworkFileName,
        artworkFileUrl: c.draft.artworkFileUrl
      })),
      packaging: resolved.packs.map((p) => ({ product: p, perBoxQty: 1 })),
      boxQty: price.normalizedBoxQty,
      promo
    });
    addBundle(lines);
    router.push("/cart");
  }, [canAdd, resolved, price.normalizedBoxQty, promo, addBundle, router]);

  const lineByProduct = useMemo(() => new Map(price.lines.map((l) => [l.productId, l])), [price.lines]);

  return (
    <div className="boxbuilder">
      {/* ---------------- build column ---------------- */}
      <div className="boxbuilder-main">
        <header className="boxbuilder-head">
          <p className="eyebrow">{promo.label}</p>
          <h1>{product.displayName}</h1>
          <p className="boxbuilder-sub">{product.description}</p>
        </header>

        {/* contents */}
        <section className="bb-section">
          <div className="bb-section-head">
            <h2>Box contents</h2>
            <span className="label">{resolved.comps.length} item{resolved.comps.length === 1 ? "" : "s"}</span>
          </div>

          {components.length === 0 ? (
            <p className="bb-empty">Add items from the catalog below to start building your box.</p>
          ) : (
            <ul className="bb-items">
              {components.map((d) => {
                const p = eligibleById.get(d.productId);
                if (!p) return null;
                const variant = p.variants.find((v) => v.id === d.variantId) ?? p.variants[0];
                const line = lineByProduct.get(p.id);
                return (
                  <li className="bb-item" key={d.key}>
                    <div className="bb-item-shot">
                      <ProductShot product={p} variant={variant} view="front" />
                    </div>
                    <div className="bb-item-body">
                      <div className="bb-item-top">
                        <h3>{p.displayName}</h3>
                        <button type="button" className="cart-remove" aria-label="Remove item" onClick={() => removeComponent(d.key)}>✕</button>
                      </div>

                      {/* color */}
                      <div className="bb-field">
                        <span className="bb-field-label">Color</span>
                        <div className="bb-swatches">
                          {p.variants.map((v) => (
                            <button
                              key={v.id}
                              type="button"
                              className={`bb-swatch${v.id === d.variantId ? " bb-swatch--on" : ""}`}
                              style={{ background: v.colorHex }}
                              title={v.colorLabel}
                              aria-label={v.colorLabel}
                              aria-pressed={v.id === d.variantId}
                              onClick={() => updateComponent(d.key, { variantId: v.id })}
                            />
                          ))}
                          <span className="bb-color-name">{variant?.colorLabel}</span>
                        </div>
                      </div>

                      {/* decoration */}
                      {p.decorations.length > 0 ? (
                        <div className="bb-field">
                          <span className="bb-field-label">Decoration</span>
                          <div className="bb-chips">
                            {p.decorations.map((deco) => {
                              const on = d.decorationIds.includes(deco.id);
                              return (
                                <button
                                  key={deco.id}
                                  type="button"
                                  className={`bb-chip${on ? " bb-chip--on" : ""}`}
                                  aria-pressed={on}
                                  onClick={() =>
                                    updateComponent(d.key, {
                                      decorationIds: on
                                        ? d.decorationIds.filter((x) => x !== deco.id)
                                        : [...d.decorationIds, deco.id]
                                    })
                                  }
                                >
                                  {deco.label}
                                  <b>+{currency(deco.perUnitAdderUsd)}</b>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      ) : null}

                      {/* size + per-box qty + artwork */}
                      <div className="bb-field bb-field--row">
                        {p.sizes.length > 1 ? (
                          <label className="bb-mini">
                            <span className="bb-field-label">Size</span>
                            <select value={d.size} onChange={(e) => updateComponent(d.key, { size: e.target.value })}>
                              {p.sizes.map((s) => (
                                <option key={s} value={s}>{s}</option>
                              ))}
                            </select>
                          </label>
                        ) : null}
                        <label className="bb-mini">
                          <span className="bb-field-label">Per box</span>
                          <input
                            type="number"
                            min={1}
                            value={d.perBoxQty}
                            onChange={(e) => updateComponent(d.key, { perBoxQty: Math.max(1, Number(e.target.value) || 1) })}
                          />
                        </label>
                        <label className="bb-mini bb-mini--art">
                          <span className="bb-field-label">Artwork</span>
                          <input type="file" accept="image/*,.pdf,.ai,.eps,.svg" onChange={(e) => uploadArtwork(d.key, e.target.files?.[0])} />
                        </label>
                      </div>
                      <div className="bb-item-foot">
                        <span className="bb-art-status">
                          {d.uploading
                            ? "Uploading artwork…"
                            : d.uploadError
                              ? `⚠ ${d.uploadError}`
                              : d.artworkFileUrl
                                ? `✓ ${d.artworkFileName}`
                                : "No artwork yet (optional now)"}
                        </span>
                        {line ? (
                          <span className="bb-item-price">
                            {currency(line.lineUnitUsd)}/unit · <b>{currency(line.perBoxUsd)}/box</b>
                          </span>
                        ) : null}
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
          <div className="bb-section-head">
            <h2>Add items</h2>
          </div>
          <div className="bb-picker">
            {eligible.map((p) => (
              <button type="button" key={p.id} className="bb-pick" onClick={() => addComponent(p.id)}>
                <span className="bb-pick-shot">
                  <ProductShot product={p} variant={p.variants[0]} view="front" />
                </span>
                <span className="bb-pick-name">{p.displayName}</span>
                <span className="bb-pick-add" aria-hidden>+</span>
              </button>
            ))}
          </div>
        </section>

        {/* packaging */}
        <section className="bb-section">
          <div className="bb-section-head">
            <h2>Packaging</h2>
            <span className="label">Branded unboxing</span>
          </div>
          <div className="bb-packaging">
            {packaging.map((asset) => {
              const on = packagingIds.includes(asset.id);
              const required = Boolean(asset.packagingRequired);
              const tier = asset.priceTiers[0];
              return (
                <button
                  type="button"
                  key={asset.id}
                  className={`bb-pack${on ? " bb-pack--on" : ""}${required ? " bb-pack--locked" : ""}`}
                  aria-pressed={on}
                  onClick={() => togglePackaging(asset.id)}
                >
                  <span className="bb-pack-check" aria-hidden>{on ? "✓" : ""}</span>
                  <span className="bb-pack-name">
                    {asset.displayName}
                    {required ? <em> · included</em> : null}
                  </span>
                  <span className="bb-pack-price">{currency(tier.perUnitUsd)}/box</span>
                </button>
              );
            })}
          </div>
        </section>
      </div>

      {/* ---------------- sticky summary ---------------- */}
      <aside className="boxbuilder-summary panel">
        <div className="bb-summary-pad">
          <p className="eyebrow">Your PR Box</p>

          <div className="bb-qty">
            <span className="bb-field-label">Boxes</span>
            <div className="bb-stepper">
              <button type="button" aria-label="Fewer boxes" onClick={() => setBoxQty((q) => Math.max(1, q - 10))}>−</button>
              <input
                type="number"
                min={1}
                value={boxQty}
                onChange={(e) => setBoxQty(Math.max(1, Number(e.target.value) || 1))}
              />
              <button type="button" aria-label="More boxes" onClick={() => setBoxQty((q) => q + 10)}>+</button>
            </div>
          </div>
          {price.normalizedBoxQty > boxQty ? (
            <p className="bb-moq-note">Minimum {price.minBoxes} boxes — priced at {price.normalizedBoxQty}.</p>
          ) : null}

          <div className="bb-breakdown">
            {price.lines.length === 0 ? (
              <p className="bb-empty">Add at least one item and the box.</p>
            ) : (
              price.lines.map((l) => (
                <div className="price-line" key={`${l.kind}-${l.productId}`}>
                  <span>
                    {l.displayName}
                    {l.perBoxQty > 1 ? ` ×${l.perBoxQty}` : ""}
                  </span>
                  <strong>{currency(l.perBoxUsd)}</strong>
                </div>
              ))
            )}
          </div>

          <div className="price-line bb-subtotal">
            <span>Per-box subtotal</span>
            <strong>{currency(price.boxSubtotalUsd)}</strong>
          </div>
          {price.promo.qualifies ? (
            <div className="price-line bb-discount">
              <span>Bundle discount ({Math.round(price.promo.percent * 100)}%)</span>
              <strong>−{currency(price.bundleDiscountPerBoxUsd)}</strong>
            </div>
          ) : price.lines.length > 0 ? (
            <div className="bb-unmet">
              <span className="bb-unmet-title">Unlock {Math.round(promo.discount.value * 100)}% off:</span>
              <ul>
                {price.promo.unmetReasons.map((r) => (
                  <li key={r}>{r}</li>
                ))}
              </ul>
            </div>
          ) : null}

          <div className="price-total-big bb-box-total">
            <span className="from-label">Per box</span>
            <span className="price-total-num">{currency(price.boxUnitUsd)}</span>
            <span className="price-total-sub">
              × {price.normalizedBoxQty} boxes = <b>{currency(price.boxTotalUsd)}</b>
            </span>
          </div>

          <button
            type="button"
            className="button button--lg button--full"
            disabled={!canAdd}
            onClick={handleAdd}
            style={{ marginTop: 12 }}
          >
            {uploading ? "Uploading…" : submitting ? "Adding…" : "Add box to cart →"}
          </button>
          {!canAdd && !submitting ? (
            <p className="trust-note">Add at least one item and keep the box to continue.</p>
          ) : (
            <p className="trust-note">Each item + packaging becomes a production line under one PR Box. Artwork can be finalized after checkout.</p>
          )}
        </div>
      </aside>
    </div>
  );
}
