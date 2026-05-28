import Link from "next/link";
import { notFound } from "next/navigation";
import { ProductGallery } from "@/components/ProductGallery";
import { currency, formatLeadTime } from "@/lib/pricing";
import { getProductBySlug } from "@/lib/store";

export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const product = await getProductBySlug(slug);

  if (!product || !product.isPublished) {
    notFound();
  }

  const cheapest = product.priceTiers[product.priceTiers.length - 1] ?? product.priceTiers[0];

  return (
    <main className="page">
      <nav className="crumbs" aria-label="Breadcrumb">
        <Link href="/">Catalog</Link>
        <span aria-hidden>/</span>
        <span>{product.category}</span>
        <span aria-hidden>/</span>
        <span className="crumb-current">{product.skuCode}</span>
      </nav>

      <section className="pdp-top">
        <div className="pdp-left">
          <ProductGallery product={product} />
        </div>

        <aside className="pdp-right">
          <p className="eyebrow">{product.category}</p>
          <h1 className="sku-huge">{product.displayName}</h1>
          <p className="sku-subtitle">Style {product.skuCode}</p>

          <p className="pdp-lede">{product.headline}</p>

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
              {product.fitNotes ? <p><span className="label">Fit</span> {product.fitNotes}</p> : null}
              <p><span className="label">Best for</span> {product.bestFor}</p>
              <p><span className="label">Production</span> Made to order · MOA-managed quality control</p>
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
              <p><span className="label">Production</span> {formatLeadTime(product.leadTimeDays)} from artwork approval</p>
              <p><span className="label">Artwork QA</span> 1–3 business days</p>
              <p><span className="label">Shipping</span> DDP air freight default. Sea freight on request for {product.moq * 4}+ unit orders.</p>
            </div>
          </details>
        </aside>
      </section>
    </main>
  );
}
