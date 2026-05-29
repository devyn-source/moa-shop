"use client";

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
    return <img className="product-photo" src={src} alt={`${variant?.colorLabel ?? product.displayName} ${view}`} loading="lazy" />;
  }
  return <ProductVisual type={product.visual} label={variant?.colorLabel ?? product.displayName} swatch={variant?.colorHex} view={view} />;
}

export function ProductGallery({
  product,
  variant,
  view,
  onView
}: {
  product: CatalogProduct;
  variant?: CatalogVariant;
  view: "front" | "back";
  onView: (view: "front" | "back") => void;
}) {
  const hasPhoto = view === "front" ? Boolean(variant?.frontImage) : Boolean(variant?.backImage);

  return (
    <div className="pdp-gallery">
      <div className={`pdp-main${hasPhoto ? " pdp-main--photo" : ""}`}>
        <Shot product={product} variant={variant} view={view} />
        <span className="pdp-shot-tag">{view}</span>
      </div>

      <div className="pdp-thumbs">
        {(["front", "back"] as const).map((v) => (
          <button
            key={v}
            type="button"
            className={`pdp-thumb${view === v ? " pdp-thumb--active" : ""}`}
            onClick={() => onView(v)}
            aria-label={`View ${v}`}
          >
            <span className="pdp-thumb-img">
              <Shot product={product} variant={variant} view={v} />
            </span>
            <span className="pdp-thumb-label">{v}</span>
          </button>
        ))}
        <a
          className="pdp-thumb pdp-thumb--mockup"
          href={variant?.mockupTemplateUrl ?? "#"}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Download mockup template"
        >
          <span className="pdp-thumb-img">
            <span className="pdp-thumb-icon" aria-hidden>↓</span>
          </span>
          <span className="pdp-thumb-label">Tech pack</span>
        </a>
      </div>
    </div>
  );
}
