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
