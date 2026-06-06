import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PdpConfigurator } from "@/components/PdpConfigurator";
import { BoxBuilder } from "@/components/BoxBuilder";
import { currency } from "@/lib/pricing";
import { getProductBySlug, getProducts } from "@/lib/store";
import { isBundleEligible } from "@/lib/seed";
import { PR_BOX_PROMO, isPromoWithinWindow } from "@/lib/promo";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const product = await getProductBySlug(slug);
  if (!product) return { title: "MOA Catalog" };
  const cheapest = product.priceTiers[product.priceTiers.length - 1] ?? product.priceTiers[0];
  const title = `${product.displayName} · MOA Catalog`;
  const description = `${product.headline} From ${currency(cheapest.perUnitUsd)}/unit · MOQ ${product.moq} · ${product.variants.length} colors.`;
  const image = product.greyFront ?? product.variants.find((v) => v.frontImage)?.frontImage;
  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: "website",
      images: image ? [{ url: image, width: 1600, height: 2000, alt: product.displayName }] : undefined
    },
    twitter: {
      card: image ? "summary_large_image" : "summary",
      title,
      description,
      images: image ? [image] : undefined
    }
  };
}

export default async function ProductPage({
  params,
  searchParams
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ preview?: string }>;
}) {
  const { slug } = await params;
  const { preview } = await searchParams;
  const product = await getProductBySlug(slug);

  // Unpublished SKUs (e.g. the internal test SKU) render only with a valid
  // preview token, so they stay out of the public catalog but are reachable
  // for QA at /p/<slug>?preview=<CATALOG_PREVIEW_TOKEN>.
  const previewOk = Boolean(process.env.CATALOG_PREVIEW_TOKEN) && preview === process.env.CATALOG_PREVIEW_TOKEN;

  if (!product || (!product.isPublished && !previewOk)) {
    notFound();
  }

  // --- PR Box: this product's PDP IS the box builder ---
  if (product.isBundleBuilder) {
    const all = await getProducts({ includeDrafts: true });
    const eligible = all.filter(isBundleEligible).sort((a, b) => a.sortOrder - b.sortOrder);
    const packaging = all
      .filter((p) => p.category === "packaging")
      .sort((a, b) => a.sortOrder - b.sortOrder);
    return (
      <main className="page">
        <nav className="crumbs" aria-label="Breadcrumb">
          <Link href="/shop">Catalog</Link>
          <span aria-hidden>/</span>
          <span className="crumb-current">{product.displayName}</span>
        </nav>
        <BoxBuilder product={product} eligible={eligible} packaging={packaging} />
      </main>
    );
  }

  // --- SEO: Product + Breadcrumb structured data (rich snippets) ---
  const SITE = process.env.NEXT_PUBLIC_SITE_ORIGIN || "https://shop.magnumopus.agency";
  const prices = product.priceTiers.map((t) => t.perUnitUsd);
  const img = product.greyFront ?? product.variants.find((v) => v.frontImage)?.frontImage;
  const productLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.displayName,
    description: product.headline || product.description,
    sku: product.skuCode,
    category: product.category,
    brand: { "@type": "Brand", name: "Magnum Opus Agency" },
    ...(img ? { image: [img.startsWith("http") ? img : `${SITE}${img}`] } : {}),
    offers: {
      "@type": "AggregateOffer",
      priceCurrency: "USD",
      lowPrice: Math.min(...prices),
      highPrice: Math.max(...prices),
      offerCount: product.priceTiers.length,
      availability: "https://schema.org/InStock",
      seller: { "@type": "Organization", name: "Magnum Opus Agency" },
    },
  };
  const breadcrumbLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Catalog", item: SITE },
      { "@type": "ListItem", position: 2, name: product.category },
      { "@type": "ListItem", position: 3, name: product.displayName, item: `${SITE}/p/${product.slug}` },
    ],
  };

  return (
    <main className="page">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(productLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }} />
      <nav className="crumbs" aria-label="Breadcrumb">
        <Link href="/shop">Catalog</Link>
        <span aria-hidden>/</span>
        <span>{product.category}</span>
        <span aria-hidden>/</span>
        <span className="crumb-current">{product.skuCode}</span>
      </nav>

      <PdpConfigurator product={product} />

      {isPromoWithinWindow(PR_BOX_PROMO) ? (
        <Link href="/p/pr-box" className="pdp-prbox-nudge">
          <span className="pdp-prbox-nudge-text">Seeding {product.displayName} to press or influencers?</span>
          <b>Build it into a PR Box → save {Math.round(PR_BOX_PROMO.discount.value * 100)}%</b>
        </Link>
      ) : null}
    </main>
  );
}
