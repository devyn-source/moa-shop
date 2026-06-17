import { notFound } from "next/navigation";
import Link from "next/link";
import { getProductBySlug } from "@/lib/store";
import { listPatternFilesSigned, getModelUrl } from "@/lib/pattern-files";
import AssetManager from "@/components/AssetManager";
import PatternCalibration from "@/components/PatternCalibration";
import Model3DCalibratorClient from "@/components/Model3DCalibratorClient";

export const dynamic = "force-dynamic";

export default async function AssetsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const product = await getProductBySlug(slug);
  if (!product) notFound();

  const [patternFiles, modelUrl] = await Promise.all([listPatternFilesSigned(slug), getModelUrl(slug)]);

  // Dedupe swatches by color label, preserving the SKU's hero-ordered palette.
  const seen = new Set<string>();
  const swatches = product.variants
    .filter((v) => v.colorHex && !seen.has(v.colorLabel) && seen.add(v.colorLabel))
    .map((v) => ({ label: v.colorLabel, hex: v.colorHex }));

  return (
    <main className="page">
      <nav className="crumbs" aria-label="Breadcrumb">
        <Link href="/admin">Admin</Link>
        <span aria-hidden>/</span>
        <Link href="/admin/assets">Assets</Link>
        <span aria-hidden>/</span>
        <span className="crumb-current">{product.skuCode}</span>
      </nav>
      <AssetManager
        slug={slug}
        displayName={product.displayName}
        skuCode={product.skuCode}
        initialPatternFiles={patternFiles}
        initialModelUrl={modelUrl}
        swatches={swatches}
      />
      <Model3DCalibratorClient slug={slug} hasModel={Boolean(modelUrl)} modelUrl={modelUrl} />
      <PatternCalibration slug={slug} hasDxf={patternFiles.some((f) => f.format === "dxf")} />
    </main>
  );
}
