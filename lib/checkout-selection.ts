import type { CatalogProduct } from "./types";

export function validateCheckoutSelection(product: CatalogProduct, item: {
  quantity: number; variantId: string; decorationIds: string[]; fabricOptionId?: string;
  sizeBreakdown?: Record<string, number>; artworkPlacements?: unknown[];
}) {
  if (!Number.isSafeInteger(item.quantity) || item.quantity < product.moq || item.quantity > 100_000) throw new Error("Enter a whole-unit quantity at or above the product minimum");
  if (!product.variants.some((v) => v.id === item.variantId && v.isAvailable !== false)) throw new Error("This colour is not available");
  if (!Array.isArray(item.decorationIds) || !item.decorationIds.length || item.decorationIds.some((id) => !product.decorations.some((d) => d.id === id && d.isAvailable !== false))) throw new Error("Choose an available decoration method");
  if (item.fabricOptionId && !product.fabricOptions?.some((f) => f.id === item.fabricOptionId)) throw new Error("This fabric option is not available");
  if (item.artworkPlacements && (!Array.isArray(item.artworkPlacements) || item.artworkPlacements.length > 6)) throw new Error("Use up to six decoration placements");
  const sizes = item.sizeBreakdown;
  if (!sizes || typeof sizes !== "object" || Array.isArray(sizes) || Object.entries(sizes).some(([size, qty]) => !product.sizes.includes(size) || !Number.isSafeInteger(qty) || qty < 0) || Object.values(sizes).reduce((n, qty) => n + qty, 0) !== item.quantity) throw new Error("Your size run must match the order quantity");
}
