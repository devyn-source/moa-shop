"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

// Approve a piece, or send it back with a note. Refreshes the order page after.
export function ExpressDecision({ number, skuId, round }: { number: string; skuId: string; round: number }) {
  const router = useRouter();
  const [mode, setMode] = useState<"idle" | "changes">("idle");
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inFlight = useRef(false);
  const [saved, setSaved] = useState(false);
  const [stale, setStale] = useState(false);
  async function send(decision: "approved" | "changes") {
    if (inFlight.current || saved || stale) return;
    inFlight.current = true;
    setBusy(true); setError(null);
    try {
      const r = await fetch("/api/express/decision", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ number, skuId, round, decision, comment }) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok || !j.ok) {
        setError(j.error || "Could not save your decision. Please try again.");
        if (r.status === 409) { setStale(true); router.refresh(); }
        return;
      }
      setSaved(true); router.refresh();
    } catch { setError("Connection lost. Your decision may not have saved. Please try again."); }
    finally { inFlight.current = false; setBusy(false); }
  }
  if (saved) return <p role="status" style={{ fontSize: 13 }}>Decision saved. Updating your order.</p>;
  if (stale) return <div role="alert" style={{ fontSize: 13 }}><p>{error}</p><button className="secondary-button" type="button" onClick={() => window.location.reload()}>Refresh proof</button></div>;
  return (
    <div style={{ display: "grid", gap: 10 }}>
      <p style={{ margin: 0, fontSize: 12, lineHeight: 1.6, opacity: 0.75 }}>Check the artwork, spelling, colours, placement, measurements and size run above. Approval releases this piece for production once every piece in your order is approved.</p>
      {mode === "changes" ? (
        <>
          <label htmlFor={`chg-${skuId}`} className="eyebrow">What should we change?</label>
          <textarea id={`chg-${skuId}`} maxLength={4000} disabled={busy} value={comment} onChange={(e) => setComment(e.target.value)} rows={3} placeholder="For example: make the front logo 3 in wide" style={{ width: "100%", padding: 10, border: "1px solid rgba(30,30,30,.2)", borderRadius: 6, fontFamily: "inherit", fontSize: 13 }} />
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button className="button" type="button" disabled={busy || !comment.trim()} onClick={() => send("changes")}>{busy ? "Sending" : "Send change request"}</button>
            <button className="secondary-button" type="button" disabled={busy} onClick={() => setMode("idle")}>Cancel</button>
          </div>
        </>
      ) : (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button className="button" type="button" disabled={busy} onClick={() => send("approved")}>{busy ? "Saving" : "Approve for production"}</button>
          <button className="secondary-button" type="button" disabled={busy} onClick={() => setMode("changes")}>Request a change</button>
        </div>
      )}
      {error ? <p role="alert" style={{ color: "#8E2F1E", fontSize: 12 }}>{error}</p> : null}
    </div>
  );
}
