"use client";

import { ProductVisual } from "./ProductVisual";
import type { CatalogProduct, CatalogVariant } from "@/lib/types";

const VIEWS = ["front", "back"] as const;
type View = (typeof VIEWS)[number];

function Shot({
  product,
  variant,
  view
}: {
  product: CatalogProduct;
  variant?: CatalogVariant;
  view: View;
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
  view: View;
  onView: (view: View) => void;
}) {
  const hasPhoto = view === "front" ? Boolean(variant?.frontImage) : Boolean(variant?.backImage);
  const step = (dir: 1 | -1) => {
    const i = VIEWS.indexOf(view);
    onView(VIEWS[(i + dir + VIEWS.length) % VIEWS.length]);
  };

  return (
    <div className="pdp-gallery">
      <div className={`pdp-main${hasPhoto ? " pdp-main--photo" : ""}`}>
        <span className="pdp-shot-tag">{view}</span>
        <button type="button" className="pdp-nav pdp-nav--prev" onClick={() => step(-1)} aria-label="Previous view">‹</button>
        <Shot product={product} variant={variant} view={view} />
        <button type="button" className="pdp-nav pdp-nav--next" onClick={() => step(1)} aria-label="Next view">›</button>
      </div>

      <div className="pdp-thumbs">
        {VIEWS.map((v) => (
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
      </div>
    </div>
  );
}
