"use client";

import { useEffect } from "react";

// Proximity interaction: cards near the cursor subtly scale + lift, falling off
// with distance, so the grid feels alive rather than binary on/off hover.
const RADIUS = 280;
const SELECTOR = ".product-card";

export function ProximityFX() {
  useEffect(() => {
    if (window.matchMedia("(pointer: coarse)").matches) return; // skip touch

    let x = 0;
    let y = 0;
    let raf = 0;
    let queued = false;

    const apply = () => {
      queued = false;
      document.querySelectorAll<HTMLElement>(SELECTOR).forEach((card) => {
        const r = card.getBoundingClientRect();
        const dx = x - (r.left + r.width / 2);
        const dy = y - (r.top + r.height / 2);
        const d = Math.hypot(dx, dy);
        const t = Math.max(0, 1 - d / RADIUS);
        card.style.setProperty("--prox", (t * t).toFixed(3)); // ease-in falloff
      });
    };

    const onMove = (e: PointerEvent) => {
      x = e.clientX;
      y = e.clientY;
      if (!queued) {
        queued = true;
        raf = requestAnimationFrame(apply);
      }
    };

    const reset = () => {
      document.querySelectorAll<HTMLElement>(SELECTOR).forEach((card) => card.style.setProperty("--prox", "0"));
    };

    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("blur", reset);
    document.addEventListener("mouseleave", reset);

    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("blur", reset);
      document.removeEventListener("mouseleave", reset);
      cancelAnimationFrame(raf);
    };
  }, []);

  return null;
}
