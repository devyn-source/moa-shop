export const metadata = { title: "Refund Policy · MOA Catalog" };

export default function RefundPolicyPage() {
  return (
    <main className="page" style={{ maxWidth: 760 }}>
      <p className="eyebrow" style={{ color: "var(--color-terracotta)" }}>Legal</p>
      <h1 className="page-title">Refund Policy</h1>
      <p className="lede">Magnum Opus Agency — MOA Catalog. Last updated June 2026.</p>

      <div style={{ fontSize: "0.92rem", lineHeight: 1.7, color: "var(--color-charcoal)", marginTop: 24, display: "grid", gap: 22 }}>
        <section>
          <h2 style={hStyle}>Before you approve your proof</h2>
          <p>Cancel any time before approving your proof for a <strong>full refund</strong> — no questions asked. Until you approve, nothing has been produced.</p>
        </section>
        <section>
          <h2 style={hStyle}>After you approve (in production)</h2>
          <p>Because every item is custom-made to the spec you approved, approved orders are generally <strong>non-refundable</strong> once in production. If you need a change, reach out before approving — you can adjust and regenerate your proof as many times as you like.</p>
        </section>
        <section>
          <h2 style={hStyle}>Defects &amp; errors</h2>
          <p>If your order arrives defective, materially different from your approved proof, or damaged in transit, we&apos;ll make it right — a remake or refund. Email us within 14 days of delivery with photos.</p>
        </section>
        <section>
          <h2 style={hStyle}>How refunds are issued</h2>
          <p>Approved refunds go back to your original payment method via Stripe, typically within 5–10 business days.</p>
        </section>
        <section>
          <h2 style={hStyle}>Contact</h2>
          <p><a href="mailto:production@magnumopus.agency" style={{ color: "var(--color-terracotta)" }}>production@magnumopus.agency</a></p>
        </section>
      </div>
    </main>
  );
}

const hStyle: React.CSSProperties = { fontFamily: "var(--font-display)", fontSize: "1rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", margin: "0 0 6px" };
