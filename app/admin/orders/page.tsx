import Link from "next/link";
import { OrderTracker } from "@/components/OrderTracker";
import { currency } from "@/lib/pricing";
import { getOrders, getProductById } from "@/lib/store";

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
      <p className="lede">Live status for every active production run — artwork QA, production, and shipping.</p>

      {rows.length ? (
        <section className="tracker-board">
          {rows.map(({ order, product }) => (
            <Link key={order.id} className="tracker-card" href={`/admin/orders/${order.id}`}>
              <header className="tracker-card-meta">
                <div>
                  <p className="eyebrow">{new Date(order.createdAt).toLocaleDateString()}</p>
                  <p className="tracker-card-meta__order">{order.orderNumber}</p>
                  <p className="tracker-card-meta__sub">{order.companyName} · {order.contactEmail}</p>
                </div>
                <div className="tracker-card-meta__right">
                  <p className="eyebrow">{product?.category ?? "Product"}</p>
                  <p className="tracker-card-meta__product">{product?.displayName ?? "Catalog product"}</p>
                  <p className="tracker-card-meta__total">{order.quantity.toLocaleString()} units · {currency(order.totalUsd)}</p>
                </div>
              </header>
              <div className="tracker-hero">
                <OrderTracker order={order} compact />
              </div>
            </Link>
          ))}
        </section>
      ) : (
        <section className="table-card" style={{ marginTop: 28 }}>
          <div className="empty-state">No orders yet. Create a test order from the public configurator.</div>
        </section>
      )}
    </main>
  );
}
