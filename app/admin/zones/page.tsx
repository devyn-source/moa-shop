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
          <h1 className="page-title">Decoration Zones</h1>
          <p className="lede">
            Author every SKU&apos;s print/embroidery zones <strong>on the 3D garment</strong> — the exact space the
            customer configures in. Boxes show real-inch sizes off the surface; saved zones override the
            category defaults and feed straight into the configurator.
          </p>
        </div>
      </header>

      <Zone3DEditorClient products={published} modelUrls={modelUrls} />
    </main>
  );
}
