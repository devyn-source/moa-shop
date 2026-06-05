import Link from "next/link";
import { redirect } from "next/navigation";
import { currentUser } from "@clerk/nextjs/server";
import { getOrdersByEmail, getProducts, statusLabel } from "@/lib/store";
import { currency } from "@/lib/pricing";

export const dynamic = "force-dynamic";

export default async function OrdersPage() {
  const user = await currentUser();
  const email = user?.primaryEmailAddress?.emailAddress;
  if (!email) {
    redirect("/sign-in");
  }

  const [orders, products] = await Promise.all([getOrdersByEmail(email), getProducts({ includeDrafts: true })]);
  const nameById = new Map(products.map((p) => [p.id, p.displayName]));

  return (
    <main className="page">
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
        <div>
          <p className="eyebrow" style={{ color: "var(--color-terracotta)" }}>Your account</p>
          <h1
            style={{
              fontFamily: "var(--font-display)",
              fontWeight: 800,
              fontSize: "1.8rem",
              letterSpacing: "0.5px",
              textTransform: "uppercase",
              color: "var(--color-charcoal)",
              margin: "6px 0 0"
            }}
          >
            Your orders
          </h1>
          <p style={{ fontSize: 13, color: "var(--color-neutral)", margin: "6px 0 0" }}>{email}</p>
        </div>
      </div>

      {orders.length === 0 ? (
        <div className="empty-state" style={{ marginTop: 28 }}>
          No orders under this email yet.{" "}
          <Link href="/" style={{ color: "var(--color-terracotta)" }}>Browse the catalog →</Link>
        </div>
      ) : (
        <div style={{ marginTop: 24, display: "grid", gap: 12 }}>
          {orders.map((order) => (
            <Link key={order.id} href={`/orders/${order.id}`} style={card}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 16, alignItems: "flex-start" }}>
                <div>
                  <p style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 14, letterSpacing: "0.4px", textTransform: "uppercase", margin: 0, color: "var(--color-charcoal)" }}>
                    {nameById.get(order.productId) ?? "Catalog product"}
                  </p>
                  <p style={{ fontSize: 12, color: "var(--color-neutral)", margin: "4px 0 0" }}>
                    {order.orderNumber} · {order.quantity.toLocaleString()} units · {new Date(order.createdAt).toLocaleDateString()}
                  </p>
                </div>
                <span style={badge}>{statusLabel(order.status)}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 14 }}>
                <span style={{ fontFamily: "var(--font-display)", fontWeight: 700, color: "var(--color-terracotta)", fontSize: 15 }}>
                  {currency(order.totalUsd)}
                </span>
                <span style={{ fontSize: 11, letterSpacing: "1.5px", textTransform: "uppercase", color: "var(--color-neutral)" }}>
                  Track →
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}

const card: React.CSSProperties = {
  display: "block", background: "#fff", border: "1px solid var(--color-cream-dark)",
  borderRadius: 12, padding: "18px 20px", textDecoration: "none"
};
const badge: React.CSSProperties = {
  fontSize: 10, fontWeight: 700, letterSpacing: "1.5px", textTransform: "uppercase",
  color: "var(--color-charcoal)", background: "var(--color-cream)", border: "1px solid var(--color-cream-dark)",
  borderRadius: 999, padding: "5px 11px", whiteSpace: "nowrap"
};
