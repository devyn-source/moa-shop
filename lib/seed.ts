import type {
  CatalogDecoration,
  CatalogProduct,
  CatalogVariant,
  PackagingAssetKind,
  PriceTier,
  Vendor
} from "./types";

const coreDecorations: CatalogDecoration[] = [
  {
    id: "screen_print",
    label: "Screen print",
    description: "Plastisol or water-based print for front, back, sleeve, or bag panel artwork.",
    perUnitAdderUsd: 4,
    placementZones: ["front", "back", "sleeve"],
    maxColors: 4,
    isAvailable: true
  },
  {
    id: "embroidery",
    label: "Embroidery",
    description: "Flat embroidery for chest, cap front, pocket, side seam, or patch placement.",
    perUnitAdderUsd: 7.5,
    placementZones: ["chest", "cap front", "pocket", "side seam"],
    maxColors: 12,
    isAvailable: true
  },
  {
    id: "rubber_applique",
    label: "Rubber appliqué",
    description: "Raised silicone/rubber appliqué badge with a soft, tactile finish.",
    perUnitAdderUsd: 6.5,
    placementZones: ["front", "chest", "sleeve"],
    maxColors: 3,
    isAvailable: true
  }
  // Woven label + woven patch are handled by their own dedicated modals (added
  // separately) — they are intentionally NOT in the standard decoration list.
];

export const seedVendors: Vendor[] = [
  {
    id: "vendor-best-cover",
    name: "ZhangJiaGang Best Cover Fashion Co LTD",
    country: "China",
    contactName: "Factory desk",
    contactEmail: "production@example.com",
    contactWechat: "bestcover-production",
    notes: "Default cut-and-sew apparel and accessories factory for the MVP catalog.",
    isActive: true
  },
  {
    id: "vendor-headwear-one",
    name: "MOA Headwear Partner",
    country: "China",
    contactName: "Headwear desk",
    contactEmail: "headwear@example.com",
    contactWechat: "moa-headwear",
    notes: "Dedicated headwear and small accessory supplier.",
    isActive: true
  }
];

// Canonical MOA Catalog colorway system — 9 colors (6 core neutrals + 3 accents).
// One vocabulary across the whole catalog so a brand can match a hoodie + tee + hat.
// Each SKU offers a category-appropriate, hero-ordered subset (see colorSet calls).
// Hex = approved on-screen mockup target; TCX = the production textile spec.
const PALETTE = {
  jetBlack:    { label: "Jet Black",    hex: "#2D2C2F", tcx: "19-0303 TCX" },
  bone:        { label: "Bone",         hex: "#D6D1C0", tcx: "12-0105 TCX" },
  natural:     { label: "Natural",      hex: "#CBC3B4", tcx: "13-0401 TCX" },
  heatherGray: { label: "Heather Gray", hex: "#C5C6C7", tcx: "14-4102 TCX" },
  ink:         { label: "Ink",          hex: "#3C3F4A", tcx: "19-4019 TCX" },
  navy:        { label: "Navy",         hex: "#2B2E43", tcx: "19-3920 TCX" },
  forest:      { label: "Forest",       hex: "#264E36", tcx: "19-6050 TCX" },
  oxblood:     { label: "Oxblood",      hex: "#70393F", tcx: "19-1524 TCX" },
  walnut:      { label: "Walnut",       hex: "#776A5F", tcx: "18-1112 TCX" }
} as const;

type PaletteId = keyof typeof PALETTE;

// First id in `ids` is the hero (default) color for that SKU.
function colorways(slug: string, label: string, fabric: string, ids: PaletteId[]): CatalogVariant[] {
  return ids.map((id) => {
    const c = PALETTE[id];
    return {
      id: `${slug}-${id}`,
      label,
      fabric,
      colorLabel: c.label,
      colorHex: c.hex,
      colorTcx: c.tcx,
      mockupTemplateUrl: `/mockups/${slug}-${id}.pdf`,
      isAvailable: true
    };
  });
}

