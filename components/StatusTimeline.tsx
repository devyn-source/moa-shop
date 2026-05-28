import type { OrderStatus, ShopOrder } from "@/lib/types";

const steps: OrderStatus[] = [
  "artwork_qa",
  "approved",
  "vendor_notified",
  "in_production",
  "shipped",
  "delivered"
];

// Customer-facing labels + copy. Internal status enum stays the same.
const STEP_LABEL: Record<string, string> = {
  artwork_qa: "Artwork QA",
  approved: "Approved",
  vendor_notified: "Scheduled",
  in_production: "In production",
  shipped: "Shipped",
  delivered: "Delivered"
};

const STEP_COPY: Record<string, string> = {
  artwork_qa: "MOA verifies the mockup, art placement, and production readiness.",
  approved: "Artwork is approved and queued for production.",
  vendor_notified: "Your order is confirmed and scheduled into production.",
  in_production: "Your order is being produced.",
  shipped: "Tracking has been issued.",
  delivered: "Order is complete."
};

export function StatusTimeline({ order }: { order: ShopOrder }) {
  const currentIndex = steps.indexOf(order.status);

  return (
    <div className="timeline">
      {steps.map((step, index) => {
        const done = currentIndex > index || order.status === "delivered";
        const active = order.status === step;
        return (
          <div className={`timeline-item ${done ? "done" : ""} ${active ? "active" : ""}`} key={step}>
            <span className="dot" />
            <div>
              <strong>{STEP_LABEL[step] ?? step}</strong>
              <p style={{ margin: "4px 0 0", color: "var(--muted)" }}>{STEP_COPY[step] ?? ""}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
