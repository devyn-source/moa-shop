"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

// Phone-only bottom bar that appears once the hero has scrolled away.
export function StickyCta({ fromLabel }: { fromLabel: string }) {
  const [on, setOn] = useState(false);
  useEffect(() => {
    const check = () => setOn(window.scrollY > window.innerHeight * 0.8);
    check();
    window.addEventListener("scroll", check, { passive: true });
    return () => window.removeEventListener("scroll", check);
  }, []);
  return (
    <div className={`hx-sticky${on ? " is-on" : ""}`} aria-hidden={!on}>
      <span>{fromLabel}</span>
      <Link href="#styles" tabIndex={on ? 0 : -1}>Start designing</Link>
    </div>
  );
}