const apparelProducts: CatalogProduct[] = [
  {
    // HIDDEN internal $1 test SKU — validates the live order pipeline end-to-end
    // cheaply. isPublished:false keeps it out of the catalog; reach it directly
    // at /p/test-sku. MOQ 1 × $1, zero decoration adder → ~$1 real Stripe charge.
    id: "prod-test-sku",
    slug: "test-sku",
    skuCode: "TEST001",
    category: "tee",
    displayName: "Internal Test SKU",
    sizes: ["OS"],
    fitNotes: "Internal pipeline test — not for sale.",
    greyFront: "/products/heavyweight-tee/base-front.png",
    headline: "Internal $1 end-to-end test product.",
    description: "Hidden SKU used to validate the live catalog order pipeline. Not for sale.",
    bestFor: "Internal testing",
    visual: "tee",
    defaultVendorId: "vendor-best-cover",
    vendorUnitCostUsd: 0.5,
    moq: 1,
    leadTimeDays: 1,
    isPublished: false,
    sortOrder: 999,
    variants: [
      {
        id: "test-black",
        label: "Black",
        fabric: "Test fabric",
        colorLabel: "Black",
        colorHex: "#1a1a1a",
        mockupTemplateUrl: "",
        isAvailable: true,
        frontImage: "/products/heavyweight-tee/base-front.png",
        recolor: false
      }
    ],
    decorations: [
      {
        id: "screen_print",
        label: "Screen print (test)",
        description: "Test decoration — no upcharge.",
        perUnitAdderUsd: 0,
        placementZones: ["left-chest", "center-chest", "full-front"],
        maxColors: 4,
        isAvailable: true
      }
    ],
    priceTiers: [{ minQty: 1, maxQty: null, perUnitUsd: 1 }]
  },
  {
    id: "prod-knit-sweater",
    slug: "knit-sweater",
    skuCode: "KNT101",
    category: "knitwear",
    displayName: "Cotton Knit Sweater",
    sizes: ["XS", "S", "M", "L", "XL", "XXL"],
    fitNotes: "Relaxed crew · 100% cotton knit · ribbed collar, cuffs + hem",
    greyFront: "/products/knit-sweater/base-front.png",
    greyBack: "/products/knit-sweater/base-back.png",
    headline: "Midweight 100% cotton crewneck knit.",
    description:
      "A midweight crewneck knit in 100% cotton, with a ribbed collar, cuffs, and hem. A clean, elevated layering piece for premium drops and capsule programs. Decorates best with embroidery, woven patches, and woven labels.",
    bestFor: "Premium capsules, elevated staff kits, creator drops",
    visual: "tee",
    defaultVendorId: "vendor-best-cover",
    vendorUnitCostUsd: 31,
    moq: 50,
    leadTimeDays: 52,
    isPublished: true,
    sortOrder: 8,
    variants: colorways("knit-sweater", "Crewneck sweater", "100% cotton knit", ["heatherGray", "jetBlack", "bone", "navy", "forest", "oxblood"]),
    decorations: coreDecorations.filter((item) =>
      ["embroidery", "rubber_applique"].includes(item.id)
    ),
    priceTiers: [
      { minQty: 50, maxQty: 99, perUnitUsd: 97 },
      { minQty: 100, maxQty: 249, perUnitUsd: 86 },
      { minQty: 250, maxQty: 499, perUnitUsd: 82 },
      { minQty: 500, maxQty: null, perUnitUsd: 78 }
    ]
  },
  {
    id: "prod-heavyweight-hoodie",
    slug: "heavyweight-hoodie",
    skuCode: "HDY101",
    category: "hoodie",
    displayName: "Heavyweight Hoodie",
    sizes: ["XS", "S", "M", "L", "XL", "XXL"],
    fitNotes: "Oversized · runs true to size · check size chart for shoulder/length",
    greyFront: "/products/heavyweight-hoodie/base-front.png",
    greyBack: "/products/heavyweight-hoodie/base-back.png",
    headline: "Premium fleece hoodie with a proven oversized fit.",
    description:
      "A bounded MOA hoodie program built around heavyweight fleece, clean construction, and a short menu of decoration options. Designed for brand drops, team capsules, tour merch, and elevated corporate merchandise.",
    bestFor: "Brand drops, music merch, creator capsules",
    visual: "hoodie",
    defaultVendorId: "vendor-best-cover",
    vendorUnitCostUsd: 32,
    moq: 50,
    leadTimeDays: 56,
    isPublished: true,
    sortOrder: 10,
    variants: colorways("heavyweight-hoodie", "Oversized pullover", "420gsm cotton/poly fleece", ["jetBlack", "heatherGray", "bone", "navy", "forest", "oxblood"]),
    decorations: coreDecorations.filter((item) =>
      ["screen_print", "embroidery", "rubber_applique"].includes(item.id)
    ),
    priceTiers: [
      { minQty: 50, maxQty: 99, perUnitUsd: 100 },
      { minQty: 100, maxQty: 249, perUnitUsd: 89 },
      { minQty: 250, maxQty: 499, perUnitUsd: 84 },
      { minQty: 500, maxQty: null, perUnitUsd: 80 }
    ]
  },
  {
    id: "prod-heavyweight-tee",
    slug: "heavyweight-tee",
    skuCode: "TEE101",
    category: "tee",
    displayName: "Heavyweight Tee",
    sizes: ["XS", "S", "M", "L", "XL", "XXL"],
    fitNotes: "Boxy cut · drop shoulder · pre-shrunk compact jersey",
    greyFront: "/products/heavyweight-tee/base-front.png",
    greyBack: "/products/heavyweight-tee/base-back.png",
    headline: "Boxy premium tee for fast, reliable merch programs.",
    description:
      "A heavyweight tee with a clean boxy cut, stable shrinkage, and reliable decoration surfaces. The fastest path to a polished MOA-standard merch drop.",
    bestFor: "Launch merch, events, uniforms, artist drops",
    visual: "tee",
    defaultVendorId: "vendor-best-cover",
    vendorUnitCostUsd: 14,
    moq: 50,
    leadTimeDays: 42,
    isPublished: true,
    sortOrder: 20,
    variants: colorways("heavyweight-tee", "Boxy tee", "260gsm compact cotton jersey", ["bone", "jetBlack", "heatherGray", "navy", "forest", "oxblood"]),
    decorations: coreDecorations.filter((item) =>
      ["screen_print", "embroidery", "rubber_applique"].includes(item.id)
    ),
    priceTiers: [
      { minQty: 50, maxQty: 149, perUnitUsd: 44 },
      { minQty: 150, maxQty: 299, perUnitUsd: 39 },
      { minQty: 300, maxQty: 599, perUnitUsd: 37 },
      { minQty: 600, maxQty: null, perUnitUsd: 35 }
    ]
  },
  {
    id: "prod-wide-leg-sweatpant",
    slug: "wide-leg-sweatpant",
    skuCode: "SWP101",
    category: "bottoms",
    displayName: "Wide Leg Sweatpant",
    sizes: ["XS", "S", "M", "L", "XL", "XXL"],
    fitNotes: "Wide leg · elastic drawstring waist · 380gsm brushed fleece",
    greyFront: "/products/wide-leg-sweatpant/base-front.png",
    greyBack: "/products/wide-leg-sweatpant/base-back.png",
    headline: "Heavyweight wide-leg sweatpant with a relaxed drape.",
    description:
      "A wide-leg heavyweight fleece sweatpant with an elastic drawstring waist and back patch pocket. Clean, drapey, and built to pair with the hoodie program. Designed for brand drops, loungewear capsules, and premium staff kits.",
    bestFor: "Loungewear capsules, creator drops, premium staff kits",
    visual: "pant",
    defaultVendorId: "vendor-best-cover",
    vendorUnitCostUsd: 28,
    moq: 50,
    leadTimeDays: 50,
    isPublished: true,
    sortOrder: 30,
    variants: colorways("wide-leg-sweatpant", "Wide-leg sweatpant", "380gsm brushed fleece", ["heatherGray", "jetBlack", "ink", "bone"]),
    decorations: coreDecorations.filter((item) =>
      ["screen_print", "embroidery", "rubber_applique"].includes(item.id)
    ),
    priceTiers: [
      { minQty: 50, maxQty: 99, perUnitUsd: 88 },
      { minQty: 100, maxQty: 199, perUnitUsd: 78 },
      { minQty: 200, maxQty: 399, perUnitUsd: 74 },
      { minQty: 400, maxQty: null, perUnitUsd: 70 }
    ]
  },
  {
    id: "prod-work-jacket",
    slug: "work-jacket",
    skuCode: "JKT101",
    category: "outerwear",
    displayName: "Canvas Work Jacket",
    sizes: ["S", "M", "L", "XL", "XXL"],
    fitNotes: "Structured chore · 12oz canvas · room for layering",
    greyFront: "/products/work-jacket/base-front.png",
    greyBack: "/products/work-jacket/base-back.png",
    headline: "Structured jacket with premium workwear utility.",
    description:
      "A sturdy canvas jacket with clean paneling, controlled trims, and durable decoration placements. Built for brands that want a hero piece in the catalog.",
    bestFor: "Retail capsules, hospitality teams, field uniforms",
    visual: "jacket",
    defaultVendorId: "vendor-best-cover",
    vendorUnitCostUsd: 48,
    moq: 50,
    leadTimeDays: 70,
    isPublished: true,
    sortOrder: 1,
    variants: colorways("work-jacket", "Chore jacket", "12oz cotton canvas", ["walnut", "jetBlack", "natural", "forest"]),
    decorations: coreDecorations.filter((item) =>
      ["embroidery", "rubber_applique"].includes(item.id)
    ),
    priceTiers: [
      { minQty: 50, maxQty: 74, perUnitUsd: 150 },
      { minQty: 75, maxQty: 149, perUnitUsd: 135 },
      { minQty: 150, maxQty: 299, perUnitUsd: 125 },
      { minQty: 300, maxQty: null, perUnitUsd: 120 }
    ]
  },
  {
    id: "prod-zip-sherpa",
    slug: "zip-sherpa",
    skuCode: "SHP101",
    category: "outerwear",
    displayName: "Zip Sherpa",
    sizes: ["XS", "S", "M", "L", "XL", "XXL"],
    fitNotes: "Relaxed fit · heavyweight sherpa fleece · full zip · stand collar",
    greyFront: "/products/zip-sherpa/base-front.png",
    greyBack: "/products/zip-sherpa/base-back.png",
    headline: "Plush full-zip sherpa with a clean stand collar.",
    description:
      "A heavyweight sherpa fleece full-zip with a stand collar and zip hand pockets. Premium cozy outerwear for cold-weather drops and elevated layering programs. Decorates best with patches, woven labels, and embroidery.",
    bestFor: "Cold-weather drops, retail capsules, premium staff kits",
    visual: "jacket",
    defaultVendorId: "vendor-best-cover",
    vendorUnitCostUsd: 40,
    moq: 50,
    leadTimeDays: 60,
    isPublished: true,
    sortOrder: 3,
    variants: colorways("zip-sherpa", "Full-zip sherpa", "heavyweight sherpa fleece", ["jetBlack", "navy", "ink", "forest", "bone"]),
    decorations: coreDecorations.filter((item) =>
      ["embroidery", "rubber_applique"].includes(item.id)
    ),
    priceTiers: [
      { minQty: 50, maxQty: 74, perUnitUsd: 125 },
      { minQty: 75, maxQty: 149, perUnitUsd: 110 },
      { minQty: 150, maxQty: 299, perUnitUsd: 105 },
      { minQty: 300, maxQty: null, perUnitUsd: 100 }
    ]
  },
  {
    id: "prod-down-puffer",
    slug: "down-puffer",
    skuCode: "PUF101",
    category: "outerwear",
    displayName: "Goose Down Puffer",
    sizes: ["XS", "S", "M", "L", "XL", "XXL"],
    fitNotes: "Boxy cropped · hooded · real goose down fill · snap + zip placket",
    greyFront: "/products/down-puffer/base-front.png",
    greyBack: "/products/down-puffer/base-back.png",
    headline: "Hooded goose down puffer with a boxy, cropped cut.",
    description:
      "A premium hooded puffer with real goose down fill, a boxy cropped cut, snap-and-zip placket, and zip hand pockets. The catalog's cold-weather hero piece for outerwear-led drops. Decorates best with embroidery, woven patches, and woven labels.",
    bestFor: "Premium winter drops, outerwear-led brands, elevated staff kits",
    visual: "jacket",
    defaultVendorId: "vendor-best-cover",
    vendorUnitCostUsd: 100,
    moq: 50,
    leadTimeDays: 70,
    isPublished: true,
    sortOrder: 2,
    variants: colorways("down-puffer", "Hooded down puffer", "recycled nylon shell / goose down fill", ["jetBlack", "navy", "ink", "forest"]),
    decorations: coreDecorations.filter((item) =>
      ["embroidery", "rubber_applique"].includes(item.id)
    ),
    priceTiers: [
      { minQty: 50, maxQty: 74, perUnitUsd: 250 },
      { minQty: 75, maxQty: 149, perUnitUsd: 225 },
      { minQty: 150, maxQty: 299, perUnitUsd: 200 },
      { minQty: 300, maxQty: null, perUnitUsd: 175 }
    ]
  },
  {
    id: "prod-track-jacket",
    slug: "track-jacket",
    skuCode: "TKJ101",
    category: "outerwear",
    displayName: "Nylon Track Jacket",
    sizes: ["XS", "S", "M", "L", "XL", "XXL"],
    fitNotes: "Relaxed · full zip · stand collar · elastic hem + cuffs",
    greyFront: "/products/track-jacket/base-front.png",
    greyBack: "/products/track-jacket/base-back.png",
    headline: "Lightweight nylon track jacket with a full zip and stand collar.",
    description:
      "A lightweight recycled-nylon track jacket with a full zip, stand collar, and elastic hem and cuffs. Clean layering for athleisure drops and warm-up kits. Decorates best with embroidery, woven patches, and woven labels.",
    bestFor: "Athleisure drops, team kits, creator merch",
    visual: "jacket",
    defaultVendorId: "vendor-best-cover",
    vendorUnitCostUsd: 28,
    moq: 50,
    leadTimeDays: 50,
    isPublished: true,
    sortOrder: 4,
    variants: colorways("track-jacket", "Full-zip track jacket", "recycled nylon shell", ["jetBlack", "navy", "ink", "forest"]),
    decorations: coreDecorations.filter((item) =>
      ["embroidery", "rubber_applique"].includes(item.id)
    ),
    priceTiers: [
      { minQty: 50, maxQty: 74, perUnitUsd: 88 },
      { minQty: 75, maxQty: 149, perUnitUsd: 78 },
      { minQty: 150, maxQty: 299, perUnitUsd: 74 },
      { minQty: 300, maxQty: null, perUnitUsd: 70 }
    ]
  },
  {
    id: "prod-nylon-chore",
    slug: "nylon-chore-jacket",
    skuCode: "NCJ101",
    category: "outerwear",
    displayName: "Nylon Chore Jacket",
    sizes: ["XS", "S", "M", "L", "XL", "XXL"],
    fitNotes: "Boxy chore · nylon shell · snap placket · chest + hand pockets",
    greyFront: "/products/nylon-chore/base-front.png",
    greyBack: "/products/nylon-chore/base-back.png",
    headline: "Lightweight nylon chore jacket with a boxy cut.",
    description:
      "A lightweight nylon chore jacket with a boxy cut, snap placket, spread collar, and chest plus hand pockets. Workwear-inspired layering with a clean shell. Decorates best with embroidery, woven patches, and woven labels.",
    bestFor: "Workwear-inspired drops, team kits, creator merch",
    visual: "jacket",
    defaultVendorId: "vendor-best-cover",
    vendorUnitCostUsd: 32,
    moq: 50,
    leadTimeDays: 52,
    isPublished: true,
    sortOrder: 5,
    variants: colorways("nylon-chore-jacket", "Nylon chore jacket", "nylon shell", ["jetBlack", "navy", "ink", "forest"]),
    decorations: coreDecorations.filter((item) =>
      ["embroidery", "rubber_applique"].includes(item.id)
    ),
    priceTiers: [
      { minQty: 50, maxQty: 74, perUnitUsd: 100 },
      { minQty: 75, maxQty: 149, perUnitUsd: 89 },
      { minQty: 150, maxQty: 299, perUnitUsd: 84 },
      { minQty: 300, maxQty: null, perUnitUsd: 80 }
    ]
  },
  {
    id: "prod-standard-tote",
    slug: "standard-tote",
    skuCode: "TOT101",
    category: "bag",
    displayName: "Standard Tote",
    sizes: ["ONE"],
    fitNotes: "Single size · 38cm × 42cm × 12cm gusset",
    greyFront: "/products/standard-tote/base-front.png",
    greyBack: "/products/standard-tote/base-back.png",
    headline: "Premium custom tote with heavyweight canvas.",
    description:
      "A proven tote platform with stable panel proportions, reinforced seams, and a bounded decoration menu. Designed for cultural brands, hotels, cafes, conferences, and retail add-ons.",
    bestFor: "Cafes, hotels, galleries, event merch, agencies",
    visual: "tote",
    defaultVendorId: "vendor-best-cover",
    vendorUnitCostUsd: 12,
    moq: 50,
    leadTimeDays: 45,
    isPublished: true,
    sortOrder: 50,
    variants: colorways("standard-tote", "Standard carry tote", "14oz cotton canvas", ["natural", "walnut", "jetBlack"]),
    decorations: coreDecorations.filter((item) =>
      ["screen_print", "embroidery", "rubber_applique"].includes(item.id)
    ),
    priceTiers: [
      { minQty: 50, maxQty: 249, perUnitUsd: 38 },
      { minQty: 250, maxQty: 499, perUnitUsd: 33 },
      { minQty: 500, maxQty: 999, perUnitUsd: 32 },
      { minQty: 1000, maxQty: null, perUnitUsd: 30 }
    ]
  },
  {
    id: "prod-dad-hat",
    slug: "dad-hat",
    skuCode: "CAP101",
    category: "headwear",
    displayName: "Twill Dad Hat",
    sizes: ["ONE"],
    fitNotes: "6-panel unstructured · cotton twill · adjustable strap · single size",
    greyFront: "/products/dad-hat/base-front.png",
    headline: "Low-profile cotton twill cap with embroidery-first decoration.",
    description:
      "A reliable cap program with controlled decoration zones and straightforward fulfillment. Good for brands that need polished headwear without a bespoke development cycle.",
    bestFor: "Brand uniforms, cafe merch, creator drops",
    visual: "cap",
    defaultVendorId: "vendor-headwear-one",
    vendorUnitCostUsd: 11,
    moq: 50,
    leadTimeDays: 42,
    isPublished: true,
    sortOrder: 60,
    variants: colorways("dad-hat", "6-panel unstructured", "cotton twill", ["jetBlack", "bone", "navy", "forest", "oxblood"]),
    decorations: coreDecorations.filter((item) =>
      ["embroidery", "rubber_applique"].includes(item.id)
    ),
    priceTiers: [
      { minQty: 50, maxQty: 199, perUnitUsd: 34 },
      { minQty: 200, maxQty: 499, perUnitUsd: 31 },
      { minQty: 500, maxQty: 999, perUnitUsd: 29 },
      { minQty: 1000, maxQty: null, perUnitUsd: 28 }
    ]
  },
  {
    id: "prod-five-panel",
    slug: "five-panel",
    skuCode: "FPN101",
    category: "headwear",
    displayName: "Five Panel Cap",
    sizes: ["ONE"],
    fitNotes: "Unstructured · 5-panel · cotton twill · adjustable strap · single size",
    greyFront: "/products/five-panel/base-front.png",
    headline: "Unstructured cotton-twill five panel with a clean crown.",
    description:
      "An unstructured cotton-twill five-panel cap with a low crown and adjustable strap. A streetwear-leaning headwear option that takes embroidery and front-panel patches cleanly.",
    bestFor: "Streetwear drops, creator merch, events",
    visual: "cap",
    defaultVendorId: "vendor-headwear-one",
    vendorUnitCostUsd: 12,
    moq: 50,
    leadTimeDays: 42,
    isPublished: true,
    sortOrder: 62,
    variants: colorways("five-panel", "Unstructured 5-panel", "cotton twill", ["bone", "jetBlack", "navy", "forest"]),
    decorations: coreDecorations.filter((item) =>
      ["embroidery", "rubber_applique"].includes(item.id)
    ),
    priceTiers: [
      { minQty: 50, maxQty: 199, perUnitUsd: 38 },
      { minQty: 200, maxQty: 499, perUnitUsd: 33 },
      { minQty: 500, maxQty: 999, perUnitUsd: 32 },
      { minQty: 1000, maxQty: null, perUnitUsd: 30 }
    ]
  },
  {
    id: "prod-trucker-hat",
    slug: "trucker-hat",
    skuCode: "TRK101",
    category: "headwear",
    displayName: "Trucker Hat",
    sizes: ["ONE"],
    fitNotes: "Foam front · mesh back · snapback closure · single size",
    headline: "Foam or cotton-front trucker with mesh back.",
    description:
      "A structured headwear option for sports, hospitality, events, and streetwear-oriented merchandise programs.",
    bestFor: "Outdoor brands, sports activations, events",
    visual: "cap",
    defaultVendorId: "vendor-headwear-one",
    vendorUnitCostUsd: 11,
    moq: 50,
    leadTimeDays: 42,
    isPublished: true,
    sortOrder: 70,
    variants: [
      {
        id: "trucker-white-black",
        label: "Foam front trucker",
        fabric: "foam front / mesh back",
        colorLabel: "White / black",
        colorHex: "#f2efe9",
        mockupTemplateUrl: "/mockups/trucker-hat-white-black.pdf",
        isAvailable: true,
        frontImage: "/products/trucker-hat/trucker-white-black-front.png"
      }
    ],
    decorations: coreDecorations.filter((item) => ["embroidery", "rubber_applique"].includes(item.id)),
    priceTiers: [
      { minQty: 50, maxQty: 199, perUnitUsd: 34 },
      { minQty: 200, maxQty: 499, perUnitUsd: 31 },
      { minQty: 500, maxQty: 999, perUnitUsd: 29 },
      { minQty: 1000, maxQty: null, perUnitUsd: 28 }
    ]
  },
  {
    id: "prod-beanie",
    slug: "rib-knit-beanie",
    skuCode: "BNI101",
    category: "headwear",
    displayName: "Rib Knit Beanie",
    sizes: ["ONE"],
    fitNotes: "Acrylic rib knit · cuff · single size",
    greyFront: "/products/rib-knit-beanie/base-front.png",
    headline: "Classic cuff beanie with woven or embroidered branding.",
    description:
      "A simple winter accessory SKU with strong margins and easy repeatability. Designed as a reliable add-on product.",
    bestFor: "Seasonal drops, resort merch, staff gifts",
    visual: "beanie",
    defaultVendorId: "vendor-headwear-one",
    vendorUnitCostUsd: 10,
    moq: 50,
    leadTimeDays: 38,
    isPublished: true,
    sortOrder: 80,
    variants: colorways("rib-knit-beanie", "Cuff beanie", "acrylic rib knit", ["heatherGray", "ink", "jetBlack", "navy", "forest", "natural"]),
    decorations: coreDecorations.filter((item) => ["embroidery", "rubber_applique"].includes(item.id)),
    priceTiers: [
      { minQty: 50, maxQty: 249, perUnitUsd: 31 },
      { minQty: 250, maxQty: 499, perUnitUsd: 28 },
      { minQty: 500, maxQty: 999, perUnitUsd: 26 },
      { minQty: 1000, maxQty: null, perUnitUsd: 25 }
    ]
  }
];

