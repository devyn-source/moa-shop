"use client";

import { PageHero } from "@/components/hx/PageHero";

// Global error boundary: branded recovery instead of Next's default screen.
// Client-side only; the error itself stays in the console (no details leaked).
export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="hx">
      <PageHero title="Something went wrong">
        <p className="hx-body">Your cart and any paid orders are safe. Try again, or head back to the styles.</p>
        <div className="hx-hero-ctas">
          <button className="hx-btn hx-btn--primary" onClick={() => reset()} type="button">Try again</button>
          <a className="hx-btn hx-btn--dark" href="/shop">Browse the styles</a>
        </div>
      </PageHero>
      <div className="hx-row hx-endpad" />
    </main>
  );
}
