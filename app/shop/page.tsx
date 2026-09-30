import { HomeCatalog } from "@/components/HomeCatalog";
import { getProducts } from "@/lib/store";
import { listModelThumbs } from "@/lib/pattern-files";
import { isBundleEligible } from "@/lib/seed";
import { bundleStartingPriceUsd } from "@/lib/pricing";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Shop Custom Cut and Sew Merch | MOA Shop",
  description:
    "Custom styles cut and sewn to our own patterns: tees, hoodies, outerwear, headwear and totes, in smaller runs. Choose colour, fabric and decoration and see your price as you go.",
  alternates: { canonical: "/shop" },
  openGraph: {
    title: "MOA Shop: custom cut and sew in smaller runs",
    description:
      "Pick a style cut and sewn to our own patterns, design it in 3D and get a proof within 24 business hours. Prices per unit, 50 piece minimum.",
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
          <h1 className="page-title">Custom cut and sew, in smaller runs.</h1>
          <p className="lede">
            Every style is cut and sewn to our own patterns. Build your run by size, design it in 3D and your proof arrives within 24 business hours. We make it to spec and ship it to you.
          </p>
        </div>
      </section>

      <HomeCatalog products={products} bundleStartFromUsd={bundleStartFromUsd} modelThumbs={modelThumbs} />

      <section className="value-strip" aria-label="How it works">
        <div className="value-card">
          <span className="value-num">01</span>
          <h3>Prices shown</h3>
          <p>One price ladder per style. What you see is what you pay. One invoice.</p>
        </div>
        <div className="value-card">
          <span className="value-num">02</span>
          <h3>Proof in 24 business hours</h3>
          <p>The mockup updates as you design. Our team reviews it and your proof arrives within 24 business hours. Nothing is made until you approve it.</p>
        </div>
        <div className="value-card">
          <span className="value-num">03</span>
          <h3>Cut and sewn to our patterns</h3>
          <p>Every style is cut and sewn to the patterns we produce for our clients. A short range, not a catalog of blanks.</p>
        </div>
        <div className="value-card">
          <span className="value-num">04</span>
          <h3>Tracked to your door</h3>
          <p>Status from approval to delivery. Carrier tracking by email when it ships.</p>
        </div>
      </section>
    </main>
  );
}
