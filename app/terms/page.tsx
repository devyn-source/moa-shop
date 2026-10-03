import { PageHero } from "@/components/hx/PageHero";
import Link from "next/link";

export const metadata = { title: "Terms of Service | MOA Shop" };

// First-draft Terms for the self-serve catalog. Review with counsel before launch.
export default function TermsPage() {
  return (
    <main className="hx">
      <PageHero title="Terms of service">
        <p className="hx-body">Magnum Opus Agency, MOA Shop. Last updated October 2026.</p>
      </PageHero>
      <div className="hx-row hx-legal">

      <div style={{ fontSize: 14, lineHeight: 1.7, color: "var(--color-charcoal)", marginTop: 24, display: "grid", gap: 22 }}>
        <section>
          <h2 style={hStyle}>1. What we make</h2>
          <p>MOA Shop produces standardized, made-to-order merchandise decorated with artwork you supply. Every item is custom-produced to the specification you configure and approve, so orders are handled as personalized goods.</p>
        </section>
        <section>
          <h2 style={hStyle}>2. Your artwork &amp; rights</h2>
          <p>By placing an order you certify that you own, or have a valid license to use, all artwork, logos, names, and marks you upload, and that producing them does not infringe any third party&apos;s rights. You grant MOA a limited license to use that artwork solely to produce and fulfill your order. You agree to indemnify MOA against any claim arising from the artwork you provide.</p>
        </section>
        <section>
          <h2 style={hStyle}>3. Proof approval is the spec</h2>
          <p>After full payment at checkout, we prepare your first production proof by 5 p.m. Pacific on the next business day (Monday to Friday). <strong>Nothing is sent to production until you approve it.</strong> Your approval confirms the artwork, placement, colours, sizes, and quantities are correct. Your first proof and one revision round are included. Request changes from your account before approving; additional rounds are available on request. Once approved, the approved proof governs production.</p>
        </section>
        <section>
          <h2 style={hStyle}>4. Lead times, colours &amp; variance</h2>
          <p>Lead times begin after every piece in your order has an approved production proof. They are good-faith estimates, not guarantees. Screen and printed colours may vary slightly from on-screen previews; Pantone references are targets within standard manufacturing tolerance. Minor placement variance within industry tolerance is normal.</p>
        </section>
        <section>
          <h2 style={hStyle}>5. Shipping, customs &amp; duties</h2>
          <p>Orders ship to the address you provide. Title and risk pass on delivery to the carrier. Any import duties, taxes, or customs delays are the recipient&apos;s responsibility and are outside MOA&apos;s control.</p>
        </section>
        <section>
          <h2 style={hStyle}>6. Payment, cancellation &amp; refunds</h2>
          <p>Payment is processed securely via Stripe at checkout. You may cancel for a full refund any time before you approve your proof. See our <Link href="/refund-policy" style={{ color: "var(--color-terracotta)" }}>Refund Policy</Link> for details after approval.</p>
        </section>
        <section>
          <h2 style={hStyle}>7. Limitation of liability</h2>
          <p>To the maximum extent permitted by law, MOA&apos;s total liability for any order is limited to the amount you paid for that order. MOA is not liable for indirect or consequential damages.</p>
        </section>
        <section>
          <h2 style={hStyle}>8. Contact</h2>
          <p>Questions? <a href="mailto:production@magnumopus.agency" style={{ color: "var(--color-terracotta)" }}>production@magnumopus.agency</a>.</p>
        </section>
      </div>
      </div>
    </main>
  );
}

const hStyle: React.CSSProperties = { fontFamily: "var(--font-display)", fontSize: 16, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", margin: "0 0 6px" };
