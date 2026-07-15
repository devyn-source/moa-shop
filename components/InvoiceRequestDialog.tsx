"use client";

// "Pay by invoice / PO" hand-raise at checkout. A quiet trust-note link opens a
// premium-form popover ANCHORED to the link (never page-center) — same
// structure as WovenLabelModal for Escape + focus handling. Submitting creates
// a lead (POST /api/invoice-request); it never touches Stripe or the cart.
import { useEffect, useRef, useState } from "react";
import { analytics } from "@/lib/analytics";

export function InvoiceRequestDialog({ prefillEmail }: { prefillEmail: string }) {
  const [open, setOpen] = useState(false);
  const [company, setCompany] = useState("");
  const [email, setEmail] = useState("");
  const [poNumber, setPoNumber] = useState("");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  // The signed-in email arrives async from Clerk — adopt it until the buyer types.
  const emailTouched = useRef(false);
  useEffect(() => {
    if (!emailTouched.current && prefillEmail) setEmail(prefillEmail);
  }, [prefillEmail]);

  // Escape closes (matches WovenLabelModal).
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  // Focus the dialog on open; return focus to the trigger on close.
  const dialogRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    dialogRef.current?.focus();
    const trigger = triggerRef.current;
    return () => trigger?.focus();
  }, [open]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch("/api/invoice-request", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          companyName: company.trim(),
          workEmail: email.trim(),
          poNumber: poNumber.trim() || undefined,
          note: note.trim() || undefined
        })
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) throw new Error(data.error || "Couldn't send the request.");
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't send the request. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <span className="ir-anchor">
      <p className="trust-note" style={{ marginTop: 6 }}>
        Prefer to pay by invoice or PO?{" "}
        <button
          ref={triggerRef}
          type="button"
          className="ir-trigger"
          aria-expanded={open}
          aria-haspopup="dialog"
          onClick={() => {
            setOpen((v) => !v);
            if (!open) analytics.track("invoice_request_opened");
          }}
        >
          Request it →
        </button>
      </p>

      {open ? (
        <>
          {/* transparent click-away layer — the popover stays anchored, no page dim */}
          <div className="ir-clickaway" onClick={() => setOpen(false)} aria-hidden="true" />
          <div
            ref={dialogRef}
            tabIndex={-1}
            className="ir-pop"
            role="dialog"
            aria-modal="false"
            aria-label="Request to pay by invoice or PO"
          >
            <div className="ir-head">
              <div>
                <p className="ir-eyebrow">Pay by invoice / PO</p>
                <h2 className="ir-title">Request this order by invoice</h2>
              </div>
              <button type="button" className="ir-x" onClick={() => setOpen(false)} aria-label="Close">✕</button>
            </div>

            {done ? (
              <p className="ir-done">Got it — a real person will reply within one business day.</p>
            ) : (
              <form onSubmit={submit}>
                <label className="ir-field">
                  <span className="ir-label">Company name</span>
                  <input className="ir-input" value={company} onChange={(e) => setCompany(e.target.value)} required maxLength={160} autoComplete="organization" />
                </label>
                <label className="ir-field">
                  <span className="ir-label">Work email</span>
                  <input
                    className="ir-input"
                    type="email"
                    value={email}
                    onChange={(e) => {
                      emailTouched.current = true;
                      setEmail(e.target.value);
                    }}
                    required
                    maxLength={254}
                    autoComplete="email"
                  />
                </label>
                <label className="ir-field">
                  <span className="ir-label">PO number (optional)</span>
                  <input className="ir-input" value={poNumber} onChange={(e) => setPoNumber(e.target.value)} maxLength={64} />
                </label>
                <label className="ir-field">
                  <span className="ir-label">Note (optional)</span>
                  <textarea className="ir-input ir-textarea" value={note} onChange={(e) => setNote(e.target.value)} maxLength={2000} rows={3} placeholder="Anything we should know — net terms, approval process, timing…" />
                </label>
                {error ? <p className="ir-error">{error}</p> : null}
                <div className="ir-foot">
                  <span className="ir-hint">Your cart stays as-is — this just starts the conversation.</span>
                  <button type="submit" className="ir-send" disabled={submitting}>
                    {submitting ? "Sending…" : "Send request →"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </>
      ) : null}
    </span>
  );
}
