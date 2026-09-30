import { HomeCatalog } from "@/components/HomeCatalog";
import { getProducts } from "@/lib/store";
import { listModelThumbs } from "@/lib/pattern-files";
import { isBundleEligible } from "@/lib/seed";
import { bundleStartingPriceUsd } from "@/lib/pricing";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Shop Custom Cut and Sew Merch | MOA Shop",
  description:
    "Browse custom styles cut and sewn to our own patterns: tees, hoodies, outerwear, headwear, totes and PR boxes. Built for smaller orders. Configure color, fabric and decoration, see your price as you go, and order with no quotes and no sales calls.",
  alternates: { canonical: "/shop" },
  openGraph: {
    title: "Shop MOA: custom cut and sew merch for smaller orders",
    description:
      "Pick a style cut and sewn to our own patterns, design it in 3D, and get your proof within 24 business hours. Transparent per-unit pricing, MOQ 50.",
  },
};

export default async function HomePage() {
  // Packaging assets are hidden (unpublished), so read the full catalog to price
  // the PR Box card's "from $X/box".
  const [products, modelThumbs, all] = await Promise.all([
    getProducts(),
    listModelThumbs(),
    getProducts({ includeDrafts: true }),
  ]);
  const bundleStartFromUsd = bundleStartingPriceUsd(
    all.filter(isBundleEligible),
    all.filter((p) => p.category === "packaging")
  );

  return (
    <main className="page">
      <section className="catalog-intro">
        <div className="catalog-intro-text">
          <p className="eyebrow">The MOA Shop</p>
          <h1 className="page-title">Fully custom merch, for smaller orders.</h1>
          <p className="lede">
            Every style is cut and sewn to our own patterns. Build your run by size, design it in 3D,
            and your proof arrives within 24 business hours. We produce it to spec and ship it to you.
            No quotes, no sales calls. The self-serve side of the studio brands trust for their best merch.
          </p>
        </div>
      </section>

      <HomeCatalog products={products} bundleStartFromUsd={bundleStartFromUsd} modelThumbs={modelThumbs} />

      <section className="value-strip" aria-label="How it works">
        <div className="value-card">
          <span className="value-num">01</span>
          <h3>No quotes, ever</h3>
          <p>One transparent price ladder per style. What you see is what you pay. No RFQs, no sales calls, one invoice.</p>
        </div>
        <div className="value-card">
          <span className="value-num">02</span>
          <h3>Proof in 24 business hours</h3>
          <p>See your mockup as you design. Our team reviews it and your proof arrives within 24 business hours. Approve it in your account. Nothing is made until you do.</p>
        </div>
        <div className="value-card">
          <span className="value-num">03</span>
          <h3>Cut and sewn to our patterns</h3>
          <p>Every style is cut and sewn to our own patterns, the same ones we produce for top brands. Curated, not an endless generic catalog.</p>
        </div>
        <div className="value-card">
          <span className="value-num">04</span>
          <h3>Tracked to your door</h3>
          <p>Live status from approval through production to delivery, with carrier tracking emailed the moment it ships.</p>
        </div>
      </section>
    </main>
  );
}
