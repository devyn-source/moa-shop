import Link from "next/link";
import { notFound } from "next/navigation";
import { getProductBySlug } from "@/lib/store";
import { getModelUrl } from "@/lib/pattern-files";
import { getDefaultZones } from "@/lib/zones";
import Garment3DDecoratorClient from "@/components/Garment3DDecoratorClient";

// Hidden Phase-1 test harness for the 3D artwork decorator (noindex via robots).
// Loads the SKU's GLB + a sample logo so we can prove decal placement + UV
// capture before wiring it into the real configurator placement step.
export const dynamic = "force-dynamic";

export default async function StudioDecalPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const product = await getProductBySlug(slug);
  if (!product) notFound();
  const modelUrl = await getModelUrl(slug);

  return (
    <main className="page studio3d-page">
      <div className="studio3d-head">
        <p className="eyebrow">3D Decorator · Phase 1 test</p>
        <h1 className="page-title">{product.displayName}</h1>
      </div>

      {modelUrl ? (
        <Garment3DDecoratorClient url={modelUrl} artUrl="/woven-label.png" hex="#C9C4B8" zones={getDefaultZones(product).front} backZones={getDefaultZones(product).back} />
      ) : (
        <div className="studio3d-empty">
          No 3D model for <code>{slug}</code>. Upload a GLB at <code>/admin/assets/{slug}</code>.
        </div>
      )}

      <p className="studio3d-note">
        Tap the garment to place the sample art · drag to move · sliders to size/rotate. <Link href={`/p/${slug}`}>← product</Link>
      </p>
    </main>
  );
}
