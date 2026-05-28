import Link from "next/link";
import { NewProductForm } from "@/components/NewProductForm";
import { currency, formatLeadTime } from "@/lib/pricing";
import { getProducts } from "@/lib/store";

export default async function AdminCatalogPage() {
  const products = await getProducts({ includeDrafts: true });

  return (
    <main className="page">
      <p className="eyebrow">Catalog</p>
      <h1 className="page-title">Product Control</h1>
      <p className="lede">Author launch SKUs, publish products, and maintain deterministic pricing.</p>

      <section style={{ marginTop: 42 }}>
        <NewProductForm />
      </section>

      <section className="table-card" style={{ marginTop: 22 }}>
        <table className="data-table">
          <thead>
            <tr>
              <th>Product</th>
              <th>Pricing</th>
              <th>MOQ / Lead</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {products.map((product) => (
              <tr key={product.id}>
                <td>
                  <Link href={`/admin/catalog/${product.slug}`}>
                    <strong>{product.displayName}</strong>
                  </Link>
                  <br />
                  <span style={{ color: "var(--muted)" }}>{product.bestFor}</span>
                </td>
                <td>
                  {product.priceTiers.map((tier) => (
                    <div key={tier.minQty}>
                      {tier.minQty}
                      {tier.maxQty ? `-${tier.maxQty}` : "+"}: {currency(tier.perUnitUsd)}
                    </div>
                  ))}
                </td>
                <td>
                  {product.moq} units
                  <br />
                  {formatLeadTime(product.leadTimeDays)}
                </td>
                <td>
                  <span className="status-pill">{product.isPublished ? "published" : "draft"}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </main>
  );
}
