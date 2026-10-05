import { PageHero } from "@/components/hx/PageHero";
export const metadata = { title: "Refund Policy | MOA Shop" };

export default function RefundPolicyPage() {
  return (
    <main className="hx">
      <PageHero title="Refunds">
        <p className="hx-body">Magnum Opus Agency, MOA Shop. Last updated October 2026.</p>
      </PageHero>
      <div className="hx-row hx-legal">

      <div style={{ fontSize: 14, lineHeight: 1.7, color: "var(--color-charcoal)", marginTop: 24, display: "grid", gap: 22 }}>
        <section>
          <h2 style={hStyle}>Before you approve your proof</h2>
          <p>Cancel your whole order from your account before approving any piece for a <strong>full refund</strong>, including sales tax. Until you approve, nothing has been produced. For orders with several pieces, automatic cancellation applies to the whole order. Once you approve a piece, contact us to discuss changes or cancellation.</p>
        </section>
        <section>
          <h2 style={hStyle}>After production begins</h2>
          <p>Because every item is custom-made to the spec you approved, approved orders are generally <strong>non-refundable</strong> once in production. If you need a change, reach out before approving. Your first proof and one revision round are included with every order. Further rounds are available on request.</p>
        </section>
        <section>
          <h2 style={hStyle}>Defects &amp; errors</h2>
          <p>If your order arrives defective, materially different from your approved proof, or damaged in transit, we&apos;ll make it right with a remake or refund. Email us within 14 days of delivery with photos.</p>
        </section>
        <section>
          <h2 style={hStyle}>How refunds are issued</h2>
          <p>Approved refunds go back to your original payment method via Stripe, typically within 5-10 business days.</p>
        </section>
        <section>
          <h2 style={hStyle}>Contact</h2>
          <p><a href="mailto:production@magnumopus.agency" style={{ color: "var(--color-terracotta)" }}>production@magnumopus.agency</a></p>
        </section>
      </div>
      </div>
    </main>
  );
}

const hStyle: React.CSSProperties = { fontFamily: "var(--font-display)", fontSize: 16, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", margin: "0 0 6px" };
