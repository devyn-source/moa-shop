import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";

export function AuthShell({ children, mode }: { children: ReactNode; mode: "sign-in" | "sign-up" | "welcome" }) {
  return (
    <main className="account-entry">
      <div className="account-entry-top">
        <Link href="/shop" className="account-back">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><path d="m12 5-7 7 7 7M5 12h14" /></svg>
          Catalog
        </Link>
      </div>
      <div className="account-composition">
        <figure className="account-studio">
          <Image src="/landing/studio-hero.webp" alt="The MOA studio in Los Angeles" fill sizes="(max-width: 760px) 1px, 400px" priority />
          <figcaption>MOA Studio · Los Angeles</figcaption>
        </figure>
        <section className="account-form-panel" aria-label={mode === "sign-in" ? "Sign in" : mode === "welcome" ? "Your account is ready" : "Create an account"}>
          <div className="account-form-inner">
            {children}
          </div>
        </section>
      </div>
      <div className="account-entry-bottom"><Link href="/faq">Help</Link><div><Link href="/privacy">Privacy</Link><Link href="/terms">Terms</Link></div></div>
    </main>
  );
}

export function AuthUnavailable() {
  return <div className="account-unavailable" role="status"><h2>We’ll be right back.</h2><p>Account access is temporarily unavailable. You can still explore the catalog.</p><Link className="account-cta" href="/shop">Explore the catalog</Link></div>;
}