// ---------------------------------------------------------------------------
// PR Box packaging assets
//
// Each asset is a hidden CatalogProduct (category "packaging", isPublished:false)
// so it reuses the entire product/cart/order/Stripe/fulfillment pipeline but
// never appears in the catalog grid — only inside the box builder.
//
// Costs confirmed by Devyn (Jun 5 2026): the FULL packaging set lands at ~$17/box
// at the 50-box tier, dropping to ~$12/box at 500+. The rigid box is the dominant
// cost. Sell = LDP ÷ 0.40 (the catalog's 60%-floor model), so the full set sells
// ~$42/box → ~$30/box. Per-asset LDP/sell below are allocated within that envelope.
// ---------------------------------------------------------------------------
// Standard packaging colorways — the box (and any colorable piece) can be made
// in any of these. Tuned for the neutrals + accents most brands/tech reach for.
// Recolored live by tinting the grey base (recolor: true).
const PACKAGING_COLORS: { id: string; label: string; hex: string }[] = [
  { id: "white", label: "White", hex: "#F5F3EE" },
  { id: "bone", label: "Bone", hex: "#E7E1D5" },
  { id: "kraft", label: "Kraft", hex: "#B5895C" },
  { id: "sand", label: "Sand", hex: "#CBB78F" },
  { id: "stone", label: "Stone", hex: "#A39E95" },
  { id: "slate", label: "Slate", hex: "#5C616A" },
  { id: "charcoal", label: "Charcoal", hex: "#38352F" },
  { id: "black", label: "Jet Black", hex: "#181818" },
  { id: "navy", label: "Navy", hex: "#1F2D4A" },
  { id: "forest", label: "Forest", hex: "#2A4233" },
  { id: "sage", label: "Sage", hex: "#9CA88B" },
  { id: "sky", label: "Dusty Blue", hex: "#91A6B8" },
  { id: "oxblood", label: "Oxblood", hex: "#67292E" },
  { id: "terracotta", label: "Terracotta", hex: "#B04731" },
  { id: "cream", label: "Cream", hex: "#EEEAE3" }
];

