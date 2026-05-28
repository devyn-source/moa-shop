import { notFound } from "next/navigation";
import { AdminOrderActions } from "@/components/AdminOrderActions";
import { StatusTimeline } from "@/components/StatusTimeline";
import { currency } from "@/lib/pricing";
import { getOrderById, getProductById, getVendors, statusLabel } from "@/lib/store";

export default async function AdminOrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const order = await getOrderById(id);

  if (!order) {
    notFound();
  }

  const product = await getProductById(order.productId);
  const vendors = await getVendors();
  const vendor = vendors.find((item) => item.id === product?.defaultVendorId);

  return (
    <main className="page">
      <p className="eyebrow">Order Detail</p>
      <h1 className="page-title" style={{ fontSize: "clamp(44px, 7vw, 92px)" }}>
        {order.orderNumber}
      </h1>
      <p className="lede">
        {order.companyName} · {statusLabel(order.status)}
      </p>

      <section className="config-shell" style={{ marginTop: 42 }}>
        <div className="panel panel-pad">
          <h2>Order Summary</h2>
          <div className="order-line">
            <span>Product</span>
            <strong>{product?.displayName ?? "Catalog product"}</strong>
          </div>
          <div className="order-line">
            <span>Vendor</span>
            <strong>{vendor?.name ?? "Unassigned"}</strong>
          </div>
          <div className="order-line">
            <span>Quantity</span>
            <strong>{order.quantity.toLocaleString()} units</strong>
          </div>
          <div className="order-line">
            <span>Artwork</span>
            <strong>{order.artworkFileName}</strong>
          </div>
          <div className="order-line">
            <span>Total paid</span>
            <strong>{currency(order.totalUsd)}</strong>
          </div>
          <h2 style={{ marginTop: 34 }}>Timeline</h2>
          <StatusTimeline order={order} />
        </div>
        <AdminOrderActions order={order} />
      </section>
    </main>
  );
}
