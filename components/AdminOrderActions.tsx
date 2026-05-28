"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { OrderStatus, ShopOrder } from "@/lib/types";

const statuses: OrderStatus[] = [
  "artwork_qa",
  "awaiting_revision",
  "approved",
  "vendor_notified",
  "in_production",
  "shipped",
  "delivered",
  "cancelled"
];

export function AdminOrderActions({ order }: { order: ShopOrder }) {
  const router = useRouter();
  const [status, setStatus] = useState<OrderStatus>(order.status);
  const [note, setNote] = useState("");
  const [trackingCarrier, setTrackingCarrier] = useState(order.trackingCarrier ?? "");
  const [trackingNumber, setTrackingNumber] = useState(order.trackingNumber ?? "");
  const [submitting, setSubmitting] = useState(false);

  async function update() {
    setSubmitting(true);
    await fetch(`/api/admin/orders/${order.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        status,
        note: note || `Status updated to ${status}`,
        trackingCarrier,
        trackingNumber
      })
    });
    setSubmitting(false);
    router.refresh();
  }

  return (
    <div className="panel panel-pad">
      <p className="eyebrow">Amanda Actions</p>
      <div className="form-grid">
        <label className="field full">
          <span className="label">Status</span>
          <select value={status} onChange={(event) => setStatus(event.target.value as OrderStatus)}>
            {statuses.map((item) => (
              <option value={item} key={item}>
                {item.replace(/_/g, " ")}
              </option>
            ))}
          </select>
        </label>
        <label className="field full">
          <span className="label">Operator note</span>
          <textarea value={note} onChange={(event) => setNote(event.target.value)} />
        </label>
        <label className="field">
          <span className="label">Tracking carrier</span>
          <input value={trackingCarrier} onChange={(event) => setTrackingCarrier(event.target.value)} />
        </label>
        <label className="field">
          <span className="label">Tracking number</span>
          <input value={trackingNumber} onChange={(event) => setTrackingNumber(event.target.value)} />
        </label>
      </div>
      <div className="action-row">
        <button className="button" type="button" disabled={submitting} onClick={update}>
          {submitting ? "Updating..." : "Update order"}
        </button>
      </div>
    </div>
  );
}
