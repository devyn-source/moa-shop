"use client";

// Orders error boundary — branded recovery instead of Next's default screen.
// Client-side only; the error itself stays in the console (no details leaked).
export default function OrdersError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="page" style={{ maxWidth: 560, textAlign: "center", paddingTop: 80 }}>
      <p className="eyebrow" style={{ color: "var(--color-terracotta)" }}>Your account</p>
      <h1 className="page-title">We couldn&apos;t load your orders</h1>
      <p className="lede" style={{ marginTop: 12 }}>
        Something went wrong on our side. Your orders themselves are safe and unchanged. Try again, or head back to the shop.
      </p>
      <div style={{ display: "flex", gap: 12, justifyContent: "center", marginTop: 28 }}>
        <button className="button" onClick={() => reset()} type="button">Try again</button>
        <a className="secondary-button" href="/shop">Back to the catalog</a>
      </div>
    </main>
  );
}
