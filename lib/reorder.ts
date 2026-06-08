import type { CartItem } from "@/components/CartProvider";
import type { CatalogProduct, ShopOrder } from "@/lib/types";

// Rebuild a past order's exact config into a reorderable cart item. Carries the
// bundle fields so a whole PR Box can be re-added together (see ReorderBundleButton).
export function reorderFrom(order: ShopOrder, product: CatalogProduct | undefined): Omit<CartItem, "lineId"> | null {
  if (!product) return null;
  const variant = product.variants.find((v) => v.id === order.variantId);
  return {
    productId: order.productId,
    slug: product.slug,
    displayName: product.displayName,
    skuCode: product.skuCode,
    variantId: order.variantId,
    colorLabel: variant?.colorLabel ?? "",
    colorHex: variant?.colorHex,
    image: product.greyFront ?? variant?.frontImage,
    decorationIds: order.decorationIds as string[],
    decorationLabel: product.decorations.filter((d) => order.decorationIds.includes(d.id)).map((d) => d.label).join(" + ") || "Undecorated",
    sizeQty: order.sizeBreakdown ?? {},
    quantity: order.quantity,
    perUnitUsd: order.perUnitUsd,
    decorationAdderUsd: order.decorationAdderUsd,
    subtotalUsd: order.subtotalUsd,
    totalUsd: order.totalUsd,
    artworkFileName: order.artworkFileName,
    artworkFileUrl: order.artworkFileUrl,
    artworkNotes: order.artworkNotes,
    artworkPlacement: order.artworkPlacement,
    ...(order.bundleId
      ? { bundleId: order.bundleId, bundleLabel: order.bundleLabel, bundleRole: order.bundleRole, bundleDiscountUsd: order.bundleDiscountUsd }
      : {})
  };
}
