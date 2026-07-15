import Link from "next/link";
import Image from "next/image";
import { ProductShot } from "./ProductShot";
import { WishlistHeart } from "./WishlistHeart";
import { currency, formatLeadTime } from "@/lib/pricing";
import type { CatalogProduct } from "@/lib/types";

export function ProductCard({
  product,
  featured = false,
  bundleStartFromUsd,
  modelThumbUrl
}: {
  product: CatalogProduct;
  featured?: boolean;
  bundleStartFromUsd?: number;
  // Pre-rendered 3D still — when present it IS the product photo (replaces the
  // 2D recolor mock), so the catalog shows the real 3D garment.
  modelThumbUrl?: string;
}) {
  const cheapestTier = product.priceTiers[product.priceTiers.length - 1] ?? product.priceTiers[0];
  const startTier = product.priceTiers[0];
  const swatchCount = product.variants.length;
  const heroVariant =
    product.variants.find((v) => v.colorLabel === "Black" && v.recolor !== false) ??
    product.variants.find((v) => v.frontImage) ??
    product.variants[0];
  const isPhoto = Boolean(product.greyFront || heroVariant?.frontImage);
  const isBundle = Boolean(product.isBundleBuilder);

  // The PR Box is a builder, not a single SKU: show a per-box "from" price and a
  // build-it CTA instead of swatches / per-unit MOQ economics.
  if (isBundle) {
    return (
      <Link className="product-card product-card--bundle" href={`/p/${product.slug}`}>
        <span className="card-ribbon card-ribbon--accent">PR Box</span>
        <div className={`visual-frame${isPhoto ? " visual-frame--photo" : ""}`}>
          <ProductShot product={product} variant={heroVariant} view="front" />
          <span className="visual-meta">bundle</span>
        </div>
        <div className="card-body">
          <div className="card-headline-row">
            <h3>{product.displayName}</h3>
            {bundleStartFromUsd ? (
              <span className="from-pill">
                <span>From</span>
                <b>{currency(bundleStartFromUsd)}</b>
                <span>/box</span>
              </span>
            ) : null}
          </div>
          <p className="card-blurb">{product.headline}</p>
          <div className="card-meta-row">
            <span className="meta-tag"><span className="label">Min</span><b>{product.moq} boxes</b></span>
            <span className="meta-tag"><span className="label">Lead</span><b>{formatLeadTime(product.leadTimeDays)}</b></span>
            <span className="meta-tag meta-tag--ghost"><span className="label">Save</span><b>up to 10%</b></span>
          </div>
          <span className="bundle-card-cta">Build your box →</span>
        </div>
      </Link>
    );
  }

  return (
    <Link className={`product-card${featured ? " product-card--featured" : ""}`} href={`/p/${product.slug}`}>
      {featured ? <span className="card-ribbon">Featured</span> : null}
      <div className={`visual-frame${isPhoto || modelThumbUrl ? " visual-frame--photo" : ""}`}>
        {modelThumbUrl ? (
          <Image className="product-photo" src={modelThumbUrl} alt={product.displayName} width={1600} height={2000} sizes="(max-width: 768px) 90vw, 400px" />
        ) : (
          <ProductShot product={product} variant={heroVariant} view="front" />
        )}
        {/* tiny client island — the card itself stays server-rendered */}
        <WishlistHeart slug={product.slug} productName={product.displayName} />
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
