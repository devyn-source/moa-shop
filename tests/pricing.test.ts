import { describe, it, expect } from "vitest";
import {
  currency,
  formatLeadTime,
  getPriceTier,
  calculateOrderPrice,
  WOVEN_LABEL_ADDER_USD,
  EXTRA_PLACEMENT_ADDER_USD,
} from "@/lib/pricing";
import type { CatalogProduct } from "@/lib/types";

// Minimal product fixture — pricing only reads priceTiers / decorations / moq.
const product = {
  moq: 50,
  priceTiers: [
    { minQty: 50, maxQty: 99, perUnitUsd: 100 },
    { minQty: 100, maxQty: 249, perUnitUsd: 89 },
    { minQty: 250, maxQty: 499, perUnitUsd: 84 },
    { minQty: 500, maxQty: null, perUnitUsd: 80 },
  ],
  decorations: [
    { id: "screen_print", perUnitAdderUsd: 5 },
    { id: "embroidery", perUnitAdderUsd: 8 },
  ],
} as unknown as CatalogProduct;

describe("currency", () => {
  it("drops cents on whole dollars", () => expect(currency(250)).toBe("$250"));
  it("keeps cents on fractional", () => expect(currency(12.5)).toBe("$12.50"));
});

describe("formatLeadTime", () => {
  it("converts days to rounded weeks", () => {
    expect(formatLeadTime(70)).toBe("10 weeks");
    expect(formatLeadTime(38)).toBe("5 weeks");
  });
});

describe("getPriceTier", () => {
  it("selects the tier containing the quantity", () => {
    expect(getPriceTier(product, 50).perUnitUsd).toBe(100);
    expect(getPriceTier(product, 120).perUnitUsd).toBe(89);
    expect(getPriceTier(product, 600).perUnitUsd).toBe(80);
  });
  it("respects tier boundaries", () => {
    expect(getPriceTier(product, 99).perUnitUsd).toBe(100);
    expect(getPriceTier(product, 100).perUnitUsd).toBe(89);
  });
  it("falls back to the first tier below all minimums", () => {
    expect(getPriceTier(product, 10).perUnitUsd).toBe(100);
  });
});

describe("calculateOrderPrice", () => {
  it("normalizes below-MOQ quantity up to the MOQ", () => {
    const r = calculateOrderPrice(product, 10, []);
    expect(r.quantity).toBe(50);
    expect(r.totalUsd).toBe(50 * 100);
  });
  it("adds decoration adders per unit", () => {
    const r = calculateOrderPrice(product, 100, ["screen_print", "embroidery"] as never);
    expect(r.perUnitUsd).toBe(89);
    expect(r.decorationAdderUsd).toBe(13);
    expect(r.totalUsd).toBe(100 * (89 + 13));
  });
  it("is undecorated when no methods chosen", () => {
    const r = calculateOrderPrice(product, 250, []);
    expect(r.decorationAdderUsd).toBe(0);
    expect(r.totalUsd).toBe(250 * 84);
  });
});

describe("calculateOrderPrice — upsells (server-side)", () => {
  it("includes the first placement free, charges each extra", () => {
    // 1 placement → no extra fee
    expect(calculateOrderPrice(product, 100, [], { placementCount: 1 }).extraPlacementAdderUsd).toBe(0);
    // 3 placements → 2 extra × 2.50
    const r = calculateOrderPrice(product, 100, [], { placementCount: 3 });
    expect(r.extraPlacementAdderUsd).toBe(2 * EXTRA_PLACEMENT_ADDER_USD);
    expect(r.totalUsd).toBe(100 * (89 + 2 * EXTRA_PLACEMENT_ADDER_USD));
  });
  it("treats 0 or undefined placement count as no extra fee", () => {
    expect(calculateOrderPrice(product, 100, [], { placementCount: 0 }).extraPlacementAdderUsd).toBe(0);
    expect(calculateOrderPrice(product, 100, []).extraPlacementAdderUsd).toBe(0);
  });
  it("charges the woven-label adder when chosen", () => {
    const r = calculateOrderPrice(product, 100, [], { wovenLabel: true });
    expect(r.wovenAdderUsd).toBe(WOVEN_LABEL_ADDER_USD);
    expect(r.totalUsd).toBe(100 * (89 + WOVEN_LABEL_ADDER_USD));
  });
  it("stacks decoration + extra placements + woven into the charged total", () => {
    const r = calculateOrderPrice(product, 100, ["screen_print"] as never, {
      placementCount: 2,
      wovenLabel: true,
    });
    // base 89 + screenprint 5 + 1 extra placement 2.50 + woven 2 = 98.50/unit
    expect(r.decorationAdderUsd).toBe(5 + EXTRA_PLACEMENT_ADDER_USD + WOVEN_LABEL_ADDER_USD);
    expect(r.totalUsd).toBe(100 * (89 + 5 + EXTRA_PLACEMENT_ADDER_USD + WOVEN_LABEL_ADDER_USD));
  });
});
