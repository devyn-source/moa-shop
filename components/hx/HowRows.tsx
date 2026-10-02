import Link from "next/link";
import type { CSSProperties } from "react";

const STEPS = [
  { t: "Pick a style", d: "Tees, hoodies, a work jacket, caps, beanies and totes, each cut and sewn to our own patterns.", cta: "See the styles", href: "/shop" },
  { t: "Design it on the garment", d: "Choose the colour, upload your artwork and place it. Sizes, placements and the price update as you go.", cta: "Start designing", href: "/shop" },
  { t: "Approve your proof", d: "Our team checks every order. Your proof arrives within 24 business hours and nothing is made until you approve it.", cta: "How proofs work", href: "/faq" },
  { t: "We make it and ship it", d: "One invoice for the full order. Produced with our factory partners, checked by our quality control and tracked to your door.", cta: "Questions", href: "/faq" },
];

// The studio site's "What we do" rows, as the shop's four steps.
export function HowRows({ stylesHref = "/shop" }: { stylesHref?: string }) {
  return (
    <section className="hx-row hx-how" id="how">
      <h2 className="hx-h2" data-reveal>How it works</h2>
      <ol className="hx-rows">
        {STEPS.map((s, i) => (
          <li key={s.t} data-reveal style={{ "--lp-i": i } as CSSProperties}>
            <span className="hx-rows-n">{String(i + 1).padStart(2, "0")}</span>
            <div>
              <h3>{s.t}</h3>
              <p>{s.d}</p>
            </div>
            <Link href={s.href === "/shop" ? stylesHref : s.href} className="hx-rows-link">{s.cta}</Link>
          </li>
        ))}
      </ol>
    </section>
  );
}
