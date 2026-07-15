"use client";

// Orders error boundary — branded recovery instead of Next's default screen.
// Client-side only; the error itself stays in the console (no details leaked).
export default function OrdersError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="page" style={{ maxWidth: 560, textAlign: "center", paddingTop: 80 }}>
      <p className="eyebrow" style={{ color: "var(--color-terracotta)" }}>Your account</p>
      <h1 className="page-title">We couldn&apos;t load your orders</h1>
      <p className="lede" style={{ marginTop: 12 }}>
        Something hiccuped on our side — your orders themselves are safe and unchanged. Try again, or head back to the catalog.
      </p>
      <div style={{ display: "flex", gap: 12, justifyContent: "center", marginTop: 28 }}>
        <button className="button" onClick={() => reset()} type="button">Try again</button>
        <a className="secondary-button" href="/shop">Back to the catalog</a>
      </div>
      <p className="trust-note" style={{ marginTop: 22 }}>
        Still stuck? <a href="mailto:production@magnumopus.agency" style={{ color: "var(--color-terracotta)", fontWeight: 600 }}>Email a real person</a> — include your order number and we&apos;ll sort it.
      </p>
    </main>
  );
}
