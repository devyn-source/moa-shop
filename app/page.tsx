import Link from "next/link";
import { HomeCatalog } from "@/components/HomeCatalog";
import { currency } from "@/lib/pricing";
import { getProducts } from "@/lib/store";

export default async function HomePage() {
  const products = await getProducts();
  const minOrder = Math.min(...products.map((product) => product.moq * product.priceTiers[0].perUnitUsd));
  const minLead = Math.min(...products.map((product) => product.leadTimeDays));
  const minMoq = Math.min(...products.map((product) => product.moq));

  return (
    <main className="page">
      <section className="catalog-intro">
        <div className="catalog-intro-text">
          <p className="eyebrow">Magnum Opus Agency</p>
          <h1 className="page-title">Standardized Merch Catalog</h1>
          <p className="lede">
            Premium merch programs, managed end to end by MOA. Fixed MOQ, fixed pricing, bounded options.
            Choose a SKU, set quantities by size, upload artwork, pay upfront.
          </p>
        </div>
        <div className="catalog-intro-stats">
          <div className="intro-stat">
            <span>SKUs</span>
            <strong>{products.length}</strong>
          </div>
          <div className="intro-stat">
            <span>Min order</span>
            <strong>{currency(minOrder)}</strong>
          </div>
          <div className="intro-stat">
            <span>From MOQ</span>
            <strong>{minMoq}</strong>
          </div>
          <div className="intro-stat">
            <span>Lead</span>
            <strong>{minLead}d+</strong>
          </div>
        </div>
      </section>

      <HomeCatalog products={products} />

      <section className="value-strip" aria-label="What MOA handles">
        <div className="value-card">
          <span className="value-num">01</span>
          <h3>Fixed, all-in pricing</h3>
          <p>One locked price ladder per SKU. No quotes, no back-and-forth — managed end to end by MOA.</p>
        </div>
        <div className="value-card">
          <span className="value-num">02</span>
          <h3>Artwork QA included</h3>
          <p>MOA reviews every uploaded mockup for placement and production readiness before it goes into production.</p>
        </div>
        <div className="value-card">
          <span className="value-num">03</span>
          <h3>Bounded options</h3>
          <p>One variant menu, one decoration menu, one price ladder. No custom dev cycle, no surprises.</p>
        </div>
        <div className="value-card">
          <span className="value-num">04</span>
          <h3>Status visibility</h3>
          <p>Live order timeline from artwork QA through shipment. Tracking emailed when it ships.</p>
        </div>
      </section>

      <section className="cta-strip">
        <div>
          <p className="eyebrow">Need the deck</p>
          <h2>Download the full catalog PDF</h2>
        </div>
        <Link className="button button--lg" href="/catalog-pdf">
          View PDF →
        </Link>
      </section>
    </main>
  );
}