// Box print/finish styles (the "Finish" step). Multi-select — combos like
// foil + emboss are common. Upcharges are placeholders (over the base print).
const boxFinishes: CatalogDecoration[] = [
  { id: "screen_print", label: "Screen print", description: "Solid spot-color ink on the printed wrap.", perUnitAdderUsd: 0, placementZones: ["front"], maxColors: 2, isAvailable: true },
  { id: "full_color", label: "Full-color print", description: "Offset CMYK for multicolor or photographic artwork.", perUnitAdderUsd: 0.75, placementZones: ["front"], isAvailable: true },
  { id: "spot_uv", label: "Spot UV", description: "Glossy clear coat over a matte base — tone-on-tone shine.", perUnitAdderUsd: 1.25, placementZones: ["front"], maxColors: 1, isAvailable: true },
  { id: "foil_stamp", label: "Foil stamp", description: "Metallic or pigment foil pressed into the surface.", perUnitAdderUsd: 2.5, placementZones: ["front"], maxColors: 1, isAvailable: true },
  { id: "emboss", label: "Emboss / deboss", description: "Raised or recessed impression of your mark — tactile.", perUnitAdderUsd: 1.75, placementZones: ["front"], maxColors: 1, isAvailable: true }
];

function packagingAsset(opts: {
  slug: string;
  skuCode: string;
  assetKind: PackagingAssetKind;
  displayName: string;
  headline: string;
  description: string;
  vendorUnitCostUsd: number; // LDP (landed)
  tiers: PriceTier[]; // sell-price ladder (= LDP ÷ 0.40)
  sortOrder: number;
  required?: boolean;
  moq?: number;
  image?: string; // hero/thumb for the builder's packaging picker
  printUpchargeUsd?: number; // per-unit print fee (branded − blank); 0/undefined = no upcharge
  designRequired?: boolean; // must be branded (blank is pointless — cards, stickers)
  printable?: boolean; // false = always plain (e.g. crinkle fill); default true
  colorable?: boolean; // true → offers the full PACKAGING_COLORS palette (recolored live)
  finishes?: CatalogDecoration[]; // print/finish styles (the Finish step) — e.g. the box
}): CatalogProduct {
  return {
    id: `pkg-${opts.slug}`,
    slug: `pkg-${opts.slug}`,
    skuCode: opts.skuCode,
    category: "packaging",
    displayName: opts.displayName,
    headline: opts.headline,
    description: opts.description,
    bestFor: "PR Box packaging",
    visual: "tote",
    defaultVendorId: "vendor-best-cover",
    vendorUnitCostUsd: opts.vendorUnitCostUsd,
    moq: opts.moq ?? 50,
    leadTimeDays: 30,
    isPublished: false,
    sortOrder: opts.sortOrder,
    sizes: ["ONE"],
    assetKind: opts.assetKind,
    packagingRequired: opts.required ?? false,
    printUpchargeUsd: opts.printUpchargeUsd ?? 0,
    designRequired: opts.designRequired ?? false,
    printable: opts.printable ?? true,
    greyFront: opts.image,
    variants: opts.colorable
      ? PACKAGING_COLORS.map((c) => ({
          id: `pkg-${opts.slug}-${c.id}`,
          label: c.label,
          fabric: "—",
          colorLabel: c.label,
          colorHex: c.hex,
          mockupTemplateUrl: "",
          isAvailable: true,
          recolor: true // tint the grey box base live to the chosen color
        }))
      : [
          {
            id: `pkg-${opts.slug}-default`,
            label: opts.displayName,
            fabric: "—",
            colorLabel: "Branded",
            colorHex: "#D6D1C0",
            mockupTemplateUrl: "",
            isAvailable: true,
            frontImage: opts.image,
            recolor: false
          }
        ],
    decorations: opts.finishes ?? [],
    priceTiers: opts.tiers
  };
}

