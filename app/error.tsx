"use client";

// Global error boundary — branded recovery instead of Next's default screen.
// Client-side only; the error itself stays in the console (no details leaked).
export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="page" style={{ maxWidth: 560, textAlign: "center", paddingTop: 80 }}>
      <p className="eyebrow" style={{ color: "var(--color-terracotta)" }}>MOA Catalog</p>
      <h1 className="page-title">Something went off-script</h1>
      <p className="lede" style={{ marginTop: 12 }}>
        That wasn&apos;t supposed to happen. Your cart and any paid orders are safe — try again, or head back to the catalog.
      </p>
      <div style={{ display: "flex", gap: 12, justifyContent: "center", marginTop: 28 }}>
        <button className="button" onClick={() => reset()} type="button">Try again</button>
        <a className="secondary-button" href="/shop">Back to the catalog</a>
      </div>
      <p className="trust-note" style={{ marginTop: 22 }}>
        Still stuck? <a href="mailto:production@magnumopus.agency" style={{ color: "var(--color-terracotta)", fontWeight: 600 }}>Email a real person</a> — include what you were doing and we&apos;ll sort it.
      </p>
    </main>
  );
}
