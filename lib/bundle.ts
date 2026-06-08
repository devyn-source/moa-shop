// PR Box (bundle) <-> cart glue. A box is a set of cart lines sharing a bundleId:
// each garment component and each packaging asset is a normal cart line, so the
// whole existing cart/checkout/Stripe/fulfillment pipeline keeps working. These
// helpers (1) turn a built box into those lines with the box discount allocated
// across them, and (2) regroup the flat cart back into boxes for display.

import type { CartItem } from "@/components/CartProvider";
import { calculateBundlePrice, getPriceTier, round2, type BundlePrice } from "./pricing";
import { isPromoWithinWindow, PR_BOX_PROMO, type PrBoxPromo } from "./promo";
import type { ArtworkPlacement, CatalogProduct, CatalogVariant, DecorationMethod } from "./types";

// ---------------------------------------------------------------------------
// FULL-PDP box model: each item is a complete order line (its own size run +
// quantity + all PDP features), the "box" is the grouping + packaging + the 10%
// bundle discount. boxQty = program size (one of each item per box).
// ---------------------------------------------------------------------------

// A fully-configured item = the cart payload (minus line/bundle bookkeeping).
export type FullBundleItem = Omit<
  CartItem,
  "lineId" | "bundleId" | "bundleLabel" | "bundleRole" | "perBoxQty" | "perBoxUsd" | "bundleDiscountUsd" | "promoId"
>;

export type PackagingSelection = { product: CatalogProduct; branded: boolean };

export type FullBundlePrice = {
  boxQty: number;
  itemsSubtotalUsd: number; // sum of item totals
  packagingLines: { product: CatalogProduct; perUnitUsd: number; totalUsd: number; branded: boolean }[];
  packagingTotalUsd: number;
  grossUsd: number; // items + packaging, pre-discount
  qualifies: boolean;
  unmetReasons: string[];
  percent: number;
  discountUsd: number;
  totalUsd: number; // net program total
};

// Self-serve print pricing: a piece is branded (printed with the customer's art,
// full tier price) or blank (tier − print upcharge). Non-printable assets are
// always plain. The customer always supplies the art — no MOA design labor.
export function packagingUnitPrice(product: CatalogProduct, boxQty: number, branded: boolean): { perUnitUsd: number; branded: boolean } {
  const tier = getPriceTier(product, boxQty).perUnitUsd;
  const isBranded = product.printable !== false && branded;
  const perUnitUsd = isBranded ? tier : round2(Math.max(0, tier - (product.printUpchargeUsd ?? 0)));
  return { perUnitUsd, branded: isBranded };
}

export function priceFullBundle(
  items: FullBundleItem[],
  packaging: PackagingSelection[],
  boxQty: number,
  promo: PrBoxPromo = PR_BOX_PROMO,
  now: Date = new Date()
): FullBundlePrice {
  const itemsSubtotalUsd = round2(items.reduce((s, i) => s + (i.totalUsd ?? 0), 0));
  const packagingLines = packaging.map(({ product, branded }) => {
    const { perUnitUsd, branded: isBranded } = packagingUnitPrice(product, boxQty, branded);
    return { product, perUnitUsd, totalUsd: round2(perUnitUsd * boxQty), branded: isBranded };
  });
  const packagingTotalUsd = round2(packagingLines.reduce((s, l) => s + l.totalUsd, 0));
  const grossUsd = round2(itemsSubtotalUsd + packagingTotalUsd);

  const active = isPromoWithinWindow(promo, now);
  const unmetReasons: string[] = [];
  if (items.length < promo.qualify.minComponents) {
    const n = promo.qualify.minComponents - items.length;
    unmetReasons.push(`Add ${n} more item${n === 1 ? "" : "s"} (need ${promo.qualify.minComponents})`);
  }
  if (promo.qualify.requirePackaging && packaging.length === 0) unmetReasons.push("Add branded packaging");
  if (boxQty < promo.qualify.minBoxes) unmetReasons.push(`Order at least ${promo.qualify.minBoxes} boxes`);

  const qualifies = active && unmetReasons.length === 0;
  const percent = qualifies ? Math.min(1, Math.max(0, promo.discount.value)) : 0;
  const discountUsd = round2(grossUsd * percent);
  const totalUsd = round2(grossUsd - discountUsd);

  return { boxQty, itemsSubtotalUsd, packagingLines, packagingTotalUsd, grossUsd, qualifies, unmetReasons, percent, discountUsd, totalUsd };
}

// Turn a full-PDP box into cart lines, allocating the discount across every line
// (items + packaging) proportional to its total, remainder on the last line.
export type FullBundlePackaging = {
  product: CatalogProduct;
  branded: boolean;
  artworkFileName?: string;
  artworkFileUrl?: string;
  artworkNotes?: string;
  variantId?: string; // chosen colorway (colorable pieces, e.g. the box)
  colorLabel?: string;
  colorHex?: string;
};

