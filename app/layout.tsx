import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "MOA Catalog",
  description: "A self-service standardized merch catalog by Magnum Opus Agency."
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <header className="site-header">
          <Link className="brand-lockup" href="/">
            <span className="brand-moa">MOA</span>
            <span className="brand-text">Catalog</span>
          </Link>
          <nav className="site-nav" aria-label="Primary navigation">
            <Link href="/" className="nav-primary">Catalog</Link>
            <Link href="/catalog-pdf" className="nav-primary">PDF</Link>
            <span className="nav-divider" aria-hidden />
            <Link href="/admin" className="nav-utility">Admin</Link>
            <Link href="/admin/orders" className="nav-utility">Orders</Link>
          </nav>
        </header>
        {children}
        <footer className="site-footer">
          <div>
            <span className="brand-moa" style={{ fontSize: "1.2rem" }}>MOA</span>
            <span className="brand-text">Catalog</span>
          </div>
          <p>
            Built by Magnum Opus Agency. Fixed-MOQ, fixed-price merch programs · factory-direct · artwork QA included.
          </p>
        </footer>
      </body>
    </html>
  );
}
