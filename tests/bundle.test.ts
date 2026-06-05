import { describe, it, expect } from "vitest";
import {
  bundleMinBoxes,
  calculateBundlePrice,
  type BundleComponentInput,
  type BundlePackagingInput
} from "@/lib/pricing";
import { evaluatePromo, type PrBoxPromo } from "@/lib/promo";
import type { CatalogProduct } from "@/lib/types";

// --- fixtures (pricing reads id/displayName/moq/priceTiers/decorations) ---
const tee = {
  id: "prod-tee",
  displayName: "Tee",
  moq: 50,
  priceTiers: [
    { minQty: 50, maxQty: 149, perUnitUsd: 44 },
    { minQty: 150, maxQty: null, perUnitUsd: 39 }
  ],
  decorations: [{ id: "screen_print", perUnitAdderUsd: 4 }]
} as unknown as CatalogProduct;

const cap = {
  id: "prod-cap",
  displayName: "Cap",
  moq: 50,
  priceTiers: [
    { minQty: 50, maxQty: 199, perUnitUsd: 34 },
    { minQty: 200, maxQty: null, perUnitUsd: 31 }
  ],
  decorations: [{ id: "embroidery", perUnitAdderUsd: 7.5 }]
} as unknown as CatalogProduct;

const tote = {
  id: "prod-tote",
  displayName: "Tote",
  moq: 50,
  priceTiers: [{ minQty: 50, maxQty: null, perUnitUsd: 38 }],
  decorations: []
} as unknown as CatalogProduct;

const box = {
  id: "pkg-rigid-box",
  displayName: "Rigid Box",
  moq: 50,
  priceTiers: [{ minQty: 50, maxQty: null, perUnitUsd: 11.25 }],
  decorations: []
} as unknown as CatalogProduct;

// Default-shaped promo, no window (always within window when active).
const promo: PrBoxPromo = {
  id: "test-promo",
  active: true,
  label: "TEST",
  banner: { headline: "", subcopy: "", ctaText: "", dismissible: true },
  qualify: { minComponents: 3, requirePackaging: true, minBoxes: 50 },
  discount: { type: "percent", value: 0.1, appliesTo: "boxSubtotal" }
};

const NOW = new Date("2026-06-05T12:00:00Z");

const components = (...c: BundleComponentInput[]) => c;
const pkg = (...p: BundlePackagingInput[]) => p;

describe("bundleMinBoxes", () => {
  it("takes the max MOQ ceiling across lines, floored by the promo", () => {
    expect(
      bundleMinBoxes([{ product: tee, decorationIds: [] }], [{ product: box }], 50)
    ).toBe(50);
  });
  it("divides MOQ by perBoxQty", () => {
    // 2 units per box, MOQ 50 -> 25 boxes clears it; floor 1 here
    expect(
      bundleMinBoxes([{ product: tee, decorationIds: [], perBoxQty: 2 }], [], 1)
    ).toBe(25);
  });
});

describe("calculateBundlePrice — qualifying box", () => {
  const result = calculateBundlePrice(
    components(
      { product: tee, decorationIds: ["screen_print"] as never },
      { product: cap, decorationIds: ["embroidery"] as never },
      { product: tote, decorationIds: [] }
    ),
    pkg({ product: box }),
    100,
    promo,
    NOW
  );

  it("prices each line at its tier + decoration adder", () => {
    const byId = Object.fromEntries(result.lines.map((l) => [l.productId, l]));
    expect(byId["prod-tee"].lineUnitUsd).toBe(48); // 44 + 4
    expect(byId["prod-cap"].lineUnitUsd).toBe(41.5); // 34 + 7.5
    expect(byId["prod-tote"].lineUnitUsd).toBe(38);
    expect(byId["pkg-rigid-box"].lineUnitUsd).toBe(11.25);
  });

  it("sums an itemized per-box subtotal", () => {
    expect(result.boxSubtotalUsd).toBe(138.75); // 48 + 41.5 + 38 + 11.25
  });

  it("qualifies and applies the 10% bundle discount", () => {
    expect(result.promo.qualifies).toBe(true);
    expect(result.bundleDiscountPerBoxUsd).toBe(13.88); // round2(13.875)
    expect(result.boxUnitUsd).toBe(124.87); // 138.75 - 13.88
  });

  it("scales to the run", () => {
    expect(result.normalizedBoxQty).toBe(100);
    expect(result.itemsSubtotalUsd).toBe(13875);
    expect(result.bundleDiscountUsd).toBe(1388);
    expect(result.boxTotalUsd).toBe(12487);
  });
});

describe("calculateBundlePrice — not qualifying", () => {
  it("withholds the discount and explains why when short an item", () => {
    const r = calculateBundlePrice(
      components(
        { product: tee, decorationIds: [] },
        { product: cap, decorationIds: [] }
      ),
      pkg({ product: box }),
      100,
      promo,
      NOW
    );
    expect(r.promo.qualifies).toBe(false);
    expect(r.promo.unmetReasons).toContain("Add 1 more item (need 3)");
    expect(r.bundleDiscountPerBoxUsd).toBe(0);
    expect(r.boxUnitUsd).toBe(r.boxSubtotalUsd);
  });

  it("flags missing packaging", () => {
    const r = calculateBundlePrice(
      components(
        { product: tee, decorationIds: [] },
        { product: cap, decorationIds: [] },
        { product: tote, decorationIds: [] }
      ),
      pkg(),
      100,
      promo,
      NOW
    );
    expect(r.promo.unmetReasons).toContain("Add branded packaging");
    expect(r.promo.qualifies).toBe(false);
  });
});

describe("calculateBundlePrice — box-qty clamping", () => {
  it("clamps the requested box qty up to minBoxes", () => {
    const r = calculateBundlePrice(
      components(
        { product: tee, decorationIds: [] },
        { product: cap, decorationIds: [] },
        { product: tote, decorationIds: [] }
      ),
      pkg({ product: box }),
      10, // below the 50-box floor
      promo,
      NOW
    );
    expect(r.boxQty).toBe(10);
    expect(r.normalizedBoxQty).toBe(50);
    expect(r.lines[0].effectiveQty).toBe(50);
  });
});

describe("evaluatePromo — guardrails", () => {
  it("respects the active window (expired promo never qualifies)", () => {
    const expired: PrBoxPromo = { ...promo, endsAt: "2026-01-01T00:00:00Z" };
    const e = evaluatePromo(
      { componentCount: 3, hasPackaging: true, boxQty: 100, boxSubtotalUsd: 100 },
      expired,
      NOW
    );
    expect(e.active).toBe(false);
    expect(e.qualifies).toBe(false);
    expect(e.discountPerBoxUsd).toBe(0);
  });

  it("clamps a discount so it cannot exceed the subtotal", () => {
    const over: PrBoxPromo = { ...promo, discount: { type: "percent", value: 2, appliesTo: "boxSubtotal" } };
    const e = evaluatePromo(
      { componentCount: 3, hasPackaging: true, boxQty: 50, boxSubtotalUsd: 100 },
      over,
      NOW
    );
    expect(e.discountPerBoxUsd).toBe(100);
  });

  it("treats a 0% promo as 0 (no falsy flip to a default)", () => {
    const zero: PrBoxPromo = { ...promo, discount: { type: "percent", value: 0, appliesTo: "boxSubtotal" } };
    const e = evaluatePromo(
      { componentCount: 3, hasPackaging: true, boxQty: 50, boxSubtotalUsd: 100 },
      zero,
      NOW
    );
    expect(e.qualifies).toBe(true);
    expect(e.discountPerBoxUsd).toBe(0);
  });
});
