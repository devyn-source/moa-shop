"use client";

import { useEffect } from "react";

// One small client island: fades + rises any [data-reveal] element into view as
// it enters the viewport. Keeps the landing page a server component otherwise.
//
// Progressive enhancement: elements are VISIBLE by default (no CSS gating until
// this island runs). On mount we add `lp-motion` to <html>, which activates the
// hidden state — but only for elements still below the viewport, which are
// immediately marked for observation. Anything already on screen (or near it)
// gets `.lp-in` in the same synchronous pass, so the first paint never blanks
// and slow JS never hides content the user is already reading.
// Respects prefers-reduced-motion (elements just show, no transform).
export function ScrollReveal() {
  useEffect(() => {
    const els = Array.from(document.querySelectorAll<HTMLElement>("[data-reveal]"));
    if (!els.length) return;

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      els.forEach((el) => el.classList.add("lp-in"));
      return;
    }

    // Activate hiding + reveal in the same frame: below-fold elements hide
    // (they were never seen), in-view elements show instantly.
    document.documentElement.classList.add("lp-motion");
    const vh = window.innerHeight;
    const pending: HTMLElement[] = [];
    for (const el of els) {
      const r = el.getBoundingClientRect();
      if (r.top < vh * 0.92 && r.bottom > 0) el.classList.add("lp-in");
      else pending.push(el);
    }
    if (!pending.length) return;

    // threshold 0 (not a fraction): tall sections must reveal as soon as their
    // leading edge crosses the margin line, not after 12% of a 2000px block.
    const io = new IntersectionObserver(
      (entries, obs) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            (e.target as HTMLElement).classList.add("lp-in");
            obs.unobserve(e.target);
          }
        }
      },
      { rootMargin: "0px 0px -6% 0px", threshold: 0 }
    );
    pending.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);

  return null;
}
