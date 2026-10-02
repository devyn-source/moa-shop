import type { ReactNode } from "react";

// The studio-site page header: a big left-aligned title, side copy on the right.
export function PageHero({ title, children }: { title: ReactNode; children?: ReactNode }) {
  return (
    <section className="hx-row hx-pagehero">
      <h1 className="hx-h2 hx-pagehero-title">{title}</h1>
      {children ? <div className="hx-split-side">{children}</div> : null}
    </section>
  );
}
