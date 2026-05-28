"use client";

import { useState } from "react";
import { ProductVisual } from "./ProductVisual";
import type { CatalogProduct, CatalogVariant } from "@/lib/types";

function Shot({
  product,
  variant,
  view
}: {
  product: CatalogProduct;
  variant?: CatalogVariant;
  view: "front" | "back";
}) {
  const src = view === "front" ? variant?.frontImage : variant?.backImage;
  if (src) {
    return (
      <img className="product-photo" src={src} alt={`${variant?.colorLabel ?? product.displayName} ${view}`} loading="lazy" />
    );
  }
  return (
    <ProductVisual type={product.visual} label={variant?.colorLabel ?? product.displayName} swatch={variant?.colorHex} view={view} />
  );
}

export function ProductGallery({ product }: { product: CatalogProduct }) {
  const defaultVariant = product.variants.find((item) => item.frontImage) ?? product.variants[0];
  const [activeId, setActiveId] = useState(defaultVariant?.id ?? "");
  const variant = product.variants.find((item) => item.id === activeId) ?? product.variants[0];

  return (
    <div className="pdp-gallery">
      <div className={`pdp-shot pdp-shot--hero${variant?.frontImage ? " pdp-shot--photo" : ""}`}>
        <Shot product={product} variant={variant} view="front" />
        <span className="pdp-shot-tag">Front</span>
      </div>

      <div className="pdp-secondary">
        <a
          className="pdp-mockup-card"
          href={variant?.mockupTemplateUrl ?? "#"}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`Download mockup template for ${variant?.colorLabel ?? product.displayName}`}
        >
          <div className="mockup-grid-bg" aria-hidden />
          <div className="mockup-frame" aria-hidden>
            <ProductVisual type={product.visual} label="" swatch="rgba(30,30,30,0.16)" view="front" />
          </div>
          <div className="mockup-pad">
            <span className="mockup-eyebrow">Tech pack</span>
            <strong className="mockup-title">Mockup template</strong>
            <span className="mockup-meta">PDF · inch-grid</span>
            <span className="mockup-cta">
              <span aria-hidden>↓</span> Download .PDF
            </span>
          </div>
        </a>

        <div className={`pdp-shot pdp-shot--back${variant?.backImage ? " pdp-shot--photo" : ""}`}>
          <Shot product={product} variant={variant} view="back" />
          <span className="pdp-shot-tag">Back</span>
        </div>
      </div>

      <div className="pdp-color-row">
        <span className="pdp-color-label">Color: <b>{variant?.colorLabel}</b></span>
        <div className="pdp-color-swatches" role="tablist" aria-label="Color variants">
          {product.variants.map((item) => {
            const selected = activeId === item.id;
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
                onClick={() => setActiveId(item.id)}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}
