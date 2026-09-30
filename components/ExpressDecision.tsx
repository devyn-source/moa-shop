"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

// Approve a piece, or send it back with a note. Refreshes the order page after.
export function ExpressDecision({ number, skuId }: { number: string; skuId: string }) {
  const router = useRouter();
  const [mode, setMode] = useState<"idle" | "changes">("idle");
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function send(decision: "approved" | "changes") {
    setBusy(true); setError(null);
    const r = await fetch("/api/express/decision", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ number, skuId, decision, comment }) });
    const j = await r.json().catch(() => ({}));
    setBusy(false);
    if (!r.ok) { setError(j.error || "Something went wrong. Please try again."); return; }
    router.refresh();
  }
  return (
    <div style={{ display: "grid", gap: 10 }}>
      {mode === "changes" ? (
        <>
          <label htmlFor={`chg-${skuId}`} className="eyebrow">What should we change?</label>
          <textarea id={`chg-${skuId}`} value={comment} onChange={(e) => setComment(e.target.value)} rows={3} placeholder="For example: make the front logo 3 in wide" style={{ width: "100%", padding: 10, border: "1px solid rgba(30,30,30,.2)", borderRadius: 6, fontFamily: "inherit", fontSize: 13 }} />
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button className="button" type="button" disabled={busy || !comment.trim()} onClick={() => send("changes")}>{busy ? "Sending" : "Send change request"}</button>
            <button className="secondary-button" type="button" disabled={busy} onClick={() => setMode("idle")}>Cancel</button>
          </div>
        </>
      ) : (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button className="button" type="button" disabled={busy} onClick={() => send("approved")}>{busy ? "Saving" : "Approve this piece"}</button>
          <button className="secondary-button" type="button" disabled={busy} onClick={() => setMode("changes")}>Request a change</button>
        </div>
      )}
      {error ? <p role="alert" style={{ color: "#8E2F1E", fontSize: 12 }}>{error}</p> : null}
    </div>
  );
}
