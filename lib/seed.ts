import type { CatalogDecoration, CatalogProduct, CatalogVariant, Vendor } from "./types";

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
    id: "patch",
    label: "Woven patch",
    description: "Woven or embroidered patch stitched onto garment or accessory.",
    perUnitAdderUsd: 8.25,
    placementZones: ["front", "sleeve", "hat front", "bag panel"],
    isAvailable: true
  },
  {
    id: "puff_print",
    label: "Puff print",
    description: "Raised print for bold graphics with dimensional hand feel.",
    perUnitAdderUsd: 5.5,
    placementZones: ["front", "back", "sleeve"],
    maxColors: 3,
    isAvailable: true
  },
  {
    id: "woven_label",
    label: "Woven label",
    description: "Custom neck, side seam, hem, or interior label treatment.",
    perUnitAdderUsd: 2.25,
    placementZones: ["neck", "hem", "side seam", "interior"],
    isAvailable: true
  }
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

// Shared colorway palette. The grey base is only a recolor source — it is never a
// sellable color, so every chip is a real color and Black is the default.
const COLORWAYS: { id: string; label: string; hex: string }[] = [
  { id: "black", label: "Black", hex: "#1a1a1a" },
  { id: "charcoal", label: "Charcoal", hex: "#3a3a3c" },
  { id: "navy", label: "Navy", hex: "#1f2b42" },
  { id: "olive", label: "Olive", hex: "#4d4b30" },
  { id: "burgundy", label: "Burgundy", hex: "#5c2128" },
  { id: "forest", label: "Forest", hex: "#284130" }
];

function colorways(slug: string, label: string, fabric: string): CatalogVariant[] {
  return COLORWAYS.map((c) => ({
    id: `${slug}-${c.id}`,
    label,
    fabric,
    colorLabel: c.label,
    colorHex: c.hex,
    mockupTemplateUrl: `/mockups/${slug}-${c.id}.pdf`,
    isAvailable: true
  }));
}

