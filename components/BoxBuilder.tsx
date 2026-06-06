"use client";

import { useCallback, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ProductShot } from "./ProductShot";
import { DraggableArt, type ArtTransform } from "./DraggableArt";
import { useCart } from "./CartProvider";
import { buildBundleCartLines } from "@/lib/bundle";
import { calculateBundlePrice, currency } from "@/lib/pricing";
import { PR_BOX_PROMO } from "@/lib/promo";
import { getDefaultZones, type Zone } from "@/lib/zones";
import type { ArtworkPlacement, CatalogProduct, CatalogVariant, DecorationMethod } from "@/lib/types";

type ComponentDraft = {
  key: string;
  productId: string;
  variantId: string;
  decorationIds: DecorationMethod[];
  perBoxQty: number;
  size: string;
  view: "front" | "back";
  placementId: string | null; // chosen zone on the current view
  art: ArtTransform; // position/scale of the art within the zone box
  artworkFileName?: string;
  artworkFileUrl?: string;
  uploading?: boolean;
  uploadError?: string;
};

const FILL_ART: ArtTransform = { ox: 0, oy: 0, sx: 1, sy: 1 };

// Per-packaging-asset customization — each branded piece carries its own artwork.
type PackArt = {
  artworkFileName?: string;
  artworkFileUrl?: string;
  uploading?: boolean;
  uploadError?: string;
  notes?: string;
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
  const [packArt, setPackArt] = useState<Record<string, PackArt>>({});
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
        { key: nextKey(), productId, variantId: variant.id, decorationIds: [], perBoxQty: 1, size: midSize, view: "front", placementId: null, art: FILL_ART }
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
        updatePackArt(id, {
          uploading: false,
          artworkFileUrl: undefined,
          uploadError: err instanceof Error ? err.message : "Upload failed"
        });
      }
    },
    [updatePackArt]
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
    const packs = packagingIds
      .map((id) => {
        const p = packagingById.get(id);
        return p ? { product: p, art: packArt[id] } : null;
      })
      .filter(Boolean) as { product: CatalogProduct; art?: PackArt }[];
    return { comps, packs };
  }, [components, packagingIds, packArt, eligibleById, packagingById]);

  const price = useMemo(
    () =>
      calculateBundlePrice(
        resolved.comps.map((c) => ({ product: c.product, decorationIds: c.draft.decorationIds, perBoxQty: c.draft.perBoxQty })),
        resolved.packs.map((p) => ({ product: p.product, perBoxQty: 1 })),
        boxQty,
        promo
      ),
    [resolved, boxQty, promo]
  );

  const canAdd = resolved.comps.length > 0 && resolved.packs.length > 0 && !submitting;
  const uploading =
    components.some((d) => d.uploading) || Object.values(packArt).some((a) => a?.uploading);

  const handleAdd = useCallback(() => {
    if (!canAdd) return;
    setSubmitting(true);
    const { lines } = buildBundleCartLines({
      bundleId: crypto.randomUUID(),
      bundleLabel: "PR Box",
      components: resolved.comps.map((c) => {
        const zones = getDefaultZones(c.product);
        const viewZones = c.draft.view === "back" ? zones.back : zones.front;
        const zone = viewZones.find((z) => z.id === c.draft.placementId) ?? viewZones[0] ?? null;
        const method =
          c.product.decorations.filter((dd) => c.draft.decorationIds.includes(dd.id)).map((dd) => dd.label).join(" + ") ||
          undefined;
        const artworkPlacement: ArtworkPlacement | undefined =
          c.draft.artworkFileUrl && zone
            ? { view: c.draft.view, zoneId: zone.id, zoneLabel: zone.label, box: zone.box, art: c.draft.art, method }
            : undefined;
        return {
          product: c.product,
          variant: c.variant,
          decorationIds: c.draft.decorationIds,
          perBoxQty: c.draft.perBoxQty,
          size: c.draft.size,
          artworkFileName: c.draft.artworkFileName,
          artworkFileUrl: c.draft.artworkFileUrl,
          artworkPlacement
        };
      }),
      packaging: resolved.packs.map((p) => ({
        product: p.product,
        perBoxQty: 1,
        artworkFileName: p.art?.artworkFileName,
        artworkFileUrl: p.art?.artworkFileUrl,
        artworkNotes: p.art?.notes
      })),
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
                const hasBack = Boolean(p.greyBack);
                const view = hasBack ? d.view : "front";
                const zones = getDefaultZones(p);
                const viewZones: Zone[] = view === "back" ? zones.back : zones.front;
                const placement = viewZones.find((z) => z.id === d.placementId) ?? viewZones[0] ?? null;
                return (
                  <li className="bb-card" key={d.key}>
                    {/* visual stage — live garment recolor + drag-place artwork */}
                    <div className="bb-stage">
                      <div className="bb-stage-shot">
                        <ProductShot product={p} variant={variant} view={view} />
                        {d.artworkFileUrl && placement ? (
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
                            <DraggableArt url={d.artworkFileUrl} transform={d.art} onChange={(t) => updateComponent(d.key, { art: t })} />
                          </span>
                        ) : null}
                      </div>
                      {hasBack ? (
                        <div className="bb-stage-views">
                          {(["front", "back"] as const).map((vw) => (
                            <button
                              key={vw}
                              type="button"
                              className={`bb-view${view === vw ? " bb-view--on" : ""}`}
                              onClick={() => updateComponent(d.key, { view: vw })}
                            >
                              {vw}
                            </button>
                          ))}
                        </div>
                      ) : null}
                    </div>

                    {/* config — stepped, PDP-style */}
                    <div className="bb-config">
                      <div className="bb-item-top">
                        <div>
                          <h3>{p.displayName}</h3>
                          {p.fitNotes ? <p className="bb-card-fit">{p.fitNotes}</p> : null}
                        </div>
                        <button type="button" className="cart-remove" aria-label="Remove item" onClick={() => removeComponent(d.key)}>✕</button>
                      </div>

                      {/* color */}
                      <div className="bb-step">
                        <span className="bb-step-label">Color · <b>{variant?.colorLabel}</b></span>
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
                        </div>
                      </div>

                      {/* decoration */}
                      {p.decorations.length > 0 ? (
                        <div className="bb-step">
                          <span className="bb-step-label">Decoration</span>
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

                      {/* artwork — upload, then drag-place on the garment */}
                      <div className="bb-step">
                        <span className="bb-step-label">Artwork placement</span>
                        <div className="bb-artwork-row">
                          <input type="file" accept="image/*,.pdf,.ai,.eps,.svg" onChange={(e) => uploadArtwork(d.key, e.target.files?.[0])} />
                          <span className="bb-art-status">
                            {d.uploading
                              ? "Uploading…"
                              : d.uploadError
                                ? `⚠ ${d.uploadError}`
                                : d.artworkFileUrl
                                  ? `✓ ${d.artworkFileName}`
                                  : "Optional now — finalize after checkout"}
                          </span>
                        </div>
                        {d.artworkFileUrl ? (
                          <>
                            <p className="bb-place-hint">Drag the artwork on the garment to position it, then pick a zone:</p>
                            <div className="bb-chips">
                              {viewZones.map((z) => (
                                <button
                                  key={z.id}
                                  type="button"
                                  className={`bb-chip${placement?.id === z.id ? " bb-chip--on" : ""}`}
                                  aria-pressed={placement?.id === z.id}
                                  onClick={() => updateComponent(d.key, { placementId: z.id, art: FILL_ART })}
                                >
                                  {z.label}
                                </button>
                              ))}
                            </div>
                          </>
                        ) : null}
                      </div>

                      {/* size & quantity */}
                      <div className="bb-step">
                        <span className="bb-step-label">Size &amp; quantity</span>
                        <div className="bb-field--row">
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
                        </div>
                      </div>

                      {line ? (
                        <div className="bb-item-foot">
                          <span />
                          <span className="bb-item-price">
                            {currency(line.lineUnitUsd)}/unit · <b>{currency(line.perBoxUsd)}/box</b>
                          </span>
                        </div>
                      ) : null}
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
              const line = lineByProduct.get(asset.id);
              return (
                <li className="bb-item" key={id}>
                  <div className="bb-item-shot">
                    <ProductShot product={asset} variant={asset.variants[0]} view="front" />
                  </div>
                  <div className="bb-item-body">
                    <div className="bb-item-top">
                      <h3>
                        {asset.displayName}
                        {required ? <span className="bb-pack-req"> · included</span> : null}
                      </h3>
                      {required ? null : (
                        <button type="button" className="cart-remove" aria-label="Remove packaging" onClick={() => togglePackaging(id)}>✕</button>
                      )}
                    </div>
                    <div className="bb-field bb-field--row">
                      <label className="bb-mini bb-mini--art">
                        <span className="bb-field-label">Artwork / branding</span>
                        <input type="file" accept="image/*,.pdf,.ai,.eps,.svg" onChange={(e) => uploadPackArt(id, e.target.files?.[0])} />
                      </label>
                      <label className="bb-mini bb-mini--notes">
                        <span className="bb-field-label">Notes</span>
                        <input
                          type="text"
                          placeholder="e.g. logo centered, gold foil"
                          value={art?.notes ?? ""}
                          onChange={(e) => updatePackArt(id, { notes: e.target.value })}
                        />
                      </label>
                    </div>
                    <div className="bb-item-foot">
                      <span className="bb-art-status">
                        {art?.uploading
                          ? "Uploading artwork…"
                          : art?.uploadError
                            ? `⚠ ${art.uploadError}`
                            : art?.artworkFileUrl
                              ? `✓ ${art.artworkFileName}`
                              : "No artwork yet (optional now)"}
                      </span>
                      {line ? <span className="bb-item-price"><b>{currency(line.perBoxUsd)}/box</b></span> : null}
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
                {packaging
                  .filter((a) => !packagingIds.includes(a.id))
                  .map((asset) => (
                    <button type="button" key={asset.id} className="bb-chip" onClick={() => togglePackaging(asset.id)}>
                      + {asset.displayName} <b>{currency(asset.priceTiers[0].perUnitUsd)}/box</b>
                    </button>
                  ))}
              </div>
            </div>
          ) : null}
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
