export const metadata = { title: "Privacy Policy · MOA Catalog" };

export default function PrivacyPage() {
  return (
    <main className="page" style={{ maxWidth: 760 }}>
      <p className="eyebrow" style={{ color: "var(--color-terracotta)" }}>Legal</p>
      <h1 className="page-title">Privacy Policy</h1>
      <p className="lede">Magnum Opus Agency — MOA Catalog. Last updated June 2026.</p>

      <div style={{ fontSize: "0.92rem", lineHeight: 1.7, color: "var(--color-charcoal)", marginTop: 24, display: "grid", gap: 22 }}>
        <section>
          <h2 style={hStyle}>What we collect</h2>
          <p>To fulfill your order we collect your contact details (name, email, phone, company), shipping address, the artwork you upload, and order details. Payment is processed by <strong>Stripe</strong> — we never see or store your full card details.</p>
        </section>
        <section>
          <h2 style={hStyle}>How we use it</h2>
          <p>We use your information solely to produce, fulfill, and support your order — including sharing the necessary production specs (your artwork, sizes, and ship-to address) with the manufacturer that makes your items. We do not sell your data.</p>
        </section>
        <section>
          <h2 style={hStyle}>Service providers</h2>
          <p>We rely on trusted processors to operate: Stripe (payments), Supabase (data storage), Resend (email), and Vercel (hosting). Each handles your data only to provide their service.</p>
        </section>
        <section>
          <h2 style={hStyle}>Your choices</h2>
          <p>You can request access to, correction of, or deletion of your personal data at any time by emailing us. We retain order records as needed for accounting and legal obligations.</p>
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
