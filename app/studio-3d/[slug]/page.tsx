import fs from "node:fs";
import path from "node:path";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getProductBySlug } from "@/lib/store";
import Garment3DClient from "@/components/Garment3DClient";

// Hidden 3D configurator preview (noindex via robots). One SKU per route.
// Reads /public/models/<slug>.glb produced by Meshy / scan / CLO.
export const dynamic = "force-dynamic";

export default async function Studio3DPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const product = await getProductBySlug(slug);
  if (!product) notFound();

  const hasModel = fs.existsSync(path.join(process.cwd(), "public", "models", `${slug}.glb`));

  // dedupe swatches by color label, preserve the SKU's hero-ordered palette
  const seen = new Set<string>();
  const swatches = product.variants
    .filter((v) => v.colorHex && !seen.has(v.colorLabel) && seen.add(v.colorLabel))
    .map((v) => ({ label: v.colorLabel, hex: v.colorHex }));

  return (
    <main className="page studio3d-page">
      <div className="studio3d-head">
        <p className="eyebrow">3D Studio · Preview</p>
        <h1 className="page-title">{product.displayName}</h1>
      </div>

      {hasModel ? (
        <Garment3DClient url={`/models/${slug}.glb?v=2`} swatches={swatches} />
      ) : (
        <div className="studio3d-empty">
          No 3D model yet for <code>{slug}</code>. Drop <code>public/models/{slug}.glb</code> and reload.
        </div>
      )}

      <p className="studio3d-note">
        Drag to rotate · scroll to zoom · pick a color. <Link href={`/p/${slug}`}>← back to product</Link>
      </p>
    </main>
  );
}
