export const metadata = { title: "Shipping Policy · MOA Catalog" };

export default function ShippingPolicyPage() {
  return (
    <main className="page" style={{ maxWidth: 760 }}>
      <p className="eyebrow" style={{ color: "var(--color-terracotta)" }}>Legal</p>
      <h1 className="page-title">Shipping Policy</h1>
      <p className="lede">Magnum Opus Agency — MOA Catalog. Last updated June 2026.</p>

      <div style={{ fontSize: "0.92rem", lineHeight: 1.7, color: "var(--color-charcoal)", marginTop: 24, display: "grid", gap: 22 }}>
        <section>
          <h2 style={hStyle}>Lead times</h2>
          <p>Every order is made to order. Each product page shows its full delivered lead time — production plus transit — and the clock starts when you <strong>approve your proof</strong>, not at checkout. Until you approve, nothing is produced and nothing ships.</p>
        </section>
        <section>
          <h2 style={hStyle}>How your order ships</h2>
          <p>Orders ship in one shipment per order, to the address you provide at checkout. The moment your order ships you&apos;ll get an email with the carrier and tracking number, and your order page tracks it live through delivery.</p>
        </section>
        <section>
          <h2 style={hStyle}>Address changes</h2>
          <p>Need to change the ship-to address? Email us any time <strong>before your order ships</strong> and we&apos;ll update it. After handoff to the carrier, changes are subject to the carrier&apos;s re-routing options.</p>
        </section>
        <section>
          <h2 style={hStyle}>Title &amp; risk</h2>
          <p>Title and risk of loss pass to you on delivery to the carrier. If a shipment arrives damaged, email us within 14 days with photos and we&apos;ll make it right per our <a href="/refund-policy" style={{ color: "var(--color-terracotta)" }}>Refund Policy</a>.</p>
        </section>
        <section>
          <h2 style={hStyle}>International orders, duties &amp; customs</h2>
          <p>For shipments outside the United States, any import duties, taxes and brokerage fees are the recipient&apos;s responsibility and are not included in your order total. Customs processing times are outside MOA&apos;s control, and customs-related delays are not grounds for cancellation or refund.</p>
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
