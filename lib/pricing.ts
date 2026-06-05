import type { CatalogProduct, DecorationMethod, PriceTier } from "./types";
import { evaluatePromo, PR_BOX_PROMO, type PrBoxPromo, type PromoEvaluation } from "./promo";

export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export function currency(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: amount % 1 === 0 ? 0 : 2
  }).format(amount);
}

export function formatLeadTime(days: number): string {
  const weeks = Math.round(days / 7);
  return `${weeks} weeks`;
}

export function getPriceTier(product: CatalogProduct, quantity: number): PriceTier {
  const tier = product.priceTiers.find((item) => {
    const aboveMin = quantity >= item.minQty;
    const belowMax = item.maxQty === null || quantity <= item.maxQty;
    return aboveMin && belowMax;
  });

  return tier ?? product.priceTiers[0];
}

export function calculateOrderPrice(
  product: CatalogProduct,
  quantity: number,
  decorationIds: DecorationMethod[]
) {
  const normalizedQty = Number.isFinite(quantity) ? Math.max(quantity, product.moq) : product.moq;
  const tier = getPriceTier(product, normalizedQty);
  const decorations = product.decorations.filter((item) => decorationIds.includes(item.id));
  const perUnitUsd = tier.perUnitUsd;
  const decorationAdderUsd = decorations.reduce((sum, item) => sum + item.perUnitAdderUsd, 0);
  const subtotalUsd = normalizedQty * (perUnitUsd + decorationAdderUsd);
  const taxUsd = 0;
  const totalUsd = subtotalUsd + taxUsd;

  return {
    quantity: normalizedQty,
    tier,
    decorations,
    perUnitUsd,
    decorationAdderUsd,
    subtotalUsd,
    taxUsd,
    totalUsd
  };
}

// ---------------------------------------------------------------------------
// PR Box (bundle) pricing
//
// A box = N configured garment components + M packaging assets, ordered as a
// quantity of identical boxes. Each line is priced with the EXISTING per-SKU
// engine (tiers + decoration adders) at its effective run quantity
// (boxQty × perBoxQty), so itemized pricing falls out for free. The box-qty is
// clamped up to `minBoxes` (the per-line MOQ ceiling, floored by the promo).
// The promo discount is applied to the per-box subtotal and re-validated at
// checkout server-side.
// ---------------------------------------------------------------------------

export type BundleComponentInput = {
  product: CatalogProduct;
  decorationIds: DecorationMethod[];
  perBoxQty?: number; // units of this item per box (default 1)
};

export type BundlePackagingInput = {
  product: CatalogProduct;
  perBoxQty?: number; // default 1
};

export type BundleLine = {
  kind: "component" | "packaging";
  productId: string;
  displayName: string;
  perBoxQty: number;
  effectiveQty: number; // normalizedBoxQty × perBoxQty
  perUnitUsd: number; // tier unit price at effectiveQty
  decorationAdderUsd: number;
  lineUnitUsd: number; // perUnit + decorationAdder
  perBoxUsd: number; // lineUnit × perBoxQty (this item's contribution to one box)
  lineSubtotalUsd: number; // perBoxUsd × normalizedBoxQty (over the whole run)
};

export type BundlePrice = {
  boxQty: number; // requested box quantity
  normalizedBoxQty: number; // clamped up to minBoxes
  minBoxes: number;
  lines: BundleLine[];
  boxSubtotalUsd: number; // per box, pre-discount
  bundleDiscountPerBoxUsd: number;
  boxUnitUsd: number; // per box, net of discount
  itemsSubtotalUsd: number; // boxSubtotal × normalizedBoxQty (pre-discount, whole run)
  bundleDiscountUsd: number; // total discount over the run
  boxTotalUsd: number; // net total over the run
  promo: PromoEvaluation;
};

// Minimum number of boxes so every line clears its own MOQ, floored by the promo.
export function bundleMinBoxes(
  components: BundleComponentInput[],
  packaging: BundlePackagingInput[],
  floor = 1
): number {
  const lineMins = [...components, ...packaging].map((sel) => {
    const perBox = Math.max(sel.perBoxQty ?? 1, 1);
    const moq = sel.product.moq ?? 1;
    return Math.ceil(moq / perBox);
  });
  return Math.max(floor, 1, ...lineMins);
}

