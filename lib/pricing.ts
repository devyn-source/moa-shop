import type { CatalogProduct, DecorationMethod, PriceTier } from "./types";

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
