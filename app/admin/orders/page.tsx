import Link from "next/link";
import { currency } from "@/lib/pricing";
import { getOrders, getProductById, statusLabel } from "@/lib/store";

export default async function AdminOrdersPage() {
  const orders = await getOrders();
  const rows = await Promise.all(
    orders.map(async (order) => ({
      order,
      product: await getProductById(order.productId)
    }))
  );

  return (
    <main className="page">
      <p className="eyebrow">Orders</p>
      <h1 className="page-title">Order Queue</h1>
      <p className="lede">Artwork QA, revision requests, production scheduling, and shipment confirmation.</p>

      <section className="table-card" style={{ marginTop: 42 }}>
        {rows.length ? (
          <table className="data-table">
            <thead>
              <tr>
                <th>Order</th>
                <th>Customer</th>
                <th>Product</th>
                <th>Status</th>
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ order, product }) => (
                <tr key={order.id}>
                  <td>
                    <Link href={`/admin/orders/${order.id}`}>
                      <strong>{order.orderNumber}</strong>
                    </Link>
                    <br />
                    {new Date(order.createdAt).toLocaleDateString()}
                  </td>
                  <td>
                    {order.companyName}
                    <br />
                    <span style={{ color: "var(--muted)" }}>{order.contactEmail}</span>
                  </td>
                  <td>
                    {product?.displayName ?? "Catalog product"}
                    <br />
                    <span style={{ color: "var(--muted)" }}>{order.quantity.toLocaleString()} units</span>
                  </td>
                  <td>
                    <span className="status-pill">{statusLabel(order.status)}</span>
                  </td>
                  <td>{currency(order.totalUsd)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="empty-state">No orders yet. Create a test order from the public configurator.</div>
        )}
      </section>
    </main>
  );
}