export function calculateBundlePrice(
  components: BundleComponentInput[],
  packaging: BundlePackagingInput[],
  boxQty: number,
  promo: PrBoxPromo = PR_BOX_PROMO,
  now: Date = new Date()
): BundlePrice {
  const minBoxes = bundleMinBoxes(components, packaging, promo.qualify.minBoxes);
  const requestedBoxQty = Number.isFinite(boxQty) ? Math.max(Math.floor(boxQty), 0) : 0;
  const normalizedBoxQty = Math.max(requestedBoxQty, minBoxes);

  const toLine = (
    kind: "component" | "packaging",
    sel: BundleComponentInput | BundlePackagingInput
  ): BundleLine => {
    const perBoxQty = Math.max(sel.perBoxQty ?? 1, 0);
    const effectiveQty = normalizedBoxQty * perBoxQty;
    const decorationIds = kind === "component" ? (sel as BundleComponentInput).decorationIds ?? [] : [];
    const priced = calculateOrderPrice(sel.product, effectiveQty, decorationIds);
    const lineUnitUsd = round2(priced.perUnitUsd + priced.decorationAdderUsd);
    return {
      kind,
      productId: sel.product.id,
      displayName: sel.product.displayName,
      perBoxQty,
      effectiveQty,
      perUnitUsd: priced.perUnitUsd,
      decorationAdderUsd: priced.decorationAdderUsd,
      lineUnitUsd,
      perBoxUsd: round2(lineUnitUsd * perBoxQty),
      lineSubtotalUsd: round2(lineUnitUsd * effectiveQty)
    };
  };

  const lines: BundleLine[] = [
    ...components.map((c) => toLine("component", c)),
    ...packaging.map((p) => toLine("packaging", p))
  ];

  const boxSubtotalUsd = round2(lines.reduce((sum, l) => sum + l.perBoxUsd, 0));

  const promoEval = evaluatePromo(
    {
      componentCount: components.length,
      hasPackaging: packaging.length > 0,
      boxQty: normalizedBoxQty,
      boxSubtotalUsd
    },
    promo,
    now
  );

  const bundleDiscountPerBoxUsd = promoEval.discountPerBoxUsd;
  const boxUnitUsd = round2(boxSubtotalUsd - bundleDiscountPerBoxUsd);
  const itemsSubtotalUsd = round2(boxSubtotalUsd * normalizedBoxQty);
  const bundleDiscountUsd = round2(bundleDiscountPerBoxUsd * normalizedBoxQty);
  const boxTotalUsd = round2(boxUnitUsd * normalizedBoxQty);

  return {
    boxQty: requestedBoxQty,
    normalizedBoxQty,
    minBoxes,
    lines,
    boxSubtotalUsd,
    bundleDiscountPerBoxUsd,
    boxUnitUsd,
    itemsSubtotalUsd,
    bundleDiscountUsd,
    boxTotalUsd,
    promo: promoEval
  };
}

// "From $X / box" for the PR Box product card: the cheapest qualifying box at the
// volume floor — the `minComponents` lowest-priced eligible items (undecorated) +
// the required packaging (or the cheapest packaging asset if none are flagged
// required), priced at `minBoxes` with the promo discount applied. Returns 0 when
// there aren't enough eligible items to form a box.
export function bundleStartingPriceUsd(
  eligible: CatalogProduct[],
  packaging: CatalogProduct[],
  promo: PrBoxPromo = PR_BOX_PROMO,
  now: Date = new Date()
): number {
  const floor = promo.qualify.minBoxes;
  const entryUnit = (p: CatalogProduct) => getPriceTier(p, floor).perUnitUsd;

  const cheapestItems = [...eligible]
    .sort((a, b) => entryUnit(a) - entryUnit(b))
    .slice(0, promo.qualify.minComponents)
    .map((product) => ({ product, decorationIds: [] as DecorationMethod[] }));
  if (cheapestItems.length < promo.qualify.minComponents) return 0;

  const required = packaging.filter((p) => p.packagingRequired);
  const pkgSel = (required.length
    ? required
    : packaging.length
      ? [[...packaging].sort((a, b) => entryUnit(a) - entryUnit(b))[0]]
      : []
  ).map((product) => ({ product }));

  return calculateBundlePrice(cheapestItems, pkgSel, floor, promo, now).boxUnitUsd;
}
