import Link from "next/link";
import { currency } from "@/lib/pricing";
import { getOrders, getProducts } from "@/lib/store";
import { statusLabel } from "@/lib/store";

export default async function AdminPage() {
  const [orders, products] = await Promise.all([getOrders(), getProducts({ includeDrafts: true })]);
  const openOrders = orders.filter((order) => !["shipped", "delivered", "cancelled"].includes(order.status));
  const revenue = orders.reduce((sum, order) => sum + order.totalUsd, 0);
  const publishedCount = products.filter((product) => product.isPublished).length;
  const recent = orders.slice(0, 5);

  return (
    <main className="page">
      <p className="eyebrow">Operator Console</p>
      <h1 className="page-title">MOA Catalog Admin</h1>
      <p className="lede">
        MVP admin is intentionally unlocked. Clerk role gating drops in once credentials are provisioned.
      </p>

      <section className="stat-grid">
        <Link className="stat-card" href="/admin/orders">
          <span className="stat-label">Open orders</span>
          <strong className="stat-value">{openOrders.length}</strong>
          <span className="stat-sub">Artwork QA → vendor → production → shipping</span>
        </Link>
        <Link className="stat-card" href="/admin/catalog">
          <span className="stat-label">Catalog SKUs</span>
          <strong className="stat-value">{products.length}</strong>
          <span className="stat-sub">{publishedCount} published · {products.length - publishedCount} draft</span>
        </Link>
        <div className="stat-card">
          <span className="stat-label">Simulated revenue</span>
          <strong className="stat-value">{currency(revenue)}</strong>
          <span className="stat-sub">From local MVP checkout simulations</span>
        </div>
        <Link className="stat-card" href="/admin/vendors">
          <span className="stat-label">Vendor desks</span>
          <strong className="stat-value">2</strong>
          <span className="stat-sub">Apparel + headwear partners</span>
        </Link>
      </section>

      <section className="info-section">
        <div className="section-head">
          <h2>Recent orders</h2>
          <Link href="/admin/orders" className="ghost-button">View all →</Link>
        </div>
        {recent.length === 0 ? (
          <div className="empty-state">
            No orders yet. Submit a configurator order from the catalog to populate this list.
          </div>
        ) : (
          <div className="table-card">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Order</th>
                  <th>Company</th>
                  <th>Status</th>
                  <th>Total</th>
                  <th>Created</th>
                </tr>
              </thead>
              <tbody>
                {recent.map((order) => (
                  <tr key={order.id}>
                    <td>
                      <Link href={`/admin/orders/${order.id}`}>{order.orderNumber}</Link>
                    </td>
                    <td>{order.companyName}</td>
                    <td>
                      <span className="status-pill">{statusLabel(order.status)}</span>
                    </td>
                    <td><b>{currency(order.totalUsd)}</b></td>
                    <td>{new Date(order.createdAt).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}
