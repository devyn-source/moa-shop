// PR Box promo engine — the single source of truth for the bundle upsell.
// One config object drives the banner copy, qualification rules, the discount,
// and the active window. The banner, cart upsell, and PDP nudge all read this;
// pricing applies the discount; checkout RE-VALIDATES it server-side (never trust
// the client value). Tune the campaign here without touching component code.

export type PrBoxPromo = {
  id: string;
  active: boolean;
  startsAt?: string; // ISO; omitted = no lower bound
  endsAt?: string; // ISO; omitted = no upper bound
  label: string; // short ALL-CAPS label (Archivo)
  banner: {
    headline: string;
    subcopy: string;
    ctaText: string;
    dismissible: boolean;
  };
  // QUALIFICATION — what makes a box eligible for the discount (the mechanism).
  qualify: {
    minComponents: number; // distinct garment items in the box
    requirePackaging: boolean; // at least one packaging asset present
    minBoxes: number; // floor on the box quantity
  };
  // INCENTIVE — currently a percentage off the per-box subtotal.
  discount: {
    type: "percent";
    value: number; // 0..1 (e.g. 0.10 = 10% off)
    appliesTo: "boxSubtotal";
  };
};

// Default live campaign. Defaults encode the agreed rule: 3+ items + packaging +
// 50 boxes -> 10% off. Change values here; shape is forward-compatible with a DB row.
export const PR_BOX_PROMO: PrBoxPromo = {
  id: "pr-box-launch",
  active: true,
  label: "BUILD A PR BOX — SAVE 10%",
  banner: {
    headline: "Build a PR Box — save 10%",
    subcopy: "Bundle 3+ items with branded packaging and take 10% off every box.",
    ctaText: "Build your box",
    dismissible: true
  },
  qualify: { minComponents: 3, requirePackaging: true, minBoxes: 50 },
  discount: { type: "percent", value: 0.1, appliesTo: "boxSubtotal" }
};

export type PromoEvalInput = {
  componentCount: number;
  hasPackaging: boolean;
  boxQty: number;
  boxSubtotalUsd: number; // per-box subtotal, pre-discount
};

export type PromoEvaluation = {
  promoId: string;
  active: boolean; // promo flag on AND within the active window
  qualifies: boolean; // active AND every qualify rule satisfied
  unmetReasons: string[]; // human-readable gaps — powers the cart/PDP upsell nudge
  percent: number; // 0..1, 0 when not qualifying
  discountPerBoxUsd: number; // clamped to [0, boxSubtotal]
  discountTotalUsd: number; // discountPerBox × boxQty
};

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

function clampPercent(v: number): number {
  const n = Number.isFinite(v) ? v : 0;
  return Math.min(1, Math.max(0, n));
}

// Active flag + date window. Expired promos auto-disable with no deploy.
export function isPromoWithinWindow(promo: PrBoxPromo, now: Date = new Date()): boolean {
  if (!promo.active) return false;
  const t = now.getTime();
  if (promo.startsAt && t < new Date(promo.startsAt).getTime()) return false;
  if (promo.endsAt && t > new Date(promo.endsAt).getTime()) return false;
  return true;
}

// Evaluate a candidate box against the promo. Pure + deterministic given `now`,
// so it runs identically on the server (checkout re-validation) and the client.
export function evaluatePromo(
  input: PromoEvalInput,
  promo: PrBoxPromo = PR_BOX_PROMO,
  now: Date = new Date()
): PromoEvaluation {
  const active = isPromoWithinWindow(promo, now);

  const componentCount = input.componentCount ?? 0;
  const boxQty = input.boxQty ?? 0;
  const boxSubtotalUsd = Math.max(0, input.boxSubtotalUsd ?? 0);
  const need = promo.qualify;

  const unmetReasons: string[] = [];
  if (componentCount < need.minComponents) {
    const short = need.minComponents - componentCount;
    unmetReasons.push(`Add ${short} more item${short === 1 ? "" : "s"} (need ${need.minComponents})`);
  }
  if (need.requirePackaging && !input.hasPackaging) {
    unmetReasons.push("Add branded packaging");
  }
  if (boxQty < need.minBoxes) {
    unmetReasons.push(`Order at least ${need.minBoxes} boxes`);
  }

  const qualifies = active && unmetReasons.length === 0;
  const percent = qualifies ? clampPercent(promo.discount.value) : 0;
  // Clamp so a discount can never exceed the subtotal.
  const discountPerBoxUsd = Math.min(boxSubtotalUsd, round2(boxSubtotalUsd * percent));
  const discountTotalUsd = round2(discountPerBoxUsd * Math.max(boxQty, 0));

  return {
    promoId: promo.id,
    active,
    qualifies,
    unmetReasons,
    percent,
    discountPerBoxUsd,
    discountTotalUsd
  };
}
