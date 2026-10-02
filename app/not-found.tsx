import Link from "next/link";
import { PageHero } from "@/components/hx/PageHero";

export default function NotFound() {
  return (
    <main className="hx">
      <PageHero title="Page not found">
        <p className="hx-body">The link might be old or the style was retired. Everything you can order is in the shop.</p>
        <Link href="/shop" className="hx-btn hx-btn--primary">Browse the styles</Link>
      </PageHero>
      <div className="hx-row hx-endpad" />
    </main>
  );
}
