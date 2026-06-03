export type ProductCategory =
  | "hoodie"
  | "tee"
  | "knitwear"
  | "bottoms"
  | "outerwear"
  | "headwear"
  | "bag"
  | "accessory";

export type DecorationMethod =
  | "screen_print"
  | "embroidery"
  | "puff_print"
  | "patch"
  | "dtg"
  | "sublimation"
  | "woven_label";

export type OrderStatus =
  | "awaiting_payment"
  | "paid"
  | "artwork_qa"
  | "awaiting_revision"
  | "approved"
  | "vendor_notified"
  | "in_production"
  | "shipped"
  | "delivered"
  | "cancelled";

export type Vendor = {
  id: string;
  name: string;
  country: string;
  contactName: string;
  contactEmail: string;
  contactWechat: string;
  notes: string;
  isActive: boolean;
};

export type CatalogVariant = {
  id: string;
  label: string;
  fabric: string;
  colorLabel: string;
  colorHex: string;
  colorTcx?: string; // Pantone TCX fabric color code (textile spec)
  mockupTemplateUrl: string;
  isAvailable: boolean;
  frontImage?: string;
  backImage?: string;
  recolor?: boolean; // false = show the grey base as-is (natural/heather)
};

export type CatalogDecoration = {
  id: DecorationMethod;
  label: string;
  description: string;
  perUnitAdderUsd: number;
  placementZones: string[];
  maxColors?: number;
  isAvailable: boolean;
};

export type PriceTier = {
  minQty: number;
  maxQty: number | null;
  perUnitUsd: number;
};

export type CatalogProduct = {
  id: string;
  slug: string;
  skuCode: string;
  category: ProductCategory;
  displayName: string;
  headline: string;
  description: string;
  bestFor: string;
  visual: "hoodie" | "tee" | "pant" | "jacket" | "cap" | "tote" | "beanie";
  defaultVendorId: string;
  vendorUnitCostUsd: number;
  moq: number;
  leadTimeDays: number;
  isPublished: boolean;
  sortOrder: number;
  sizes: string[];
  fitNotes?: string;
  greyFront?: string;
  greyBack?: string;
  // Optional mask (PNG, white = recolor region) confining the live tint to part of
  // the garment — e.g. a trucker hat whose foam front panel must stay white.
  recolorMaskFront?: string;
  recolorMaskBack?: string;
  variants: CatalogVariant[];
  decorations: CatalogDecoration[];
  priceTiers: PriceTier[];
};

// The customer's actual artwork placement — structured (not a string) so it can
// thread to the tech pack, drive a proof, and be reconstructed. Coordinates are
// fractional 0..1 on the 4:5 canvas; inches are populated once a zone publishes
// real-world dimensions.
export type ArtworkPlacement = {
  view: "front" | "back";
  zoneId: string;
  zoneLabel: string;
  box: { x: number; y: number; w: number; h: number; r?: number };
  art: { ox: number; oy: number; sx: number; sy: number; r?: number };
  method?: string; // decoration method label(s)
  colors?: number; // ink-color count = pantones.length (≤ maxColors)
  pantones?: { code: string; name: string; hex: string }[]; // chosen spot inks
  maxColors?: number; // the chosen decoration's max allowed colors (the cap)
  widthIn?: number; // placed art size in inches (when the zone has inch dims)
  heightIn?: number;
};

export type ShopOrder = {
  id: string;
  orderNumber: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  companyName: string;
  productId: string;
  variantId: string;
  decorationIds: DecorationMethod[];
  quantity: number;
  perUnitUsd: number;
  decorationAdderUsd: number;
  subtotalUsd: number;
  taxUsd: number;
  totalUsd: number;
  artworkFileName: string;
  artworkFileUrl?: string;
  artworkNotes: string;
  artworkPlacement?: ArtworkPlacement;
  sizeBreakdown?: Record<string, number>; // size run (e.g. { S: 10, M: 20 })
  proofUrl?: string; // auto-generated proof image (garment + placed art)
  proofApprovedAt?: string; // customer sign-off — the QA. Gates the vendor send.
  // Proof-approval follow-through (orders that are paid but not yet approved).
  approvalRemindersSent?: number; // auto-nudges sent so far
  lastApprovalReminderAt?: string;
  changesRequestedAt?: string; // customer asked for revisions instead of approving
  changesRequestedNote?: string;
  cancelledAt?: string;
  refundedAt?: string;
  refundId?: string;
  paymentStatus: "simulated_paid" | "paid" | "unpaid" | "refunded";
  status: OrderStatus;
  stripeSessionId?: string;
  shipToName: string;
  shipToAddress: {
    line1: string;
    line2: string;
    city: string;
    state: string;
    postalCode: string;
    country: string;
  };
  trackingCarrier?: string;
  trackingNumber?: string;
  internalNotes: string;
  // Mirror of the order's life in MoaOS's catalog pipeline (pushed on paid).
  // The storefront never authors a PO — it only reflects MoaOS state here.
  fulfillment?: {
    mode: string; // CATALOG_FULFILLMENT_MODE at push time
    pushedAt?: string;
    catalogOrderId?: string;
    poIds?: string[];
    poNumber?: string;
    catalogStatus?: string; // mirrored from MoaOS
    lastSyncedAt?: string;
    dryRunPayload?: unknown; // dry_run mode: what we WOULD have pushed
    lastError?: string;
    trackingCarrier?: string; // mirrored when shipped
    trackingNumber?: string;
    shippedNotifiedAt?: string; // when the customer shipping email went out (idempotency)
  };
  statusLog: Array<{
    statusFrom: OrderStatus | null;
    statusTo: OrderStatus;
    note: string;
    createdAt: string;
  }>;
  createdAt: string;
  updatedAt: string;
};

export type OrderInput = {
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  companyName: string;
  productId: string;
  variantId: string;
  decorationIds: DecorationMethod[];
  quantity: number;
  artworkFileName: string;
  artworkFileUrl?: string;
  artworkNotes: string;
  artworkPlacement?: ArtworkPlacement;
  sizeBreakdown?: Record<string, number>;
  shipToName: string;
  shipToAddress: ShopOrder["shipToAddress"];
};

export type ProductUpdateInput = Partial<
  Pick<
    CatalogProduct,
    | "displayName"
    | "headline"
    | "description"
    | "bestFor"
    | "moq"
    | "leadTimeDays"
    | "vendorUnitCostUsd"
    | "isPublished"
  >
>;
