"use client";

import { ProductShot } from "./ProductShot";
import type { CatalogProduct, CatalogVariant } from "@/lib/types";

const VIEWS = ["front", "back"] as const;
type View = (typeof VIEWS)[number];

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
  const hasBack = Boolean(product.greyBack) || product.variants.some((v) => v.backImage);
  const views: View[] = hasBack ? [...VIEWS] : ["front"];
  const shownView = views.includes(view) ? view : "front";
  const grey = shownView === "front" ? product.greyFront : product.greyBack;
  const hasPhoto = Boolean(grey) || (shownView === "front" ? Boolean(variant?.frontImage) : Boolean(variant?.backImage));
  const step = (dir: 1 | -1) => {
    const i = views.indexOf(shownView);
    onView(views[(i + dir + views.length) % views.length]);
  };

  return (
    <div className="pdp-gallery">
      <div className={`pdp-main${hasPhoto ? " pdp-main--photo" : ""}`}>
        <span className="pdp-shot-tag">{shownView}</span>
        {views.length > 1 ? (
          <button type="button" className="pdp-nav pdp-nav--prev" onClick={() => step(-1)} aria-label="Previous view">‹</button>
        ) : null}
        <ProductShot product={product} variant={variant} view={shownView} />
        {views.length > 1 ? (
          <button type="button" className="pdp-nav pdp-nav--next" onClick={() => step(1)} aria-label="Next view">›</button>
        ) : null}
      </div>

      {views.length > 1 ? (
        <div className="pdp-thumbs">
          {views.map((v) => (
            <button
              key={v}
              type="button"
              className={`pdp-thumb${shownView === v ? " pdp-thumb--active" : ""}`}
              onClick={() => onView(v)}
              aria-label={`View ${v}`}
            >
              <span className="pdp-thumb-img">
                <ProductShot product={product} variant={variant} view={v} />
              </span>
              <span className="pdp-thumb-label">{v}</span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
