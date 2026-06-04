import Link from "next/link";
import { ProductShot } from "./ProductShot";
import { currency } from "@/lib/pricing";
import type { CatalogProduct } from "@/lib/types";

// Gallery-grade card — image on cream, then a quiet name / colorway / price.
// Production detail (MOQ, lead time, ladder) lives on the product page, not the
// tile. Restraint is the point.
export function ProductCard({ product, featured = false }: { product: CatalogProduct; featured?: boolean }) {
  const cheapestTier = product.priceTiers[product.priceTiers.length - 1] ?? product.priceTiers[0];
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
      </div>
      <div className="card-body">
        <h3>{product.displayName}</h3>
        <div className="card-footline">
          <span className="swatch-row" aria-label={`${swatchCount} colors available`}>
            {product.variants.slice(0, 5).map((variant) => (
              <span key={variant.id} className="swatch-dot" title={variant.colorLabel} style={{ background: variant.colorHex }} />
            ))}
            <span className="swatch-count">{swatchCount}</span>
          </span>
          <span className="card-price">From {currency(cheapestTier.perUnitUsd)}</span>
        </div>
      </div>
    </Link>
  );
}
