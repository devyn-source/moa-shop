"use client";

import { useState } from "react";
import Link from "next/link";
import { ProductGallery } from "./ProductGallery";
import { currency, formatLeadTime } from "@/lib/pricing";
import type { CatalogProduct } from "@/lib/types";

export function ProductTop({ product }: { product: CatalogProduct }) {
  const defaultVariant = product.variants.find((v) => v.frontImage) ?? product.variants[0];
  const [variantId, setVariantId] = useState(defaultVariant?.id ?? "");
  const [view, setView] = useState<"front" | "back">("front");

  const variant = product.variants.find((v) => v.id === variantId) ?? product.variants[0];
  const cheapest = product.priceTiers[product.priceTiers.length - 1] ?? product.priceTiers[0];

  return (
    <section className="pdp-top">
      <div className="pdp-left">
        <ProductGallery product={product} variant={variant} view={view} onView={setView} />
      </div>

      <aside className="pdp-right">
        <p className="eyebrow">{product.category}</p>
        <h1 className="sku-huge">{product.displayName}</h1>
        <p className="sku-subtitle">Style {product.skuCode}</p>

        <p className="pdp-lede">{product.headline}</p>

        <div className="pdp-rail-color">
          <span className="pdp-color-label">Color: <b>{variant?.colorLabel}</b></span>
          <div className="pdp-color-swatches" role="tablist" aria-label="Color">
            {product.variants.map((item) => {
              const selected = variantId === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  role="tab"
                  aria-selected={selected}
                  aria-label={item.colorLabel}
                  title={item.colorLabel}
                  className={`pdp-swatch${selected ? " pdp-swatch--active" : ""}`}
                  style={{ background: item.colorHex }}
                  onClick={() => setVariantId(item.id)}
                />
              );
            })}
          </div>
        </div>

        <div className="pdp-price-summary">
          <span className="from-label">From</span>
          <strong className="from-price">{currency(cheapest.perUnitUsd)}</strong>
          <span className="from-unit">/unit at {cheapest.minQty}+</span>
        </div>

        <div className="pdp-cta-row">
          <Link className="button button--lg button--full" href={`/p/${product.slug}/configure`}>
            Configure order →
          </Link>
          <p className="trust-note">
            Grab the mockup template from the gallery (left) — inch-grid layout file for placement + sizing.
          </p>
        </div>

        <details className="pdp-detail" open>
          <summary>
            <span>Product details</span>
            <span className="pdp-detail-icon" aria-hidden />
          </summary>
          <div className="pdp-detail-body">
            <p>{product.description}</p>
            <div className="spec-list">
              {product.fitNotes ? (
                <div className="spec-row"><span className="spec-label">Fit</span><span className="spec-value">{product.fitNotes}</span></div>
              ) : null}
              <div className="spec-row"><span className="spec-label">Best for</span><span className="spec-value">{product.bestFor}</span></div>
              <div className="spec-row"><span className="spec-label">Production</span><span className="spec-value">Made to order · MOA-managed quality control</span></div>
            </div>
          </div>
        </details>

        <details className="pdp-detail">
          <summary>
            <span>Size chart</span>
            <span className="pdp-detail-icon" aria-hidden />
          </summary>
          <div className="pdp-detail-body">
            <p className="label">Available sizes</p>
            <div className="size-pills">
              {product.sizes.map((size) => (
                <span key={size} className="size-pill">{size}</span>
              ))}
            </div>
            <p className="trust-note">
              Inch-by-inch tech pack measurements are reviewed during artwork QA. Full size chart on the configurator and PDF.
            </p>
          </div>
        </details>

        <details className="pdp-detail">
          <summary>
            <span>Price ladder</span>
            <span className="pdp-detail-icon" aria-hidden />
          </summary>
          <div className="pdp-detail-body">
            <div className="tier-list">
              {product.priceTiers.map((tier, idx) => (
                <div className={`tier-row${idx === product.priceTiers.length - 1 ? " tier-row--best" : ""}`} key={tier.minQty}>
                  <span>{tier.minQty}{tier.maxQty ? `–${tier.maxQty}` : "+"} units</span>
                  <strong>{currency(tier.perUnitUsd)}/unit</strong>
                </div>
              ))}
            </div>
            <p className="trust-note">Decoration adders applied on top per unit. Pre-decoration unit price shown.</p>
          </div>
        </details>

        <details className="pdp-detail">
          <summary>
            <span>Decoration menu</span>
            <span className="pdp-detail-icon" aria-hidden />
          </summary>
          <div className="pdp-detail-body">
            <div className="decoration-rows">
              {product.decorations.map((decoration) => (
                <div className="decoration-row" key={decoration.id}>
                  <div>
                    <strong>{decoration.label}</strong>
                    <p>{decoration.description}</p>
                  </div>
                  <span className="adder-pill">+{currency(decoration.perUnitAdderUsd)}/unit</span>
                </div>
              ))}
            </div>
          </div>
        </details>

        <details className="pdp-detail">
          <summary>
            <span>Lead time + shipping</span>
            <span className="pdp-detail-icon" aria-hidden />
          </summary>
          <div className="pdp-detail-body">
            <div className="spec-list" style={{ paddingTop: 0, borderTop: 0, marginTop: 0 }}>
              <div className="spec-row"><span className="spec-label">Production</span><span className="spec-value">{formatLeadTime(product.leadTimeDays)} from artwork approval</span></div>
              <div className="spec-row"><span className="spec-label">Artwork QA</span><span className="spec-value">1–3 business days</span></div>
              <div className="spec-row"><span className="spec-label">Shipping</span><span className="spec-value">DDP air freight default. Sea freight on request for {product.moq * 4}+ unit orders.</span></div>
            </div>
          </div>
        </details>
      </aside>
    </section>
  );
}
