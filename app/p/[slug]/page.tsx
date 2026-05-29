import Link from "next/link";
import { notFound } from "next/navigation";
import { ProductTop } from "@/components/ProductTop";
import { getProductBySlug } from "@/lib/store";

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

      <ProductTop product={product} />
    </main>
  );
}
