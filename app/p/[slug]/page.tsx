import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PdpConfigurator } from "@/components/PdpConfigurator";
import { currency } from "@/lib/pricing";
import { getProductBySlug } from "@/lib/store";

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

export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const product = await getProductBySlug(slug);

  if (!product || !product.isPublished) {
    notFound();
  }

  return (
    <main className="page">
      <nav className="crumbs" aria-label="Breadcrumb">
        <Link href="/">Catalog</Link>
        <span aria-hidden>/</span>
        <span>{product.category}</span>
        <span aria-hidden>/</span>
        <span className="crumb-current">{product.skuCode}</span>
      </nav>

      <PdpConfigurator product={product} />
    </main>
  );
}
