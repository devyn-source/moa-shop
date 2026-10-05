import { describe, expect, it } from "vitest";
import { validateCheckoutSelection } from "@/lib/checkout-selection";
import { seedProducts } from "@/lib/seed";
const product = seedProducts.find((p) => p.slug === "heavyweight-tee")!;
const selection = { quantity: 50, variantId: product.variants[0].id, decorationIds: [product.decorations[0].id], sizeBreakdown: { M: 50 } };
describe("server-side size and quantity validation", () => {
  it("accepts an exact size run for an available colour and method", () => {
    expect(() => validateCheckoutSelection(product, selection)).not.toThrow();
  });
  it.each([NaN, 0, 49, 50.5, 100001])("rejects invalid quantity %s rather than silently repricing it", (quantity) => {
    expect(() => validateCheckoutSelection(product, { ...selection, quantity })).toThrow("quantity");
  });
  it("rejects mismatched runs, unknown sizes and unavailable choices", () => {
    expect(() => validateCheckoutSelection(product, { ...selection, sizeBreakdown: { M: 49 } })).toThrow("size run");
    expect(() => validateCheckoutSelection(product, { ...selection, sizeBreakdown: { Unknown: 50 } })).toThrow("size run");
    expect(() => validateCheckoutSelection(product, { ...selection, variantId: "unknown" })).toThrow("colour");
    expect(() => validateCheckoutSelection(product, { ...selection, decorationIds: ["unknown"] })).toThrow("method");
    expect(() => validateCheckoutSelection(product, { ...selection, fabricOptionId: "unknown" })).toThrow("fabric");
  });
});