export function buildFullBundleCartLines(args: {
  bundleId: string;
  bundleLabel: string;
  items: FullBundleItem[];
  packaging: FullBundlePackaging[];
  boxQty: number;
  promo?: PrBoxPromo;
}): { lines: Omit<CartItem, "lineId">[]; price: FullBundlePrice } {
  const promo = args.promo ?? PR_BOX_PROMO;
  const price = priceFullBundle(args.items, args.packaging.map((p) => ({ product: p.product, branded: p.branded })), args.boxQty, promo);
  const promoId = price.qualifies ? promo.id : undefined;

  const grosses = [...args.items.map((i) => i.totalUsd ?? 0), ...price.packagingLines.map((l) => l.totalUsd)];
  const totalGross = price.grossUsd;
  let remaining = price.discountUsd;
  const alloc = grosses.map((g, i) => {
    const isLast = i === grosses.length - 1;
    const d = isLast ? round2(remaining) : round2(totalGross > 0 ? price.discountUsd * (g / totalGross) : 0);
    remaining = round2(remaining - d);
    return d;
  });

  const lines: Omit<CartItem, "lineId">[] = [];
  args.items.forEach((it, i) => {
    const share = alloc[i];
    lines.push({
      ...it,
      totalUsd: round2((it.totalUsd ?? 0) - share),
      bundleId: args.bundleId,
      bundleLabel: args.bundleLabel,
      bundleRole: "component",
      perBoxQty: 1,
      perBoxUsd: args.boxQty > 0 ? round2((it.totalUsd ?? 0) / args.boxQty) : it.totalUsd,
      bundleDiscountUsd: share,
      promoId
    });
  });
  price.packagingLines.forEach((pl, j) => {
    const share = alloc[args.items.length + j];
    const p = pl.product;
    const art = args.packaging[j];
    lines.push({
      productId: p.id,
      slug: p.slug,
      displayName: p.displayName,
      skuCode: p.skuCode,
      variantId: art?.variantId ?? p.variants[0]?.id ?? `${p.id}-default`,
      colorLabel: art?.colorLabel ?? (pl.branded ? "Branded" : "Blank"),
      colorHex: art?.colorHex ?? p.variants[0]?.colorHex,
      image: p.greyFront ?? p.variants[0]?.frontImage,
      decorationIds: [],
      decorationLabel: pl.branded ? "Branded packaging" : "Blank packaging",
      sizeQty: {},
      quantity: args.boxQty,
      perUnitUsd: pl.perUnitUsd,
      decorationAdderUsd: 0,
      subtotalUsd: pl.totalUsd,
      totalUsd: round2(pl.totalUsd - share),
      artworkFileName: pl.branded ? art?.artworkFileName ?? "" : "",
      artworkFileUrl: pl.branded ? art?.artworkFileUrl : undefined,
      artworkNotes: pl.branded ? art?.artworkNotes ?? "Branded — print customer artwork" : "Blank — no print",
      bundleId: args.bundleId,
      bundleLabel: args.bundleLabel,
      bundleRole: "packaging",
      perBoxQty: 1,
      perBoxUsd: pl.perUnitUsd,
      bundleDiscountUsd: share,
      promoId,
      printed: pl.branded
    });
  });

  return { lines, price };
}

export type BundleBuilderComponent = {
  product: CatalogProduct;
  variant: CatalogVariant;
  decorationIds: DecorationMethod[];
  perBoxQty: number;
  size?: string; // single size applied across the run (assorted sizing arranged later)
  artworkFileName?: string;
  artworkFileUrl?: string;
  artworkNotes?: string;
  artworkPlacement?: ArtworkPlacement; // where the art sits on the garment (PDP-style)
};

export type BundleBuilderPackaging = {
  product: CatalogProduct;
  perBoxQty: number;
  // Each packaging asset is a printed/branded piece, so it carries its own artwork.
  artworkFileName?: string;
  artworkFileUrl?: string;
  artworkNotes?: string;
};

function decorationLabelFor(product: CatalogProduct, decorationIds: DecorationMethod[]): string {
  const labels = product.decorations.filter((d) => decorationIds.includes(d.id)).map((d) => d.label);
  return labels.length ? labels.join(" + ") : "Undecorated";
}

// Allocate the box's per-run discount across its lines, proportional to each
// line's gross subtotal, with the rounding remainder on the last line so the net
// totals sum EXACTLY to boxTotalUsd. Single source of truth for both the cart
// (buildBundleCartLines) and checkout (server re-pricing). Lines align 1:1 with
// price.lines (components first, then packaging).
export function allocateBundleDiscount(price: BundlePrice): { discountUsd: number; netUsd: number }[] {
  const gross = price.itemsSubtotalUsd;
  let remaining = price.bundleDiscountUsd;
  return price.lines.map((line, i) => {
    const isLast = i === price.lines.length - 1;
    const discountUsd = isLast
      ? round2(remaining)
      : round2(gross > 0 ? price.bundleDiscountUsd * (line.lineSubtotalUsd / gross) : 0);
    remaining = round2(remaining - discountUsd);
    return { discountUsd, netUsd: round2(line.lineSubtotalUsd - discountUsd) };
  });
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

  const alloc = allocateBundleDiscount(price);

  const lines: Omit<CartItem, "lineId">[] = price.lines.map((line, i) => {
    const share = alloc[i].discountUsd;
    const netTotal = alloc[i].netUsd;

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
      const { product, variant, decorationIds, size, artworkFileName, artworkFileUrl, artworkNotes, artworkPlacement } = sel.c;
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
        artworkNotes: artworkNotes ?? "",
        artworkPlacement
      } satisfies Omit<CartItem, "lineId">;
    }

    const { product, artworkFileName, artworkFileUrl, artworkNotes } = sel.p;
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
      artworkFileName: artworkFileName ?? "Artwork file pending",
      artworkFileUrl,
      artworkNotes: artworkNotes ?? ""
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
