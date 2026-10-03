import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { ClerkProvider } from "@clerk/nextjs";
import "./globals.css";
import { CartProvider } from "@/components/CartProvider";
import { CartButton } from "@/components/CartButton";
import { NavLink } from "@/components/NavLink";
import { ProximityFX } from "@/components/ProximityFX";
import { HeaderScroll } from "@/components/HeaderScroll";
import { AccountNav } from "@/components/AccountNav";
import { AnalyticsProviders } from "@/components/AnalyticsProviders";
import { PromoBanner } from "@/components/PromoBanner";
import { ToastProvider } from "@/components/ToastProvider";
import { launchMode } from "@/lib/launch";

const clerkConfigured = Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY);

function MaybeClerk({ children }: { children: React.ReactNode }) {
  if (!clerkConfigured) return <>{children}</>;
  return <ClerkProvider>{children}</ClerkProvider>;
}

const SITE = process.env.NEXT_PUBLIC_SITE_ORIGIN || "https://shop.magnumopus.agency";
const TITLE = "MOA Shop, Custom cut and sew for smaller orders";
const DESC = "Fully custom apparel and accessories for smaller orders, cut and sewn to our own patterns. Design it on the garment, pay at checkout and get your production proof by the next business day. From the Magnum Opus Agency studio.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE),
  title: TITLE,
  description: DESC,
  applicationName: "MOA Shop",
  keywords: [
    "custom cut and sew", "custom apparel", "small batch apparel", "made to order merch",
    "branded merchandise", "screen printing", "embroidery", "custom hoodies", "custom t-shirts",
    "custom hats", "product design studio", "Magnum Opus Agency", "MOA",
  ],
  alternates: { canonical: SITE },
  openGraph: {
    type: "website",
    siteName: "MOA Shop",
    title: TITLE,
    description: DESC,
    url: SITE,
    // Social card auto-provided by app/opengraph-image.tsx
  },
  twitter: { card: "summary_large_image", title: TITLE, description: DESC },
  robots: { index: true, follow: true },
};

const ORG_JSONLD = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "Magnum Opus Agency",
  alternateName: "MOA",
  url: "https://magnumopus.agency",
  logo: `${SITE}/brand/logos/moa-logo.png`,
  sameAs: ["https://instagram.com/magnumopus"],
  email: "production@magnumopus.agency",
};


export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ORG_JSONLD) }} />
        <AnalyticsProviders />
        <MaybeClerk>
        <a href="#main" className="skip-link">Skip to content</a>
        <HeaderScroll />
        <ProximityFX />
        <CartProvider>
        <ToastProvider>
        {launchMode() ? null : <PromoBanner />}
        <header className="site-header site-header--sticky">
          <nav className="site-nav site-nav--primary" aria-label="Primary navigation">
            <NavLink href="/shop">Shop</NavLink>
            <NavLink href="/faq">FAQ</NavLink>
          </nav>
          <Link className="brand-lockup" href="/" aria-label="MOA Shop home">
            <Image className="brand-logo" src="/brand/logos/moa-logo.png" alt="MOA Magnum Opus" width={2104} height={766} sizes="110px" priority />
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
              <Image className="ft-logo" src="/brand/logos/moa-logo.png" alt="MOA Magnum Opus" width={2104} height={766} sizes="232px" />
              <p className="ft-statement">
                Every style is cut and sewn to our own patterns. Fixed prices, a proof in one business day and one invoice.
              </p>
            </div>
            <nav className="ft-nav" aria-label="Footer">
              <div className="ft-col">
                <p className="ft-h">Shop</p>
                <Link href="/shop">All styles</Link>
                <Link href="/orders">My orders</Link>
                <Link href="/cart">Cart</Link>
                <Link href="/faq">FAQ</Link>
              </div>
              <div className="ft-col">
                <p className="ft-h">Socials</p>
                <a href="https://instagram.com/magnumopus" target="_blank" rel="noreferrer">Instagram</a>
              </div>
            </nav>
          </div>

          <div className="ft-rule" aria-hidden />

          <div className="ft-base">
            <span className="ft-base-left">© {new Date().getFullYear()} Magnum Opus LLC, all rights reserved</span>
            <div className="ft-base-right">
              <span className="ft-tagline">Custom cut and sew. Proof in one business day. One invoice.</span>
              <span className="ft-legal">
                <Link href="/terms">Terms</Link>
                <Link href="/refund-policy">Refunds</Link>
                <Link href="/shipping">Shipping</Link>
                <Link href="/privacy">Privacy</Link>
              </span>
            </div>
          </div>
        </footer>
        </ToastProvider>
        </CartProvider>
        </MaybeClerk>
      </body>
    </html>
  );
}
