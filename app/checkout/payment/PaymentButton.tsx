"use client";

import { useRef, useState } from "react";

export function PaymentButton({ checkoutId, token }: { checkoutId: string; token: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const pending = useRef(false);
  async function pay() {
    if (pending.current) return;
    pending.current = true; setBusy(true); setError("");
    try {
      const res = await fetch("/api/checkout/sandbox-pay", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ checkoutId, token }) });
      const data = await res.json();
      if (!res.ok || !data.url) throw new Error(data.error || "Could not confirm the test payment. Please try again.");
      window.location.assign(data.url);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Connection interrupted. Please try again.");
      pending.current = false; setBusy(false);
    }
  }
  return <><button className="button button--lg button--full" onClick={pay} disabled={busy}>{busy ? "Confirming test payment…" : "Confirm test payment"}</button>{error ? <p className="co-error" role="alert">{error}</p> : null}</>;
}
