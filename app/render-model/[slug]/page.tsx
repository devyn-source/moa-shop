import { notFound } from "next/navigation";
import { getProductBySlug } from "@/lib/store";
import { getModelUrl } from "@/lib/pattern-files";
import Garment3DClient from "@/components/Garment3DClient";

// Hidden, full-bleed single-model render (noindex) used to capture the product
// thumbnail (the 3D "product photo"). No UI — just the model on cream, in the
// SKU's hero color, so the canvas can be snapshotted to a still.
export const dynamic = "force-dynamic";

export default async function RenderModelPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const product = await getProductBySlug(slug);
  if (!product) notFound();
  const modelUrl = await getModelUrl(slug);
  if (!modelUrl) notFound();
  const hero =
    product.variants.find((v) => v.colorLabel === "Black" && v.recolor !== false) ?? product.variants[0];

  return (
    <main className="render-model">
      <Garment3DClient url={modelUrl} hex={hero?.colorHex} showSwatches={false} swatches={[]} fit={1.35} showShadow={false} />
    </main>
  );
}
