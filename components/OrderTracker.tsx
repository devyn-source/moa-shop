import type { OrderStatus, ShopOrder } from "@/lib/types";

type Stage = {
  key: string;
  label: string;
  headline: string;
  copy: string;
  statuses: OrderStatus[];
};

// The internal 10-status lifecycle, collapsed into 5 client-facing stages.
const STAGES: Stage[] = [
  {
    key: "placed",
    label: "Order Placed",
    headline: "We've got your order",
    copy: "Your order is confirmed. MOA is opening your production file.",
    statuses: ["awaiting_payment", "paid"]
  },
  {
    key: "qa",
    label: "Artwork QA",
    headline: "Your artwork is in QA",
    copy: "MOA is checking your art placement, mockup, and production readiness.",
    statuses: ["artwork_qa", "awaiting_revision"]
  },
  {
    key: "production",
    label: "In Production",
    headline: "Your order is in production",
    copy: "Artwork is approved and your run is being made to spec.",
    statuses: ["approved", "vendor_notified", "in_production"]
  },
  {
    key: "shipped",
    label: "Shipped",
    headline: "Your order is on the way",
    copy: "Your order has left the floor and tracking has been issued.",
    statuses: ["shipped"]
  },
  {
    key: "delivered",
    label: "Delivered",
    headline: "Your order has landed",
    copy: "Your order is complete. Thanks for building with MOA.",
    statuses: ["delivered"]
  }
];

function activeStageIndex(status: OrderStatus): number {
  const i = STAGES.findIndex((s) => s.statuses.includes(status));
  return i === -1 ? 0 : i;
}

function formatStamp(iso?: string): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  });
}

export function OrderTracker({ order, compact = false }: { order: ShopOrder; compact?: boolean }) {
  if (order.status === "cancelled") {
    return (
      <div className={`tracker-cancelled${compact ? " tracker-cancelled--compact" : ""}`}>
        <p className="tracker-eyebrow">Order status</p>
        <h2 className="tracker-headline">This order was cancelled</h2>
        <p className="tracker-subline">Reach out to your MOA contact if this looks wrong.</p>
      </div>
    );
  }

  const current = activeStageIndex(order.status);
  const stage = STAGES[current];
  const latest = order.statusLog[order.statusLog.length - 1];
  const stamp = formatStamp(latest?.createdAt) ?? formatStamp(order.updatedAt);

  return (
    <div className={`tracker${compact ? " tracker--compact" : ""}`}>
      <ol className="tracker-rail">
        {STAGES.map((s, index) => {
          const state = index < current ? "done" : index === current ? "active" : "todo";
          return (
            <li key={s.key} className={`tracker-seg tracker-seg--${state}`}>
              <span className="tracker-seg__inner">
                <span className="tracker-seg__num">{index + 1}</span>
                <span className="tracker-seg__label">{s.label}</span>
              </span>
            </li>
          );
        })}
      </ol>

      <div className="tracker-status">
        <h2 className="tracker-headline">{stage.headline}</h2>
        <p className="tracker-subline">
          {stage.copy}
          {stamp ? <span className="tracker-stamp"> · Updated {stamp}</span> : null}
        </p>
        {order.status === "shipped" && order.trackingNumber ? (
          <p className="tracker-tracking">
            {order.trackingCarrier} · {order.trackingNumber}
          </p>
        ) : null}
      </div>
    </div>
  );
}
