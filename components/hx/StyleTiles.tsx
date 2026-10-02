import Link from "next/link";
import Image from "next/image";
import type { CSSProperties } from "react";
import { currency } from "@/lib/pricing";
import type { CatalogProduct } from "@/lib/types";

const fromPrice = (p: CatalogProduct) => Math.min(...p.priceTiers.map((t) => t.perUnitUsd));

// The style grid used on the landing page and the shop: mockup, name, from price, colours.
export function StyleTiles({ products, thumbs }: { products: CatalogProduct[]; thumbs: Record<string, string> }) {
  return (
    <div className="hx-tiles">
      {products.map((p, i) => (
        <Link key={p.id} href={`/p/${p.slug}`} className="hx-tile" data-reveal style={{ "--lp-i": i % 4 } as CSSProperties}>
          <span className="hx-tile-img">
            {thumbs[p.slug] ? <Image src={thumbs[p.slug]} alt={p.displayName} width={800} height={1000} sizes="(max-width: 700px) 45vw, 22vw" /> : null}
          </span>
          <span className="hx-tile-name">{p.displayName}</span>
          <span className="hx-tile-meta">
            <span>From {currency(fromPrice(p))}/unit</span>
            <span className="hx-tile-dots" aria-label={`${p.variants.length} colours`}>
              {p.variants.slice(0, 6).map((v) => <i key={v.colorLabel} style={{ background: v.colorHex }} />)}
            </span>
          </span>
        </Link>
      ))}
    </div>
  );
}
