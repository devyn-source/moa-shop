import type { Metadata } from "next";
import { getProducts } from "@/lib/store";
import { SampleKitForm } from "@/components/SampleKitForm";

const SITE = process.env.NEXT_PUBLIC_SITE_ORIGIN || "https://shop.magnumopus.agency";

export const metadata: Metadata = {
  title: "Request a Sample Kit · MOA Catalog",
  description:
    "Feel the blanks before you commit. Request a sample kit of MOA Catalog production-grade garments — heavyweight tees, fleece, outerwear and headwear with all three decoration methods demonstrated.",
  alternates: { canonical: `${SITE}/samples` },
  openGraph: {
    title: "Request a Sample Kit · MOA Catalog",
    description: "Feel the production-grade blanks and decoration quality before you order.",
    url: `${SITE}/samples`,
  },
};

export default async function SamplesPage({
  searchParams,
}: {
  searchParams?: Promise<{ sku?: string }>;
}) {
  const params = (await searchParams) ?? {};
  const products = await getProducts().catch(() => []);
  const options = products
    .filter((p) => p.isPublished)
    .map((p) => ({ slug: p.slug, name: p.displayName }));

  return (
    <main className="page">
      <header className="faq-page-head">
        <p className="eyebrow">MOA Catalog</p>
        <h1 className="page-title">Request a sample kit</h1>
        <p className="lede">
          The quality is the pitch — so feel it first. Tell us what you&apos;re considering and we&apos;ll
          ship a kit of the actual production blanks, each demonstrating our decoration methods:
          screen print, embroidery and woven labels. No sales call required.
        </p>
      </header>
      <SampleKitForm
        options={options}
        initialSelected={options.some((o) => o.slug === params.sku) ? [params.sku as string] : undefined}
      />
    </main>
  );
}
