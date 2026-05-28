import { notFound } from "next/navigation";
import { ProductEditor } from "@/components/ProductEditor";
import { currency } from "@/lib/pricing";
import { getProductBySlug } from "@/lib/store";

export default async function AdminCatalogDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const product = await getProductBySlug(id);

  if (!product) {
    notFound();
  }

  return (
    <main className="page">
      <p className="eyebrow">Catalog SKU</p>
      <h1 className="page-title" style={{ fontSize: "clamp(44px, 7vw, 92px)" }}>
        {product.displayName}
      </h1>
      <p className="lede">Edit top-level launch data. Variant/decorator/pricing table editors are next-phase admin depth.</p>

      <section className="config-shell" style={{ marginTop: 42 }}>
        <ProductEditor product={product} />
        <aside className="panel panel-pad">
          <p className="eyebrow">Current Pricing</p>
          {product.priceTiers.map((tier) => (
            <div className="price-line" key={tier.minQty}>
              <span>
                {tier.minQty}
                {tier.maxQty ? `-${tier.maxQty}` : "+"}
              </span>
              <strong>{currency(tier.perUnitUsd)}/unit</strong>
            </div>
          ))}
          <p className="eyebrow" style={{ marginTop: 30 }}>
            Mockup Slots
          </p>
          {product.variants.map((variant) => (
            <div className="price-line" key={variant.id}>
              <span>{variant.colorLabel}</span>
              <strong>{variant.mockupTemplateUrl}</strong>
            </div>
          ))}
        </aside>
      </section>
    </main>
  );
}
