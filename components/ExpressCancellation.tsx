"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export function ExpressCancellation({ number, retry = false }: { number: string; retry?: boolean }) {
  const router = useRouter();
  const [confirm, setConfirm] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState("");
  async function cancel() {
    if (busy) return;
    setBusy(true); setError("");
    try {
      const r = await fetch("/api/express/cancel", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ number }) });
      const data = await r.json();
      if (!r.ok || !data.ok) throw new Error(data.error || "Could not cancel. Please retry.");
      setConfirm(false); router.refresh();
    } catch (e) { setError(e instanceof Error ? e.message : "Please retry."); router.refresh(); }
    finally { setBusy(false); }
  }
  return <div style={{ display: "grid", gap: 10 }}>
    {confirm ? <><p style={{ margin: 0 }}>Cancel every piece in this order and request a full refund to the original payment method?</p><div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}><button className="button" disabled={busy} onClick={cancel}>{busy ? "Cancelling…" : "Cancel order and refund"}</button><button className="secondary-button" disabled={busy} onClick={() => setConfirm(false)}>Keep order</button></div></>
      : <button className="secondary-button" disabled={busy} onClick={() => retry ? cancel() : setConfirm(true)}>{busy ? "Checking refund…" : retry ? "Retry refund processing" : "Cancel order and refund"}</button>}
    {error ? <p role="alert" style={{ margin: 0 }}>{error}</p> : null}
  </div>;
}