export const packagingAssets: CatalogProduct[] = [
  packagingAsset({
    slug: "rigid-box",
    skuCode: "PKG-BOX",
    assetKind: "box",
    displayName: "Rigid Magnetic Gift Box",
    headline: "Branded rigid magnetic-close presentation box.",
    description:
      "The PR Box itself — a rigid magnetic-close gift box with a custom-printed wrap. The required foundation of every box.",
    vendorUnitCostUsd: 9.0,
    required: true,
    colorable: true, // the box offers the full 15-color palette (recolored live)
    finishes: boxFinishes, // print/finish styles (screen, full-color, spot UV, foil, emboss)
    sortOrder: 900,
    printUpchargeUsd: 3.0,
    image: "/products/pkg-rigid-box/base-front.png",
    tiers: [
      { minQty: 50, maxQty: 249, perUnitUsd: 22.5 },
      { minQty: 250, maxQty: 499, perUnitUsd: 19.38 },
      { minQty: 500, maxQty: null, perUnitUsd: 16.25 }
    ]
  }),
  packagingAsset({
    slug: "tissue",
    skuCode: "PKG-TIS",
    assetKind: "tissue",
    displayName: "Branded Tissue Paper",
    headline: "Custom-printed tissue wrap.",
    description: "Printed tissue paper lining the box and wrapping the contents.",
    vendorUnitCostUsd: 0.8,
    sortOrder: 901,
    printUpchargeUsd: 0.8,
    tiers: [
      { minQty: 50, maxQty: 249, perUnitUsd: 2.0 },
      { minQty: 250, maxQty: 499, perUnitUsd: 1.7 },
      { minQty: 500, maxQty: null, perUnitUsd: 1.38 }
    ]
  }),
  packagingAsset({
    slug: "insert-card",
    skuCode: "PKG-CRD",
    assetKind: "card",
    displayName: "Insert / Thank-You Card",
    headline: "Printed insert or thank-you card.",
    description: "A printed card — welcome note, story, or call-to-action — tucked into the box.",
    vendorUnitCostUsd: 1.2,
    sortOrder: 902,
    printUpchargeUsd: 1.2,
    designRequired: true,
    tiers: [
      { minQty: 50, maxQty: 249, perUnitUsd: 3.0 },
      { minQty: 250, maxQty: 499, perUnitUsd: 2.5 },
      { minQty: 500, maxQty: null, perUnitUsd: 2.13 }
    ]
  }),
  packagingAsset({
    slug: "sticker-sheet",
    skuCode: "PKG-STK",
    assetKind: "sticker",
    displayName: "Sticker Sheet",
    headline: "Die-cut branded sticker sheet.",
    description: "A sheet of die-cut branded stickers included as a box extra.",
    vendorUnitCostUsd: 1.5,
    sortOrder: 903,
    printUpchargeUsd: 1.5,
    designRequired: true,
    tiers: [
      { minQty: 50, maxQty: 249, perUnitUsd: 3.75 },
      { minQty: 250, maxQty: 499, perUnitUsd: 3.13 },
      { minQty: 500, maxQty: null, perUnitUsd: 2.63 }
    ]
  }),
  packagingAsset({
    slug: "void-fill",
    skuCode: "PKG-FIL",
    assetKind: "fill",
    displayName: "Crinkle Void Fill",
    headline: "Crinkle paper void fill.",
    description: "Crinkle-cut paper fill that cushions and presents the contents.",
    vendorUnitCostUsd: 1.0,
    sortOrder: 904,
    printable: false,
    tiers: [
      { minQty: 50, maxQty: 249, perUnitUsd: 2.5 },
      { minQty: 250, maxQty: 499, perUnitUsd: 2.13 },
      { minQty: 500, maxQty: null, perUnitUsd: 1.75 }
    ]
  }),
  packagingAsset({
    slug: "branded-tape",
    skuCode: "PKG-TAP",
    assetKind: "tape",
    displayName: "Branded Tape",
    headline: "Custom-printed packing tape.",
    description: "Custom-printed tape that seals the outer mailer.",
    vendorUnitCostUsd: 1.5,
    sortOrder: 905,
    printUpchargeUsd: 0.8,
    tiers: [
      { minQty: 50, maxQty: 249, perUnitUsd: 3.75 },
      { minQty: 250, maxQty: 499, perUnitUsd: 3.13 },
      { minQty: 500, maxQty: null, perUnitUsd: 2.63 }
    ]
  }),
  packagingAsset({
    slug: "belly-band",
    skuCode: "PKG-RIB",
    assetKind: "ribbon",
    displayName: "Ribbon / Belly Band",
    headline: "Branded ribbon or belly band.",
    description: "A ribbon or printed belly band that finishes the unboxing.",
    vendorUnitCostUsd: 2.0,
    sortOrder: 906,
    printUpchargeUsd: 1.2,
    tiers: [
      { minQty: 50, maxQty: 249, perUnitUsd: 5.0 },
      { minQty: 250, maxQty: 499, perUnitUsd: 4.13 },
      { minQty: 500, maxQty: null, perUnitUsd: 3.25 }
    ]
  })
];

