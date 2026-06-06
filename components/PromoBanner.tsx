"use client";

// Site-wide PR Box promo strip. Reads the single promo config (lib/promo.ts), so
// copy + active window + discount are all controlled there. Dismissible (per
// browser), auto-hides when the promo is outside its active window, and never
// shows on the builder page itself.
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { PR_BOX_PROMO, isPromoWithinWindow } from "@/lib/promo";

const DISMISS_KEY = "moa-prbox-banner-dismissed-v1";

export function PromoBanner() {
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);
  const [dismissed, setDismissed] = useState(true); // hidden until we read localStorage (no flash)

  useEffect(() => {
    setMounted(true);
    try {
      setDismissed(localStorage.getItem(DISMISS_KEY) === "1");
    } catch {
      setDismissed(false);
    }
  }, []);

  const promo = PR_BOX_PROMO;
  if (!mounted || dismissed) return null;
  if (!isPromoWithinWindow(promo)) return null;
  if (pathname === "/p/pr-box") return null; // already on the builder

  return (
    <div className="promo-banner" role="region" aria-label="Promotion">
      <Link href="/p/pr-box" className="promo-banner-link">
        <span className="promo-banner-head">{promo.banner.headline}</span>
        <span className="promo-banner-sub">{promo.banner.subcopy}</span>
        <span className="promo-banner-cta">{promo.banner.ctaText} →</span>
      </Link>
      <button
        type="button"
        className="promo-banner-x"
        aria-label="Dismiss promotion"
        onClick={() => {
          try {
            localStorage.setItem(DISMISS_KEY, "1");
          } catch {
            // ignore
          }
          setDismissed(true);
        }}
      >
        ✕
      </button>
    </div>
  );
}
