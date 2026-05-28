import { notFound } from "next/navigation";
import { Configurator } from "@/components/Configurator";
import { getProductBySlug } from "@/lib/store";

export default async function ConfigurePage({
  params,
  searchParams
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { slug } = await params;
  const search = await searchParams;
  const product = await getProductBySlug(slug);

  if (!product || !product.isPublished) {
    notFound();
  }

  const initialQty = (() => {
    const raw = search.qty;
    const value = Array.isArray(raw) ? raw[0] : raw;
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed >= product.moq ? parsed : product.moq;
  })();

  const initialSizes: Record<string, number> = {};
  for (const size of product.sizes) {
    const raw = search[`size_${size}`];
    const value = Array.isArray(raw) ? raw[0] : raw;
    const parsed = Number(value);
    if (Number.isFinite(parsed) && parsed > 0) initialSizes[size] = parsed;
  }

  return (
    <main className="page">
      <Configurator product={product} initialQuantity={initialQty} initialSizes={initialSizes} />
    </main>
  );
}
