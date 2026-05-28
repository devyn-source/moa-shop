import { notFound } from "next/navigation";
import { Configurator } from "@/components/Configurator";
import { getProductBySlug } from "@/lib/store";

export default async function ConfigurePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const product = await getProductBySlug(slug);

  if (!product || !product.isPublished) {
    notFound();
  }

  return (
    <main className="page">
      <Configurator product={product} />
    </main>
  );
}
