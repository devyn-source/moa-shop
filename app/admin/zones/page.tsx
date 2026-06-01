import { ZoneEditor } from "@/components/ZoneEditor";
import { getProducts } from "@/lib/store";

export const dynamic = "force-dynamic";

export default async function AdminZonesPage() {
  const products = await getProducts();
  const published = products.filter((p) => p.isPublished);

  return (
    <main className="page page--wide">
      <header className="ze-page-head">
        <div>
          <p className="eyebrow">Studio</p>
          <h1 className="page-title">Decoration Zones</h1>
          <p className="lede">
            Author every SKU's print/embroidery zones on the actual garment. Saved zones
            override the category defaults and feed straight into the PDP configurator.
          </p>
        </div>
      </header>

      <ZoneEditor products={published} />
    </main>
  );
}
