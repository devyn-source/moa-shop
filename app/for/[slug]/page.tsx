import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ProductCard } from "@/components/ProductCard";
import { getProducts } from "@/lib/store";
import { listModelThumbs } from "@/lib/pattern-files";
import { USE_CASES, getUseCase, getKit } from "@/lib/use-cases";

export function generateStaticParams() {
  return USE_CASES.map((u) => ({ slug: u.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const uc = getUseCase(slug);
  if (!uc) return { title: "MOA Catalog" };
  const title = `${uc.headline} · MOA Catalog`;
  return {
    title,
    description: uc.subcopy,
    alternates: { canonical: `/for/${uc.slug}` },
    openGraph: { title, description: uc.subcopy, type: "website" },
    twitter: { card: "summary_large_image", title, description: uc.subcopy }
  };
}

export default async function UseCasePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const uc = getUseCase(slug);
  if (!uc) notFound();

  const kit = getKit(uc.kitId);
  const products = await getProducts();
  const modelThumbs = await listModelThumbs();
  const kitProducts = (kit?.components ?? [])
    .map((c) => products.find((p) => p.id === c.productId))
    .filter(Boolean) as NonNullable<ReturnType<typeof products.find>>[];
  const featured = kitProducts.length
    ? kitProducts
    : products.filter((p) => uc.featuredCategories.includes(p.category)).slice(0, 6);
  const builderHref = `/p/pr-box?kit=${uc.kitId}`;

  return (
    <main className="page">
      <nav className="crumbs" aria-label="Breadcrumb">
        <Link href="/shop">Catalog</Link>
        <span aria-hidden>/</span>
        <span className="crumb-current">{uc.navLabel}</span>
      </nav>

      <section className="uc-hero">
        <p className="eyebrow">{uc.eyebrow}</p>
        <h1 className="uc-headline">{uc.headline}</h1>
        <p className="uc-sub">{uc.subcopy}</p>
        <p className="uc-frame">“{uc.frame}”</p>
        <div className="uc-cta-row">
          <Link href={builderHref} className="button button--lg">{uc.ctaLabel} →</Link>
          <Link href="/shop" className="ghost-button">Browse all products</Link>
        </div>
        <ul className="uc-proof">
          {uc.proof.map((pt) => (
            <li key={pt}>{pt}</li>
          ))}
        </ul>
      </section>

      <section className="uc-kit">
        <div className="section-head">
          <div>
            <p className="eyebrow">In the {kit ? kit.name.toLowerCase() : "box"}</p>
            <h2>What it ships with</h2>
          </div>
          <Link href={builderHref} className="link-button">Customize the box →</Link>
        </div>
        <div className="catalog-grid">
          {featured.map((p) => (
            <ProductCard key={p.id} product={p} modelThumbUrl={modelThumbs[p.slug]} />
          ))}
        </div>
      </section>

      <section className="uc-bottom">
        <p className="uc-bottom-head">Build it in minutes — no quotes, no sales calls.</p>
        <Link href={builderHref} className="button button--lg">{uc.ctaLabel} →</Link>
      </section>
    </main>
  );
}
