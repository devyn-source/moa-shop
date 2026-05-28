import Link from "next/link";
import { ProductVisual } from "@/components/ProductVisual";
import { PrintButton } from "@/components/PrintButton";
import { currency, formatLeadTime } from "@/lib/pricing";
import { getProducts } from "@/lib/store";

export default async function CatalogPdfPage() {
  const products = await getProducts();

  return (
    <main className="page print-page">
      <section className="print-cover">
        <p className="eyebrow">Magnum Opus Agency</p>
        <h1 className="page-title">Standardized Merch Catalog</h1>
        <p className="lede">
          Fixed-MOQ, fixed-price catalog products for qualified $10K-$25K merch programs.
          Configure online, upload completed artwork, pay upfront, and route directly into MOA production.
        </p>
        <div className="action-row no-print">
          <PrintButton />
          <Link className="secondary-button" href="/">
            Back to catalog
          </Link>
        </div>

        <div className="info-section">
          <div className="section-head">
            <h2>Contents</h2>
            <span className="label">{products.length} SKUs</span>
          </div>
          <ol className="toc">
            {products.map((product, idx) => (
              <li key={product.id} className="toc-row">
                <span className="toc-num">{String(idx + 1).padStart(2, "0")}</span>
                <span className="toc-title">{product.displayName}</span>
                <span className="toc-meta">
                  MOQ {product.moq} · {formatLeadTime(product.leadTimeDays)} · from {currency(product.priceTiers[product.priceTiers.length - 1].perUnitUsd)}/unit
                </span>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {products.map((product, idx) => (
        <section className="print-product" key={product.id}>
          <p className="eyebrow">SKU {String(idx + 1).padStart(2, "0")} · {product.category}</p>
          <div className="print-product-head">
            <div>
              <h2>{product.displayName}</h2>
              <p>{product.description}</p>
              <p className="best-for" style={{ marginTop: 12 }}>
                <span className="label">Best for</span> {product.bestFor}
              </p>
            </div>
            <div className="visual-frame">
              <ProductVisual
                type={product.visual}
                label={product.displayName}
                swatch={product.variants[0]?.colorHex}
              />
            </div>
          </div>
          <div className="facts-grid">
            <div className="fact">
              <span className="label">MOQ</span>
              <b>{product.moq} units</b>
            </div>
            <div className="fact">
              <span className="label">Lead time</span>
              <b>{formatLeadTime(product.leadTimeDays)}</b>
            </div>
            <div className="fact">
              <span className="label">Variants</span>
              <b>{product.variants.length} colors</b>
            </div>
          </div>
          <div className="pdf-columns">
            <div>
              <h3 className="eyebrow" style={{ color: "var(--ink)" }}>Price ladder</h3>
              <div className="tier-list">
                {product.priceTiers.map((tier, tierIdx) => (
                  <div
                    key={tier.minQty}
                    className={`tier-row${tierIdx === product.priceTiers.length - 1 ? " tier-row--best" : ""}`}
                  >
                    <span>
                      {tier.minQty}{tier.maxQty ? `–${tier.maxQty}` : "+"} units
                    </span>
                    <strong>{currency(tier.perUnitUsd)}/unit</strong>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <h3 className="eyebrow" style={{ color: "var(--ink)" }}>Decoration menu</h3>
              <div className="tier-list">
                {product.decorations.map((decoration) => (
                  <div className="tier-row" key={decoration.id}>
                    <span>{decoration.label}</span>
                    <strong>+{currency(decoration.perUnitAdderUsd)}/unit</strong>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      ))}
    </main>
  );
}
