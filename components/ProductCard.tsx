import Link from "next/link";
import { ProductShot } from "./ProductShot";
import { currency, formatLeadTime } from "@/lib/pricing";
import type { CatalogProduct } from "@/lib/types";

export function ProductCard({ product, featured = false }: { product: CatalogProduct; featured?: boolean }) {
  const cheapestTier = product.priceTiers[product.priceTiers.length - 1] ?? product.priceTiers[0];
  const startTier = product.priceTiers[0];
  const swatchCount = product.variants.length;
  const heroVariant =
    product.variants.find((v) => v.colorLabel === "Black" && v.recolor !== false) ??
    product.variants.find((v) => v.frontImage) ??
    product.variants[0];
  const isPhoto = Boolean(product.greyFront || heroVariant?.frontImage);

  return (
    <Link className={`product-card${featured ? " product-card--featured" : ""}`} href={`/p/${product.slug}`}>
      {featured ? <span className="card-ribbon">Featured</span> : null}
      <div className={`visual-frame${isPhoto ? " visual-frame--photo" : ""}`}>
        <ProductShot product={product} variant={heroVariant} view="front" />
        <span className="visual-meta">{product.category}</span>
      </div>
      <div className="card-body">
        <div className="card-headline-row">
          <h3>{product.displayName}</h3>
          <span className="from-pill">
            <span>From</span>
            <b>{currency(cheapestTier.perUnitUsd)}</b>
          </span>
        </div>
        <p className="card-blurb">{product.headline}</p>
        <div className="swatch-row" aria-label={`${swatchCount} colors available`}>
          {product.variants.slice(0, 5).map((variant) => (
            <span
              key={variant.id}
              className="swatch-dot"
              title={variant.colorLabel}
              style={{ background: variant.colorHex }}
            />
          ))}
          <span className="swatch-count">{swatchCount} {swatchCount === 1 ? "color" : "colors"}</span>
        </div>
        <div className="card-meta-row">
          <span className="meta-tag">
            <span className="label">MOQ</span>
            <b>{product.moq}</b>
          </span>
          <span className="meta-tag">
            <span className="label">Lead</span>
            <b>{formatLeadTime(product.leadTimeDays)}</b>
          </span>
          <span className="meta-tag meta-tag--ghost">
            <span className="label">Starts</span>
            <b>{currency(startTier.perUnitUsd)}/unit</b>
          </span>
        </div>
      </div>
    </Link>
  );
}
