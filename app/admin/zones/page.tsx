import Zone3DEditorClient from "@/components/Zone3DEditorClient";
import { getProducts } from "@/lib/store";
import { getModelUrl } from "@/lib/pattern-files";

export const dynamic = "force-dynamic";

export default async function AdminZonesPage() {
  const products = await getProducts();
  const published = products.filter((p) => p.isPublished);
  // GLB per SKU so zones are authored on the actual 3D garment (the same space
  // the customer configures in).
  const modelUrls = Object.fromEntries(
    await Promise.all(published.map(async (p) => [p.slug, await getModelUrl(p.slug)] as const))
  );

  return (
    <main className="page page--wide">
      <header className="ze-page-head">
        <div>
          <p className="eyebrow">Studio</p>
          <h1 className="page-title">Garment Studio</h1>
          <p className="lede">
            Calibrate and place — on one 3D garment. <strong>1 · Calibrate</strong> sets the real-inch ruler
            (drag the HPS/hem lines or Auto-fit), then <strong>2 · Zones</strong> places the print areas. Both
            read off the same surface and feed straight into the customer&apos;s configurator.
          </p>
        </div>
      </header>

      <Zone3DEditorClient products={published} modelUrls={modelUrls} />
    </main>
  );
}
