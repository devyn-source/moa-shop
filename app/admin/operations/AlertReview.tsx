"use client";

import { useState } from "react";

type Draft = {
  message: { provider: "slack"; workspace: string; from: string; to: string; destination: string; text: string };
  hash: string;
  status: string;
};

export default function AlertReview({ incidentId }: { incidentId: string }) {
  const [draft, setDraft] = useState<Draft | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [approved, setApproved] = useState(false);

  async function prepare() {
    setBusy(true); setNotice(""); setApproved(false); setDraft(null);
    try {
      const response = await fetch(`/api/admin/operations-alert?incident=${encodeURIComponent(incidentId)}`, { cache: "no-store" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Could not prepare alert");
      setDraft(result);
    } catch (error) { setNotice(error instanceof Error ? error.message : "Could not prepare alert"); }
    finally { setBusy(false); }
  }

  async function send() {
    if (!draft || !approved || busy) return;
    setBusy(true); setNotice("");
    try {
      const response = await fetch("/api/admin/operations-alert", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ incidentId, approvedHash: draft.hash }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Delivery requires review");
      setDraft({ ...draft, status: "sent" });
      setNotice("Slack accepted this message. Confirm it is visible in the reviewed destination.");
    } catch (error) {
      setDraft(null);
      setNotice(error instanceof Error ? error.message : "Delivery outcome is uncertain. Check the provider before retrying.");
    } finally { setBusy(false); setApproved(false); }
  }

  return <div style={{ marginTop: 24 }}>
    <button type="button" className="ghost-button" disabled={busy} onClick={prepare}>Review Slack alert</button>
    {draft ? <div style={{ marginTop: 16 }}>
      <p><strong>From:</strong> {draft.message.from}<br /><strong>To:</strong> {draft.message.destination} ({draft.message.to})<br /><strong>Workspace:</strong> {draft.message.workspace}<br /><strong>Attachments:</strong> None</p>
      <pre style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere", fontFamily: "inherit", textTransform: "none" }}>{draft.message.text}</pre>
      {draft.status === "draft" ? <>
        <label style={{ display: "flex", alignItems: "start", gap: 8, margin: "16px 0" }}><input type="checkbox" checked={approved} disabled={busy} onChange={event => setApproved(event.target.checked)} />I am Devyn and approve sending this exact message to the recipient shown above.</label>
        <button type="button" className="ghost-button" disabled={!approved || busy} onClick={send}>{busy ? "Submitting..." : "Approve and send to Slack"}</button>
      </> : <p>{draft.status === "sent" ? "Provider accepted this message. Repeat sending is blocked." : "Delivery is pending or uncertain. Check the provider before retrying."}</p>}
    </div> : null}
    <p role="status">{notice}</p>
  </div>;
}
