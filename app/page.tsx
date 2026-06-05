import Link from "next/link";
import { HomeCatalog } from "@/components/HomeCatalog";
import { getProducts } from "@/lib/store";
import { isBundleEligible } from "@/lib/seed";
import { bundleStartingPriceUsd } from "@/lib/pricing";

export default async function HomePage() {
  const products = await getProducts();
  // Packaging assets are hidden (unpublished), so read the full catalog to price
  // the PR Box card's "from $X/box".
  const all = await getProducts({ includeDrafts: true });
  const bundleStartFromUsd = bundleStartingPriceUsd(
    all.filter(isBundleEligible),
    all.filter((p) => p.category === "packaging")
  );

  return (
    <main className="page">
      <section className="catalog-intro">
        <div className="catalog-intro-text">
          <p className="eyebrow">The MOA Catalog</p>
          <h1 className="page-title">Production-grade merch, made to order.</h1>
          <p className="lede">
            Choose a premium blank, build your run by size, and upload your artwork. MOA manufactures it
            to spec and ships it to you — no quotes, no sales calls, no minimums runaround. The self-serve
            side of the studio brands trust for their best merch.
          </p>
        </div>
      </section>

      <HomeCatalog products={products} bundleStartFromUsd={bundleStartFromUsd} />

      <section className="value-strip" aria-label="How it works">
        <div className="value-card">
          <span className="value-num">01</span>
          <h3>No quotes, ever</h3>
          <p>One transparent price ladder per style. What you see is what you pay — no RFQs, no sales calls, no back-and-forth.</p>
        </div>
        <div className="value-card">
          <span className="value-num">02</span>
          <h3>Your proof, instantly</h3>
          <p>Upload your art and see exactly how it prints. Adjust placement, color and size yourself until it&apos;s right — then approve. Nothing is made until you do.</p>
        </div>
        <div className="value-card">
          <span className="value-num">03</span>
          <h3>Production-grade blanks</h3>
          <p>Every style is a garment we already make for top brands — curated and decoration-ready, not an endless generic catalog.</p>
        </div>
        <div className="value-card">
          <span className="value-num">04</span>
          <h3>Tracked to your door</h3>
          <p>Live status from approval through production to delivery, with carrier tracking emailed the moment it ships.</p>
        </div>
      </section>

      <section className="cta-strip">
        <div>
          <p className="eyebrow">The full range</p>
          <h2>Browse the complete catalog as a PDF</h2>
        </div>
        <Link className="button button--lg" href="/catalog-pdf">
          View PDF →
        </Link>
      </section>
    </main>
  );
}
