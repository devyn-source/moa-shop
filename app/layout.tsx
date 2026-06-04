import type { Metadata } from "next";
import Link from "next/link";
import { ClerkProvider } from "@clerk/nextjs";
import "./globals.css";
import { CartProvider } from "@/components/CartProvider";
import { CartButton } from "@/components/CartButton";
import { NavLink } from "@/components/NavLink";
import { ProximityFX } from "@/components/ProximityFX";
import { HeaderScroll } from "@/components/HeaderScroll";
import { AccountNav } from "@/components/AccountNav";

const clerkConfigured = Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY);

function MaybeClerk({ children }: { children: React.ReactNode }) {
  if (!clerkConfigured) return <>{children}</>;
  return <ClerkProvider>{children}</ClerkProvider>;
}

export const metadata: Metadata = {
  title: "MOA Catalog · Production-grade merch, made to order",
  description: "Premium merch made to your brand. Self-serve blanks, instant proofs, no quotes — produced to spec and shipped by Magnum Opus Agency."
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <MaybeClerk>
        <a href="#main" className="skip-link">Skip to content</a>
        <HeaderScroll />
        <ProximityFX />
        <CartProvider>
        <header className="site-header site-header--sticky">
          <nav className="site-nav site-nav--primary" aria-label="Primary navigation">
            <NavLink href="/">Catalog</NavLink>
            <NavLink href="/catalog-pdf">PDF</NavLink>
          </nav>
          <Link className="brand-lockup" href="/" aria-label="MOA — Magnum Opus, made-to-order catalog">
            <img className="brand-logo" src="/brand/logos/moa-logo.png" alt="MOA · Magnum Opus" />
          </Link>
          <div className="site-actions">
            <AccountNav />
            <CartButton />
          </div>
        </header>
        <div id="main">{children}</div>
        <footer className="ft">
          <div className="ft-top">
            <div className="ft-brand">
              <img className="ft-logo" src="/brand/logos/moa-logo.png" alt="MOA · Magnum Opus" />
              <p className="ft-statement">
                The MOA Catalog is bounded by design — fixed MOQs, fixed price ladders, fixed lead times.
                Need something the catalog can&apos;t do?
              </p>
              <a className="ft-cta" href="https://magnumopus.agency/workwithus" target="_blank" rel="noreferrer">
                <span className="ft-cta-headline">Start a bespoke program</span>
                <span className="ft-cta-action">
                  Inquire with the studio
                  <span className="ft-cta-arrow" aria-hidden>→</span>
                </span>
              </a>
            </div>
            <nav className="ft-nav" aria-label="Footer">
              <div className="ft-col">
                <p className="ft-h">Catalog</p>
                <Link href="/">All SKUs</Link>
                <Link href="/catalog-pdf">PDF catalog</Link>
                <Link href="/cart">Cart</Link>
              </div>
              <div className="ft-col">
                <p className="ft-h">Programs</p>
                <span>Brand drops &amp; capsules</span>
                <span>Event &amp; tour merch</span>
                <span>Creator collaborations</span>
                <span>Staff &amp; uniform kits</span>
              </div>
              <div className="ft-col">
                <p className="ft-h">Studio</p>
                <a href="https://magnumopus.agency" target="_blank" rel="noreferrer">magnumopus.agency</a>
                <a href="https://instagram.com/magnumopus" target="_blank" rel="noreferrer">Instagram @magnumopus</a>
              </div>
            </nav>
          </div>

          <div className="ft-rule" aria-hidden />

          <div className="ft-base">
            <span className="ft-base-left">© {new Date().getFullYear()} Magnum Opus Agency · LLC</span>
            <span style={{ display: "inline-flex", gap: 16, alignItems: "center" }}>
              <span className="ft-base-right">Made to order · Produced to spec · Tracked to your door</span>
              <span style={{ display: "inline-flex", gap: 12, fontSize: "0.72rem" }}>
                <Link href="/terms">Terms</Link>
                <Link href="/refund-policy">Refunds</Link>
                <Link href="/privacy">Privacy</Link>
              </span>
            </span>
          </div>
        </footer>
        </CartProvider>
        </MaybeClerk>
      </body>
    </html>
  );
}
