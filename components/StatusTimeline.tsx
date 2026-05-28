import { statusLabel } from "@/lib/store";
import type { OrderStatus, ShopOrder } from "@/lib/types";

const steps: OrderStatus[] = [
  "artwork_qa",
  "approved",
  "vendor_notified",
  "in_production",
  "shipped",
  "delivered"
];

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
              <strong>{statusLabel(step)}</strong>
              <p style={{ margin: "4px 0 0", color: "var(--muted)" }}>
                {step === "artwork_qa" ? "Amanda verifies mockup, art placement, and production readiness." : null}
                {step === "approved" ? "Artwork is approved and ready to notify the locked vendor." : null}
                {step === "vendor_notified" ? "Vendor receives order summary, artwork link, and ship-to information." : null}
                {step === "in_production" ? "Factory is producing the order." : null}
                {step === "shipped" ? "Tracking has been issued." : null}
                {step === "delivered" ? "Order is complete." : null}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