export const seedProducts: CatalogProduct[] = [
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
    vendorUnitCostUsd: 22,
    moq: 50,
    leadTimeDays: 52,
    isPublished: true,
    sortOrder: 8,
    variants: colorways("knit-sweater", "Crewneck sweater", "100% cotton knit"),
    decorations: coreDecorations.filter((item) =>
      ["embroidery", "patch", "woven_label"].includes(item.id)
    ),
    priceTiers: [
      { minQty: 50, maxQty: 99, perUnitUsd: 82 },
      { minQty: 100, maxQty: 249, perUnitUsd: 72 },
      { minQty: 250, maxQty: 499, perUnitUsd: 62 },
      { minQty: 500, maxQty: null, perUnitUsd: 54 }
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
    vendorUnitCostUsd: 24,
    moq: 50,
    leadTimeDays: 56,
    isPublished: true,
    sortOrder: 10,
    variants: colorways("heavyweight-hoodie", "Oversized pullover", "420gsm cotton/poly fleece"),
    decorations: coreDecorations.filter((item) =>
      ["screen_print", "embroidery", "patch", "puff_print", "woven_label"].includes(item.id)
    ),
    priceTiers: [
      { minQty: 50, maxQty: 99, perUnitUsd: 88 },
      { minQty: 100, maxQty: 249, perUnitUsd: 78 },
      { minQty: 250, maxQty: 499, perUnitUsd: 68 },
      { minQty: 500, maxQty: null, perUnitUsd: 59 }
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
    vendorUnitCostUsd: 8.5,
    moq: 50,
    leadTimeDays: 42,
    isPublished: true,
    sortOrder: 20,
    variants: colorways("heavyweight-tee", "Boxy tee", "260gsm compact cotton jersey"),
    decorations: coreDecorations.filter((item) =>
      ["screen_print", "embroidery", "puff_print", "woven_label"].includes(item.id)
    ),
    priceTiers: [
      { minQty: 50, maxQty: 149, perUnitUsd: 39 },
      { minQty: 150, maxQty: 299, perUnitUsd: 34 },
      { minQty: 300, maxQty: 599, perUnitUsd: 29 },
      { minQty: 600, maxQty: null, perUnitUsd: 24 }
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
    vendorUnitCostUsd: 20,
    moq: 50,
    leadTimeDays: 50,
    isPublished: true,
    sortOrder: 30,
    variants: colorways("wide-leg-sweatpant", "Wide-leg sweatpant", "380gsm brushed fleece"),
    decorations: coreDecorations.filter((item) =>
      ["screen_print", "embroidery", "patch", "woven_label"].includes(item.id)
    ),
    priceTiers: [
      { minQty: 50, maxQty: 99, perUnitUsd: 72 },
      { minQty: 100, maxQty: 199, perUnitUsd: 64 },
      { minQty: 200, maxQty: 399, perUnitUsd: 56 },
      { minQty: 400, maxQty: null, perUnitUsd: 48 }
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
    variants: colorways("work-jacket", "Chore jacket", "12oz cotton canvas"),
    decorations: coreDecorations.filter((item) =>
      ["embroidery", "patch", "woven_label"].includes(item.id)
    ),
    priceTiers: [
      { minQty: 50, maxQty: 74, perUnitUsd: 156 },
      { minQty: 75, maxQty: 149, perUnitUsd: 138 },
      { minQty: 150, maxQty: 299, perUnitUsd: 126 },
      { minQty: 300, maxQty: null, perUnitUsd: 112 }
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
    vendorUnitCostUsd: 34,
    moq: 50,
    leadTimeDays: 60,
    isPublished: true,
    sortOrder: 3,
    variants: colorways("zip-sherpa", "Full-zip sherpa", "heavyweight sherpa fleece"),
    decorations: coreDecorations.filter((item) =>
      ["patch", "woven_label", "embroidery"].includes(item.id)
    ),
    priceTiers: [
      { minQty: 50, maxQty: 74, perUnitUsd: 120 },
      { minQty: 75, maxQty: 149, perUnitUsd: 106 },
      { minQty: 150, maxQty: 299, perUnitUsd: 94 },
      { minQty: 300, maxQty: null, perUnitUsd: 84 }
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
    vendorUnitCostUsd: 58,
    moq: 50,
    leadTimeDays: 70,
    isPublished: true,
    sortOrder: 2,
    variants: colorways("down-puffer", "Hooded down puffer", "recycled nylon shell / goose down fill"),
    decorations: coreDecorations.filter((item) =>
      ["embroidery", "patch", "woven_label"].includes(item.id)
    ),
    priceTiers: [
      { minQty: 50, maxQty: 74, perUnitUsd: 190 },
      { minQty: 75, maxQty: 149, perUnitUsd: 168 },
      { minQty: 150, maxQty: 299, perUnitUsd: 150 },
      { minQty: 300, maxQty: null, perUnitUsd: 134 }
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
    vendorUnitCostUsd: 22,
    moq: 50,
    leadTimeDays: 50,
    isPublished: true,
    sortOrder: 4,
    variants: colorways("track-jacket", "Full-zip track jacket", "recycled nylon shell"),
    decorations: coreDecorations.filter((item) =>
      ["embroidery", "patch", "woven_label"].includes(item.id)
    ),
    priceTiers: [
      { minQty: 50, maxQty: 74, perUnitUsd: 76 },
      { minQty: 75, maxQty: 149, perUnitUsd: 68 },
      { minQty: 150, maxQty: 299, perUnitUsd: 60 },
      { minQty: 300, maxQty: null, perUnitUsd: 52 }
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
    vendorUnitCostUsd: 28,
    moq: 50,
    leadTimeDays: 52,
    isPublished: true,
    sortOrder: 5,
    variants: colorways("nylon-chore-jacket", "Nylon chore jacket", "nylon shell"),
    decorations: coreDecorations.filter((item) =>
      ["embroidery", "patch", "woven_label"].includes(item.id)
    ),
    priceTiers: [
      { minQty: 50, maxQty: 74, perUnitUsd: 94 },
      { minQty: 75, maxQty: 149, perUnitUsd: 84 },
      { minQty: 150, maxQty: 299, perUnitUsd: 74 },
      { minQty: 300, maxQty: null, perUnitUsd: 66 }
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
    vendorUnitCostUsd: 6.5,
    moq: 50,
    leadTimeDays: 45,
    isPublished: true,
    sortOrder: 50,
    variants: colorways("standard-tote", "Standard carry tote", "14oz cotton canvas"),
    decorations: coreDecorations.filter((item) =>
      ["screen_print", "embroidery", "patch", "woven_label"].includes(item.id)
    ),
    priceTiers: [
      { minQty: 50, maxQty: 249, perUnitUsd: 32 },
      { minQty: 250, maxQty: 499, perUnitUsd: 28 },
      { minQty: 500, maxQty: 999, perUnitUsd: 22 },
      { minQty: 1000, maxQty: null, perUnitUsd: 18 }
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
    vendorUnitCostUsd: 5.75,
    moq: 50,
    leadTimeDays: 42,
    isPublished: true,
    sortOrder: 60,
    variants: colorways("dad-hat", "6-panel unstructured", "cotton twill"),
    decorations: coreDecorations.filter((item) =>
      ["embroidery", "patch", "woven_label"].includes(item.id)
    ),
    priceTiers: [
      { minQty: 50, maxQty: 199, perUnitUsd: 27 },
      { minQty: 200, maxQty: 499, perUnitUsd: 24 },
      { minQty: 500, maxQty: 999, perUnitUsd: 19 },
      { minQty: 1000, maxQty: null, perUnitUsd: 16 }
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
    vendorUnitCostUsd: 6,
    moq: 50,
    leadTimeDays: 42,
    isPublished: true,
    sortOrder: 62,
    variants: colorways("five-panel", "Unstructured 5-panel", "cotton twill"),
    decorations: coreDecorations.filter((item) =>
      ["embroidery", "patch", "woven_label"].includes(item.id)
    ),
    priceTiers: [
      { minQty: 50, maxQty: 199, perUnitUsd: 28 },
      { minQty: 200, maxQty: 499, perUnitUsd: 25 },
      { minQty: 500, maxQty: 999, perUnitUsd: 20 },
      { minQty: 1000, maxQty: null, perUnitUsd: 17 }
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
    vendorUnitCostUsd: 6,
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
    decorations: coreDecorations.filter((item) => ["embroidery", "patch"].includes(item.id)),
    priceTiers: [
      { minQty: 50, maxQty: 199, perUnitUsd: 29 },
      { minQty: 200, maxQty: 499, perUnitUsd: 26 },
      { minQty: 500, maxQty: 999, perUnitUsd: 21 },
      { minQty: 1000, maxQty: null, perUnitUsd: 18 }
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
    vendorUnitCostUsd: 4.5,
    moq: 50,
    leadTimeDays: 38,
    isPublished: true,
    sortOrder: 80,
    variants: colorways("rib-knit-beanie", "Cuff beanie", "acrylic rib knit"),
    decorations: coreDecorations.filter((item) => ["patch", "woven_label", "embroidery"].includes(item.id)),
    priceTiers: [
      { minQty: 50, maxQty: 249, perUnitUsd: 22 },
      { minQty: 250, maxQty: 499, perUnitUsd: 19 },
      { minQty: 500, maxQty: 999, perUnitUsd: 15 },
      { minQty: 1000, maxQty: null, perUnitUsd: 12 }
    ]
  }
];
