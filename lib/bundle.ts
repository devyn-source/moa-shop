// PR Box (bundle) <-> cart glue. A box is a set of cart lines sharing a bundleId:
// each garment component and each packaging asset is a normal cart line, so the
// whole existing cart/checkout/Stripe/fulfillment pipeline keeps working. These
// helpers (1) turn a built box into those lines with the box discount allocated
// across them, and (2) regroup the flat cart back into boxes for display.

import type { CartItem } from "@/components/CartProvider";
import { calculateBundlePrice, round2, type BundlePrice } from "./pricing";
import { PR_BOX_PROMO, type PrBoxPromo } from "./promo";
import type { CatalogProduct, CatalogVariant, DecorationMethod } from "./types";

export type BundleBuilderComponent = {
  product: CatalogProduct;
  variant: CatalogVariant;
  decorationIds: DecorationMethod[];
  perBoxQty: number;
  size?: string; // single size applied across the run (assorted sizing arranged later)
  artworkFileName?: string;
  artworkFileUrl?: string;
  artworkNotes?: string;
};

export type BundleBuilderPackaging = {
  product: CatalogProduct;
  perBoxQty: number;
};

function decorationLabelFor(product: CatalogProduct, decorationIds: DecorationMethod[]): string {
  const labels = product.decorations.filter((d) => decorationIds.includes(d.id)).map((d) => d.label);
  return labels.length ? labels.join(" + ") : "Undecorated";
}

// Build the cart lines for one box. The per-box subtotal discount is allocated
// across lines proportionally to each line's gross subtotal, with the remainder
// assigned to the last line so the line totals sum EXACTLY to boxTotalUsd.
export function buildBundleCartLines(args: {
  bundleId: string;
  bundleLabel: string;
  components: BundleBuilderComponent[];
  packaging: BundleBuilderPackaging[];
  boxQty: number;
  promo?: PrBoxPromo;
}): { lines: Omit<CartItem, "lineId">[]; price: BundlePrice } {
  const promo = args.promo ?? PR_BOX_PROMO;
  const price = calculateBundlePrice(
    args.components.map((c) => ({ product: c.product, decorationIds: c.decorationIds, perBoxQty: c.perBoxQty })),
    args.packaging.map((p) => ({ product: p.product, perBoxQty: p.perBoxQty })),
    args.boxQty,
    promo
  );

  // selections in the SAME order calculateBundlePrice emits lines: components then packaging
  const componentSel = args.components.map((c) => ({ kind: "component" as const, c }));
  const packagingSel = args.packaging.map((p) => ({ kind: "packaging" as const, p }));
  const selections = [...componentSel, ...packagingSel];

  const gross = price.itemsSubtotalUsd;
  let remainingDiscount = price.bundleDiscountUsd;

  const lines: Omit<CartItem, "lineId">[] = price.lines.map((line, i) => {
    const isLast = i === price.lines.length - 1;
    const share = isLast
      ? round2(remainingDiscount)
      : round2(gross > 0 ? price.bundleDiscountUsd * (line.lineSubtotalUsd / gross) : 0);
    remainingDiscount = round2(remainingDiscount - share);
    const netTotal = round2(line.lineSubtotalUsd - share);

    const base = {
      productId: line.productId,
      quantity: line.effectiveQty,
      perUnitUsd: line.perUnitUsd,
      decorationAdderUsd: line.decorationAdderUsd,
      subtotalUsd: round2(line.perUnitUsd * line.effectiveQty),
      totalUsd: netTotal,
      bundleId: args.bundleId,
      bundleLabel: args.bundleLabel,
      bundleRole: line.kind,
      perBoxQty: line.perBoxQty,
      perBoxUsd: line.perBoxUsd,
      bundleDiscountUsd: share,
      promoId: price.promo.promoId
    };

    const sel = selections[i];
    if (sel.kind === "component") {
      const { product, variant, decorationIds, size, artworkFileName, artworkFileUrl, artworkNotes } = sel.c;
      return {
        ...base,
        slug: product.slug,
        displayName: product.displayName,
        skuCode: product.skuCode,
        variantId: variant.id,
        colorLabel: variant.colorLabel,
        colorHex: variant.colorHex,
        image: product.greyFront ?? variant.frontImage,
        decorationIds,
        decorationLabel: decorationLabelFor(product, decorationIds),
        sizeQty: size ? { [size]: line.effectiveQty } : {},
        artworkFileName: artworkFileName ?? "Artwork file pending",
        artworkFileUrl,
        artworkNotes: artworkNotes ?? ""
      } satisfies Omit<CartItem, "lineId">;
    }

    const { product } = sel.p;
    return {
      ...base,
      slug: product.slug,
      displayName: product.displayName,
      skuCode: product.skuCode,
      variantId: product.variants[0]?.id ?? `${product.id}-default`,
      colorLabel: product.variants[0]?.colorLabel ?? "Branded",
      colorHex: product.variants[0]?.colorHex,
      image: product.greyFront ?? product.variants[0]?.frontImage,
      decorationIds: [],
      decorationLabel: "Packaging",
      sizeQty: {},
      artworkFileName: "",
      artworkFileUrl: undefined,
      artworkNotes: ""
    } satisfies Omit<CartItem, "lineId">;
  });

  return { lines, price };
}

export type CartBundleGroup = {
  bundleId: string;
  label: string;
  boxQty: number;
  lines: CartItem[];
  boxSubtotalUsd: number; // gross, per box
  boxDiscountUsd: number; // per box
  boxUnitUsd: number; // net, per box
  boxTotalUsd: number; // whole run
};

// Regroup a flat cart into boxes (preserving order) + leftover single SKUs.
export function groupCartItems(items: CartItem[]): { bundles: CartBundleGroup[]; singles: CartItem[] } {
  const order: string[] = [];
  const byId = new Map<string, CartItem[]>();
  const singles: CartItem[] = [];

  for (const item of items) {
    if (!item.bundleId) {
      singles.push(item);
      continue;
    }
    if (!byId.has(item.bundleId)) {
      byId.set(item.bundleId, []);
      order.push(item.bundleId);
    }
    byId.get(item.bundleId)!.push(item);
  }

  const bundles: CartBundleGroup[] = order.map((bundleId) => {
    const lines = byId.get(bundleId)!;
    const first = lines[0];
    const perBoxQty = first.perBoxQty ?? 1;
    const boxQty = perBoxQty > 0 ? Math.round((first.quantity ?? 0) / perBoxQty) : 0;
    const boxTotalUsd = round2(lines.reduce((s, l) => s + l.totalUsd, 0));
    const boxSubtotalUsd = round2(lines.reduce((s, l) => s + (l.perBoxUsd ?? 0), 0));
    const boxDiscountUsd = boxQty > 0 ? round2(lines.reduce((s, l) => s + (l.bundleDiscountUsd ?? 0), 0) / boxQty) : 0;
    const boxUnitUsd = boxQty > 0 ? round2(boxTotalUsd / boxQty) : 0;
    return {
      bundleId,
      label: first.bundleLabel ?? "PR Box",
      boxQty,
      lines,
      boxSubtotalUsd,
      boxDiscountUsd,
      boxUnitUsd,
      boxTotalUsd
    };
  });

  return { bundles, singles };
}
