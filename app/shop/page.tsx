import { BespokeLine } from "@/components/hx/Bespoke";
import { PageHero } from "@/components/hx/PageHero";
import { StyleTiles } from "@/components/hx/StyleTiles";
import { HowRows } from "@/components/hx/HowRows";
import { ScrollReveal } from "@/components/landing/ScrollReveal";
import { currency } from "@/lib/pricing";
import { getProducts } from "@/lib/store";
import { listModelThumbs } from "@/lib/pattern-files";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Shop Custom Cut and Sew Merch | MOA Shop",
  description:
    "Custom styles cut and sewn to our own patterns: tees, hoodies, outerwear, headwear and totes, in smaller runs. Choose colour, fabric and decoration and see your price as you go.",
  alternates: { canonical: "/shop" },
  openGraph: {
    title: "MOA Shop: custom cut and sew in smaller runs",
    description:
      "Pick a style cut and sewn to our own patterns, design it on the garment and get a proof by the next business day. Prices per unit, 50 piece minimum.",
  },
};

export default async function HomePage() {
  const [all, modelThumbs] = await Promise.all([getProducts(), listModelThumbs()]);
  const products = all.filter((p) => !p.isBundleBuilder && p.category !== "packaging" && p.slug !== "test-sku");

  return (
    <main className="hx">
      <ScrollReveal />
      <PageHero title="The styles">
        <p className="hx-body">Every style is cut and sewn to our own patterns. Design it on the garment, pay at checkout and review your proof by the next business day.</p>
        <dl className="hx-facts">
          <div><dt>Piece minimum</dt><dd>{Math.min(...products.map((p) => p.moq))}</dd></div>
          <div><dt>Proof turnaround</dt><dd>24 hr</dd></div>
          <div><dt>From, per unit</dt><dd>{currency(Math.min(...products.flatMap((p) => p.priceTiers.map((t) => t.perUnitUsd))))}</dd></div>
        </dl>
      </PageHero>

      <section className="hx-row hx-row--tight">
        <StyleTiles products={products} thumbs={modelThumbs} />
      </section>

      <HowRows />
      <section className="hx-row"><BespokeLine from="shop" /></section>
      <div className="hx-row hx-endpad" />
    </main>
  );
}
