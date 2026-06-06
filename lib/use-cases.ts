// Use-case landing pages + named kit presets. One data file drives N landing
// pages (/for/<slug>) and N pre-filled box builders (/p/pr-box?kit=<id>). The kit
// presets reuse the PR Box bundle engine — a kit is just a curated set of
// components the builder opens pre-loaded. Adding a new use case / kit = editing
// this file, not building a page.

import type { DecorationMethod, ProductCategory } from "./types";

export type KitComponent = {
  productId: string;
  decorationIds?: DecorationMethod[];
  perBoxQty?: number;
};

export type KitPreset = {
  id: string;
  name: string;
  components: KitComponent[];
};

export type UseCase = {
  slug: string;
  navLabel: string; // short label for footer/nav
  eyebrow: string;
  headline: string;
  subcopy: string;
  frame: string; // the "merch is media" tie-in line
  kitId: string; // featured kit preset → builder ?kit=
  featuredCategories: ProductCategory[]; // products to showcase below the hero
  proof: string[]; // 3 proof points
  ctaLabel: string;
};

// ---------------------------------------------------------------------------
// Kit presets — curated bundles the box builder opens pre-loaded.
// ---------------------------------------------------------------------------
export const KIT_PRESETS: KitPreset[] = [
  {
    id: "new-hire",
    name: "New Hire Kit",
    components: [
      { productId: "prod-heavyweight-hoodie" },
      { productId: "prod-heavyweight-tee" },
      { productId: "prod-dad-hat" }
    ]
  },
  {
    id: "event",
    name: "Event Kit",
    components: [
      { productId: "prod-heavyweight-tee" },
      { productId: "prod-standard-tote" },
      { productId: "prod-five-panel" }
    ]
  },
  {
    id: "investor",
    name: "Investor Gift Kit",
    components: [
      { productId: "prod-knit-sweater" },
      { productId: "prod-standard-tote" },
      { productId: "prod-beanie" }
    ]
  },
  {
    id: "launch",
    name: "Launch Kit",
    components: [
      { productId: "prod-heavyweight-hoodie" },
      { productId: "prod-heavyweight-tee" },
      { productId: "prod-beanie" }
    ]
  }
];

export function getKit(id: string | undefined | null): KitPreset | null {
  if (!id) return null;
  return KIT_PRESETS.find((k) => k.id === id) ?? null;
}

// ---------------------------------------------------------------------------
// Use-case landing pages.
// ---------------------------------------------------------------------------
export const USE_CASES: UseCase[] = [
  {
    slug: "new-hire-kits",
    navLabel: "New-hire kits",
    eyebrow: "Onboarding",
    headline: "New-hire kits they'll actually wear.",
    subcopy:
      "Welcome every hire with a branded box — hoodie, tee, cap, packed and shipped to spec. No quotes, no sales calls, one price per box.",
    frame: "Every hire becomes a walking ad for your brand. That's the point.",
    kitId: "new-hire",
    featuredCategories: ["hoodie", "tee", "headwear"],
    proof: [
      "One per-box price — instant, no RFQ",
      "Premium blanks, made to order to spec",
      "Branded box, tissue + card included"
    ],
    ctaLabel: "Build your new-hire kit"
  },
  {
    slug: "event-merch",
    navLabel: "Event merch",
    eyebrow: "Events & booths",
    headline: "Booth merch people line up for.",
    subcopy:
      "Conference giveaways and event kits that don't end up in the hotel trash — tees, totes, caps your audience keeps and wears.",
    frame: "The right giveaway gets worn home and photographed. That's reach you don't pay for twice.",
    kitId: "event",
    featuredCategories: ["tee", "bag", "headwear"],
    proof: [
      "Volume pricing that scales with your run",
      "Lead times you can plan an event around",
      "Decorate every piece to your brand"
    ],
    ctaLabel: "Build your event kit"
  },
  {
    slug: "investor-gifting",
    navLabel: "Investor gifting",
    eyebrow: "Gifting",
    headline: "Gifts investors actually keep.",
    subcopy:
      "Premium knitwear, totes and accessories, boxed and shipped — the kind of gift that says the round closed and the brand is real.",
    frame: "A gift they keep on the desk is your brand in the room long after the meeting.",
    kitId: "investor",
    featuredCategories: ["knitwear", "bag", "outerwear"],
    proof: [
      "Elevated, premium-feel pieces",
      "Branded gift box + card, ready to send",
      "Ship to one address or many"
    ],
    ctaLabel: "Build your gift kit"
  },
  {
    slug: "launch-merch",
    navLabel: "Launch merch",
    eyebrow: "Launches & drops",
    headline: "Launch merch that looks like a brand, not swag.",
    subcopy:
      "Hoodies, tees and caps for your launch, drop or capsule — production-grade blanks, decorated and packed to look the part.",
    frame: "Your merch is your most-worn ad. Make the first impression a good one.",
    kitId: "launch",
    featuredCategories: ["hoodie", "tee", "headwear"],
    proof: [
      "Production-grade blanks, not promo junk",
      "Instant price, made to order",
      "Build it into a branded PR box"
    ],
    ctaLabel: "Build your launch kit"
  }
];

export function getUseCase(slug: string | undefined | null): UseCase | null {
  if (!slug) return null;
  return USE_CASES.find((u) => u.slug === slug) ?? null;
}
