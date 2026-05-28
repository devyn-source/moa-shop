import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";
import { CartProvider } from "@/components/CartProvider";
import { CartButton } from "@/components/CartButton";
import { NavLink } from "@/components/NavLink";

export const metadata: Metadata = {
  title: "MOA · Made-to-Order Merch Catalog",
  description: "Made-to-order merch, tailored to your brand and produced to spec by Magnum Opus Agency."
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <CartProvider>
        <header className="site-header">
          <nav className="site-nav site-nav--primary" aria-label="Primary navigation">
            <NavLink href="/">Catalog</NavLink>
            <NavLink href="/catalog-pdf">PDF</NavLink>
          </nav>
          <Link className="brand-lockup" href="/">
            <span className="brand-moa">MOA</span>
            <span className="brand-sep" aria-hidden />
            <span className="brand-text">Catalog</span>
          </Link>
          <div className="site-actions">
            <NavLink href="/admin" muted>Admin</NavLink>
            <NavLink href="/admin/orders" muted>Orders</NavLink>
            <CartButton />
          </div>
        </header>
        {children}
        <footer className="site-footer">
          <div>
            <span className="brand-moa" style={{ fontSize: "1.2rem" }}>MOA</span>
            <span className="brand-text">Catalog</span>
          </div>
          <p>
            Built by Magnum Opus Agency. Fixed-MOQ, fixed-price merch programs · managed end to end · artwork QA included.
          </p>
        </footer>
        </CartProvider>
      </body>
    </html>
  );
}
