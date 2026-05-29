"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useCart } from "@/components/CartProvider";

export default function CheckoutSuccessPage() {
  const { clear } = useCart();
  const [orderIds, setOrderIds] = useState<string[]>([]);

  useEffect(() => {
    const ids = new URLSearchParams(window.location.search).get("orders") ?? "";
    setOrderIds(ids.split(",").filter(Boolean));
    clear(); // payment succeeded — empty the cart
  }, [clear]);

  return (
    <main className="page">
      <div className="checkout-success panel">
        <div className="panel-pad">
          <p className="eyebrow">Payment received</p>
          <h1 className="page-title">You&apos;re all set</h1>
          <p className="lede">
            {orderIds.length || "Your"} {orderIds.length === 1 ? "order is" : "orders are"} confirmed. Each SKU runs as
            its own production order — MOA quality-checks the artwork before production, and you&apos;ll get tracking
            when it ships.
          </p>
          {orderIds.length ? (
            <div className="tier-list" style={{ marginTop: 16 }}>
              {orderIds.map((id) => (
                <Link key={id} href={`/orders/${id}`} className="tier-row">
                  <span>View order</span>
                  <strong>Track →</strong>
                </Link>
              ))}
            </div>
          ) : null}
          <div className="action-row">
            <Link href="/" className="button">Back to catalog</Link>
          </div>
        </div>
      </div>
    </main>
  );
}