// ---------------------------------------------------------------------------
// The PR Box — a published catalog PRODUCT whose PDP is the box builder.
// Shows as a card in the catalog grid; `isBundleBuilder` tells routing to render
// the builder instead of the standard configurator. It is NOT itself bundle-
// eligible (no box-inside-a-box) and carries no real price tier — the card shows
// a computed "starting at" price (see bundleStartingPriceUsd in pricing.ts).
// ---------------------------------------------------------------------------
export const PR_BOX_PRODUCT_ID = "prod-pr-box";

const bundleBuilderProduct: CatalogProduct = {
  id: PR_BOX_PRODUCT_ID,
  slug: "pr-box",
  skuCode: "PRBOX",
  category: "bundle",
  displayName: "PR Box",
  sizes: ["ONE"],
  greyFront: "/products/pr-box/base-front.png",
  headline: "Build a branded PR box — items + packaging, one price.",
  description:
    "A buyer-built promotional box: choose catalog items, decorate each, and add branded packaging. Configure contents and quantity — pricing is itemized into one per-box price. Bundle 3+ items with packaging and save 10%.",
  bestFor: "Influencer seeding, press kits, launch gifting, VIP mailers",
  visual: "tote",
  defaultVendorId: "vendor-best-cover",
  vendorUnitCostUsd: 0,
  moq: 50,
  leadTimeDays: 56,
  isPublished: true,
  sortOrder: 0, // featured first in the grid
  isBundleBuilder: true,
  variants: [
    {
      id: "pr-box-default",
      label: "PR Box",
      fabric: "—",
      colorLabel: "Custom",
      colorHex: "#B04731",
      mockupTemplateUrl: "",
      isAvailable: true,
      recolor: false
    }
  ],
  decorations: [],
  priceTiers: [{ minQty: 1, maxQty: null, perUnitUsd: 0 }] // nominal; real price is built in the builder
};

// The catalog seed: the PR Box product + apparel SKUs + hidden packaging assets.
// Packaging is filtered out of the storefront grid by `isPublished:false`; the
// box builder pulls it explicitly via its category.
export const seedProducts: CatalogProduct[] = [
  bundleBuilderProduct,
  ...apparelProducts,
  ...packagingAssets
];

// Eligibility helper for the box builder: published real SKUs only.
// Excludes the PR Box itself (no box-in-a-box) and packaging assets.
export function isBundleEligible(product: CatalogProduct): boolean {
  if (product.isBundleBuilder) return false;
  if (product.category === "packaging" || product.category === "bundle") return false;
  if (product.bundleEligible !== undefined) return product.bundleEligible;
  return product.isPublished;
}
