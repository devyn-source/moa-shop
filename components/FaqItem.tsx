"use client";

// Smooth FAQ disclosure — replaces native <details> (which can't animate height).
// The answer stays in the DOM (height-collapsed) so it's still crawlable; opening
// eases the height + fades in, and the +/− morphs.
import { useState } from "react";
import { motion } from "motion/react";

export function FaqItem({ q, a, style }: { q: string; a: string; style?: React.CSSProperties }) {
  const [open, setOpen] = useState(false);
  // className stays STABLE — ScrollReveal adds `lp-in` imperatively, and a
  // changing className on re-render would wipe it (the item would vanish). Drive
  // the open state via the data-open attribute instead.
  return (
    <div className="lp-faq-item" data-open={open} data-reveal style={style}>
      <button type="button" className="lp-faq-q" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <span>{q}</span>
        <span className="lp-faq-icon" aria-hidden>
          <span className="lp-faq-icon-bar" />
          <span className="lp-faq-icon-bar lp-faq-icon-bar--v" />
        </span>
      </button>
      <motion.div
        initial={false}
        animate={{ height: open ? "auto" : 0, opacity: open ? 1 : 0 }}
        transition={{
          height: { duration: 0.36, ease: [0.22, 1, 0.36, 1] },
          opacity: { duration: open ? 0.3 : 0.16, ease: [0.22, 1, 0.36, 1] }
        }}
        style={{ overflow: "hidden" }}
      >
        <p className="lp-faq-a">{a}</p>
      </motion.div>
    </div>
  );
}
