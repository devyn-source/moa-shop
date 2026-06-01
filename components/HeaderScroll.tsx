"use client";

import { useEffect } from "react";

// Toggles `body.is-scrolled` past the first few pixels of scroll so the
// header can gain a hairline shadow without flicker on every frame.
export function HeaderScroll() {
  useEffect(() => {
    const update = () => {
      document.body.classList.toggle("is-scrolled", window.scrollY > 4);
    };
    update();
    window.addEventListener("scroll", update, { passive: true });
    return () => window.removeEventListener("scroll", update);
  }, []);
  return null;
}
