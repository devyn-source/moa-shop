// Shared configuration — a /c/<id> link opens the configurator pre-filled from a
// saved config (no order yet). The CTA adds it to the cart normally. PUBLIC.
import { notFound } from "next/navigation";
import { getProductBySlug } from "@/lib/store";
import { getModelUrl } from "@/lib/pattern-files";
import { getSharedConfig } from "@/lib/shared-config";
import { PdpConfigurator, type EditSeed } from "@/components/PdpConfigurator";

export const dynamic = "force-dynamic";

export default async function SharedConfigPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const shared = await getSharedConfig(id);
  if (!shared) notFound();
  const product = await getProductBySlug(shared.slug);
  if (!product) notFound();

  const seed = shared.config as EditSeed;
  const modelUrl = await getModelUrl(product.slug);

  return (
    <main className="page">
      <div className="config-head" style={{ marginBottom: 12 }}>
        <p className="eyebrow" style={{ color: "var(--color-terracotta)" }}>Shared configuration</p>
        <h1 className="page-title">{product.displayName}</h1>
        <p className="lede">
          Someone shared this configuration with you. Review it, make any changes, and add it to your order — nothing is produced until a proof is approved.
        </p>
      </div>
      <PdpConfigurator product={product} seed={seed} modelUrl={modelUrl} />
    </main>
  );
}
