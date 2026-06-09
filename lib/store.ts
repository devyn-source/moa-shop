import { promises as fs } from "fs";
import path from "path";
import { calculateOrderPrice, round2 } from "./pricing";
import { getSupabase, orderLookupColumn } from "./supabase";
import { seedProducts, seedVendors } from "./seed";
import type {
  CatalogProduct,
  OrderInput,
  OrderStatus,
  ProductUpdateInput,
  ShopOrder,
  Vendor
} from "./types";

// Vendors are still seed-backed reference data (read-only). Products + orders
// are in Supabase.
const vendorsPath = path.join(process.cwd(), ".data", "vendors.json");

async function readJson<T>(filePath: string, fallback: T): Promise<T> {
  try {
    const file = await fs.readFile(filePath, "utf8");
    return JSON.parse(file) as T;
  } catch {
    return fallback;
  }
}

// Products live in Supabase (table `products`, full product as `data` jsonb).
// Lazy-seeds from the canonical seed on first read; hard-falls-back to the seed
// on any error so the catalog can never go blank.
function productRow(p: CatalogProduct, i = 0) {
  return { id: p.id, slug: p.slug, data: p, is_published: p.isPublished ?? true, sort_order: p.sortOrder ?? i };
}

export async function getProducts({ includeDrafts = false } = {}): Promise<CatalogProduct[]> {
  let products: CatalogProduct[];
  try {
    const supabase = getSupabase();
    const { data, error } = await supabase.from("products").select("data").order("sort_order", { ascending: true });
    if (error) throw error;
    products = (data ?? []).map((r) => r.data as CatalogProduct);
    if (!products.length) {
      products = seedProducts;
      await supabase.from("products").upsert(seedProducts.map(productRow), { onConflict: "id" });
    }
  } catch {
    products = seedProducts; // never break the catalog
  }
  return products
    .filter((product) => includeDrafts || product.isPublished)
    .sort((a, b) => a.sortOrder - b.sortOrder);
}

export async function getProductBySlug(slug: string): Promise<CatalogProduct | null> {
  const products = await getProducts({ includeDrafts: true });
  return products.find((product) => product.slug === slug) ?? null;
}

export async function getProductById(id: string): Promise<CatalogProduct | null> {
  const products = await getProducts({ includeDrafts: true });
  return products.find((product) => product.id === id) ?? null;
}

export async function updateProduct(id: string, input: ProductUpdateInput): Promise<CatalogProduct> {
  const existing = await getProductById(id);
  if (!existing) throw new Error("Product not found");
  const updated = { ...existing, ...input };
  const { error } = await getSupabase()
    .from("products")
    .upsert({ ...productRow(updated), updated_at: new Date().toISOString() }, { onConflict: "id" });
  if (error) throw new Error(`Failed to update product: ${error.message}`);
  return updated;
}

export async function createProduct(input: ProductUpdateInput & { displayName: string }): Promise<CatalogProduct> {
  const products = await getProducts({ includeDrafts: true });
  const slug = input.displayName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
  const nowOrder = Math.max(...products.map((product) => product.sortOrder), 0) + 10;
  const template = seedProducts[0];
  const product: CatalogProduct = {
    ...template,
    id: `prod-${slug}-${Date.now()}`,
    slug,
    skuCode: `NEW${String(nowOrder).padStart(3, "0")}`,
    displayName: input.displayName,
    headline: input.headline ?? "New standardized MOA catalog product.",
    description: input.description ?? "Draft catalog product ready for SKU, variant, and pricing refinement.",
    bestFor: input.bestFor ?? "Standard merch programs",
    moq: input.moq ?? 100,
    leadTimeDays: input.leadTimeDays ?? 56,
    vendorUnitCostUsd: input.vendorUnitCostUsd ?? 20,
    isPublished: input.isPublished ?? false,
    sortOrder: nowOrder
  };

  const { error } = await getSupabase().from("products").insert(productRow(product));
  if (error) throw new Error(`Failed to create product: ${error.message}`);
  return product;
}

export async function getVendors(): Promise<Vendor[]> {
  return readJson<Vendor[]>(vendorsPath, seedVendors);
}

export async function getOrders(): Promise<ShopOrder[]> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("orders")
    .select("data")
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(`Failed to load orders: ${error.message}`);
  }

  return (data ?? []).map((row) => row.data as ShopOrder);
}

// Orders a signed-in customer owns: matched on the email captured at checkout
// (stored inside the jsonb `data` blob). Case-insensitive on the local part is
// overkill here — emails are normalised lowercase by Supabase Auth + checkout.
export async function getOrdersByEmail(email: string): Promise<ShopOrder[]> {
  if (!email) return [];
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("orders")
    .select("data")
    .eq("data->>contactEmail", email)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(`Failed to load orders for ${email}: ${error.message}`);
  }
  return (data ?? []).map((row) => row.data as ShopOrder);
}

export async function getOrderById(id: string): Promise<ShopOrder | null> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("orders")
    .select("data")
    .eq(orderLookupColumn(id), id)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load order: ${error.message}`);
  }

  return data ? (data.data as ShopOrder) : null;
}

// All ShopOrders belonging to one PR Box (they share a bundleId). Ordered oldest-
// first so components/packaging render in their original add order.
export async function getOrdersByBundle(bundleId: string): Promise<ShopOrder[]> {
  if (!bundleId) return [];
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("orders")
    .select("data")
    .eq("data->>bundleId", bundleId)
    .order("created_at", { ascending: true });

  if (error) {
    throw new Error(`Failed to load box ${bundleId}: ${error.message}`);
  }
  return (data ?? []).map((row) => row.data as ShopOrder);
}

export async function createOrder(input: OrderInput, opts: { paid?: boolean } = {}): Promise<ShopOrder> {
  const paid = opts.paid ?? false;
  const product = await getProductById(input.productId);
  if (!product) {
    throw new Error("Product not found");
  }

  const variant = product.variants.find((item) => item.id === input.variantId);
  if (!variant) {
    throw new Error("Variant not found");
  }

  const decorationIds = (input.decorationIds ?? []).filter((id) =>
    product.decorations.some((item) => item.id === id)
  );
  // Bundle lines (packaging, or an undecorated box component) legitimately have
  // no decoration; only standalone single-SKU orders require a method.
  if (decorationIds.length === 0 && !input.bundleId) {
    throw new Error("No valid decoration method selected");
  }

  // Server-side pricing of upsells: placement count comes from the structured
  // placement set (trustworthy); woven from the chosen flag. The client never
  // dictates the total — pricing.ts does.
  const price = calculateOrderPrice(product, input.quantity, decorationIds, {
    placementCount: input.artworkPlacements?.length,
    wovenLabel: input.wovenLabel,
    fabricOptionId: input.fabricOptionId,
  });
  // PR Box: this line's net = its gross minus its server-validated share of the
  // box discount. The discount is computed server-side in the checkout route
  // (re-validating the promo), never trusted from the client.
  // Blank packaging: subtract the per-unit print upcharge (the line was priced
  // branded by calculateOrderPrice, but the customer chose blank/no print).
  const blankAdj = input.blankPackaging ? round2((product.printUpchargeUsd ?? 0) * price.quantity) : 0;
  const bundleDiscountUsd = input.bundleId
    ? Math.max(0, Math.min(round2(price.totalUsd - blankAdj), input.bundleDiscountUsd ?? 0))
    : 0;
  const netTotalUsd = round2(price.totalUsd - blankAdj - bundleDiscountUsd);
  const now = new Date().toISOString();
  const supabase = getSupabase();
  const { count } = await supabase.from("orders").select("*", { count: "exact", head: true });
  const sequence = (count ?? 0) + 1;
  const orderNumber = `MOA-S-${new Date().getFullYear().toString().slice(-2)}${String(
    new Date().getMonth() + 1
  ).padStart(2, "0")}-${String(sequence).padStart(4, "0")}`;

  const order: ShopOrder = {
    id: crypto.randomUUID(),
    orderNumber,
    contactName: input.contactName,
    contactEmail: input.contactEmail,
    contactPhone: input.contactPhone,
    companyName: input.companyName,
    productId: product.id,
    variantId: variant.id,
    decorationIds,
    quantity: price.quantity,
    perUnitUsd: price.perUnitUsd,
    decorationAdderUsd: price.decorationAdderUsd,
    subtotalUsd: price.subtotalUsd,
    taxUsd: price.taxUsd,
    totalUsd: netTotalUsd,
    // PR Box grouping — present only on bundle lines; MoaOS groups by bundleId.
    bundleId: input.bundleId,
    bundleLabel: input.bundleLabel,
    bundleRole: input.bundleRole,
    perBoxQty: input.perBoxQty,
    promoId: input.promoId,
    bundleDiscountUsd: input.bundleId ? bundleDiscountUsd : undefined,
    artworkFileName: input.artworkFileName,
    artworkFileUrl: input.artworkFileUrl,
    artworkNotes: input.artworkNotes,
    artworkPlacement: input.artworkPlacement,
    artworkPlacements: input.artworkPlacements,
    wovenLabel: input.wovenLabel,
    fabricOptionId: input.fabricOptionId,
    fabricLabel: input.fabricLabel ?? product.fabricOptions?.find((o) => o.id === input.fabricOptionId)?.label,
    sizeBreakdown: input.sizeBreakdown,
    paymentStatus: paid ? "paid" : "unpaid",
    status: paid ? "artwork_qa" : "awaiting_payment",
    shipToName: input.shipToName,
    shipToAddress: input.shipToAddress,
    internalNotes: "",
    statusLog: paid
      ? [
          { statusFrom: null, statusTo: "paid", note: "Payment received.", createdAt: now },
          { statusFrom: "paid", statusTo: "artwork_qa", note: "Order routed to artwork QA.", createdAt: now }
        ]
      : [{ statusFrom: null, statusTo: "awaiting_payment", note: "Order created, awaiting payment.", createdAt: now }],
    createdAt: now,
    updatedAt: now
  };

  const { error } = await supabase.from("orders").insert({
    id: order.id,
    order_number: order.orderNumber,
    status: order.status,
    data: order,
    created_at: order.createdAt,
    updated_at: order.updatedAt
  });

  if (error) {
    throw new Error(`Failed to create order: ${error.message}`);
  }

  return order;
}

export async function updateOrderStatus(
  id: string,
  status: OrderStatus,
  note: string,
  extras?: Partial<Pick<ShopOrder, "trackingCarrier" | "trackingNumber" | "internalNotes">>
): Promise<ShopOrder> {
  const current = await getOrderById(id);
  if (!current) {
    throw new Error("Order not found");
  }

  const now = new Date().toISOString();
  const updated: ShopOrder = {
    ...current,
    ...extras,
    status,
    updatedAt: now,
    statusLog: [
      ...current.statusLog,
      {
        statusFrom: current.status,
        statusTo: status,
        note,
        createdAt: now
      }
    ]
  };

  const supabase = getSupabase();
  const { error } = await supabase
    .from("orders")
    .update({ status, data: updated, updated_at: now })
    .eq(orderLookupColumn(id), id);

  if (error) {
    throw new Error(`Failed to update order: ${error.message}`);
  }

  return updated;
}

export async function markOrderPaid(id: string, stripeSessionId: string): Promise<void> {
  const current = await getOrderById(id);
  if (!current) return;
  if (current.paymentStatus === "paid") return; // idempotent — webhook may fire twice

  const now = new Date().toISOString();
  const updated: ShopOrder = {
    ...current,
    paymentStatus: "paid",
    status: "artwork_qa",
    stripeSessionId,
    updatedAt: now,
    statusLog: [
      ...current.statusLog,
      { statusFrom: current.status, statusTo: "paid", note: "Payment received via Stripe.", createdAt: now },
      { statusFrom: "paid", statusTo: "artwork_qa", note: "Order routed to artwork QA.", createdAt: now }
    ]
  };

  const supabase = getSupabase();
  const { error } = await supabase
    .from("orders")
    .update({ status: "artwork_qa", data: updated, updated_at: now })
    .eq("id", id);
  if (error) {
    throw new Error(`Failed to mark order paid: ${error.message}`);
  }
}

// Merge a patch into the order's fulfillment mirror (MoaOS pipeline state).
export async function setOrderFulfillment(
  id: string,
  patch: Partial<NonNullable<ShopOrder["fulfillment"]>>
): Promise<void> {
  const current = await getOrderById(id);
  if (!current) return;
  const now = new Date().toISOString();
  const updated: ShopOrder = {
    ...current,
    fulfillment: { mode: "off", ...current.fulfillment, ...patch },
    updatedAt: now,
  };
  const supabase = getSupabase();
  const { error } = await supabase
    .from("orders")
    .update({ data: updated, updated_at: now })
    .eq("id", id);
  if (error) throw new Error(`Failed to set fulfillment: ${error.message}`);
}

// Store the auto-generated proof URL on the order.
export async function setOrderProof(id: string, proofUrl: string): Promise<void> {
  const current = await getOrderById(id);
  if (!current) return;
  const now = new Date().toISOString();
  const updated: ShopOrder = { ...current, proofUrl, updatedAt: now };
  const supabase = getSupabase();
  await supabase.from("orders").update({ data: updated, updated_at: now }).eq("id", id);
}

// Record the customer's proof approval — this is the QA sign-off that authorizes
// the vendor send. Idempotent.
export async function recordProofApproval(id: string): Promise<ShopOrder | null> {
  const current = await getOrderById(id);
  if (!current) return null;
  if (current.proofApprovedAt) return current; // already approved
  const now = new Date().toISOString();
  const updated: ShopOrder = {
    ...current,
    proofApprovedAt: now,
    status: "approved",
    updatedAt: now,
    statusLog: [
      ...current.statusLog,
      { statusFrom: current.status, statusTo: "approved", note: "Customer approved the proof.", createdAt: now },
    ],
  };
  const supabase = getSupabase();
  await supabase.from("orders").update({ status: "approved", data: updated, updated_at: now }).eq("id", id);
  return updated;
}

// Reconcile cron targets: only orders the customer has APPROVED (gate) that
// either haven't been pushed to MoaOS yet, or are pushed and awaiting a sync.
export async function getOrdersNeedingFulfillment(): Promise<ShopOrder[]> {
  const orders = await getOrders();
  return orders.filter(
    (o) =>
      o.paymentStatus === "paid" &&
      o.status !== "cancelled" &&
      (Boolean(o.proofApprovedAt) || Boolean(o.fulfillment?.catalogOrderId))
  );
}

export function statusLabel(status: OrderStatus): string {
  return status.replace(/_/g, " ");
}

const STATUS_PROGRESSION: OrderStatus[] = [
  "awaiting_payment", "paid", "artwork_qa", "awaiting_revision", "approved", "vendor_notified", "in_production", "shipped", "delivered"
];

// A PR Box's overall status = its least-advanced line (the box isn't "delivered"
// until every line is). Cancelled lines are ignored unless the whole box is.
export function bundleStatus(orders: { status: OrderStatus }[]): OrderStatus {
  const active = orders.filter((o) => o.status !== "cancelled");
  if (!active.length) return "cancelled";
  return active.reduce<OrderStatus>((min, o) => {
    const a = STATUS_PROGRESSION.indexOf(o.status);
    const b = STATUS_PROGRESSION.indexOf(min);
    return a >= 0 && (b < 0 || a < b) ? o.status : min;
  }, active[0].status);
}

// Paid orders whose proof the customer hasn't approved (or rejected) yet, due
// for a nudge: older than 2 days, no reminder in the last 2 days, max 3 nudges.
export async function getProofReminderCandidates(): Promise<ShopOrder[]> {
  const orders = await getOrders();
  const now = Date.now();
  const TWO_DAYS = 2 * 24 * 60 * 60 * 1000;
  return orders.filter((o) => {
    if (o.paymentStatus !== "paid") return false;
    if (o.proofApprovedAt || o.changesRequestedAt || o.cancelledAt) return false;
    if (o.status === "cancelled") return false;
    if (!o.proofUrl) return false;
    if ((o.approvalRemindersSent ?? 0) >= 3) return false;
    if (now - Date.parse(o.createdAt) < TWO_DAYS) return false;
    if (o.lastApprovalReminderAt && now - Date.parse(o.lastApprovalReminderAt) < TWO_DAYS) return false;
    return true;
  });
}

export async function recordProofReminder(id: string): Promise<void> {
  const current = await getOrderById(id);
  if (!current) return;
  const now = new Date().toISOString();
  const updated: ShopOrder = { ...current, approvalRemindersSent: (current.approvalRemindersSent ?? 0) + 1, lastApprovalReminderAt: now, updatedAt: now };
  await getSupabase().from("orders").update({ data: updated, updated_at: now }).eq("id", id);
}

export async function recordChangesRequested(id: string, note: string): Promise<ShopOrder | null> {
  const current = await getOrderById(id);
  if (!current) return null;
  const now = new Date().toISOString();
  const updated: ShopOrder = {
    ...current,
    changesRequestedAt: now,
    changesRequestedNote: note || current.changesRequestedNote,
    updatedAt: now,
    statusLog: [...current.statusLog, { statusFrom: current.status, statusTo: current.status, note: `Customer requested changes: ${note || "(no detail)"}`, createdAt: now }],
  };
  await getSupabase().from("orders").update({ data: updated, updated_at: now }).eq("id", id);
  return updated;
}

// Self-serve config edit (placement/color/ink/art/sizes) on an unapproved order.
// Clears any pending change request; the caller regenerates the proof + re-emails.
export async function updateOrderConfig(id: string, patch: Partial<ShopOrder>): Promise<ShopOrder | null> {
  const current = await getOrderById(id);
  if (!current) return null;
  if (current.proofApprovedAt) return current; // already in production — no edits
  const now = new Date().toISOString();
  const updated: ShopOrder = {
    ...current,
    ...patch,
    changesRequestedAt: undefined,
    changesRequestedNote: undefined,
    updatedAt: now,
    statusLog: [...current.statusLog, { statusFrom: current.status, statusTo: current.status, note: "Customer adjusted the configuration; proof regenerated.", createdAt: now }],
  };
  await getSupabase().from("orders").update({ data: updated, updated_at: now }).eq("id", id);
  return updated;
}

export async function markOrderCancelledRefunded(id: string, refundId: string | null): Promise<ShopOrder | null> {
  const current = await getOrderById(id);
  if (!current) return null;
  const now = new Date().toISOString();
  const updated: ShopOrder = {
    ...current,
    status: "cancelled",
    paymentStatus: refundId ? "refunded" : current.paymentStatus,
    cancelledAt: now,
    refundedAt: refundId ? now : current.refundedAt,
    refundId: refundId || current.refundId,
    updatedAt: now,
    statusLog: [...current.statusLog, { statusFrom: current.status, statusTo: "cancelled", note: refundId ? `Cancelled + refunded (${refundId}).` : "Cancelled.", createdAt: now }],
  };
  await getSupabase().from("orders").update({ status: "cancelled", data: updated, updated_at: now }).eq("id", id);
  return updated;
}

export async function getProductZones(slug: string): Promise<unknown | null> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("product_zones")
    .select("zones")
    .eq("product_slug", slug)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load zones: ${error.message}`);
  }
  return data ? data.zones : null;
}

export async function saveProductZones(slug: string, zones: unknown): Promise<void> {
  const supabase = getSupabase();
  const { error } = await supabase
    .from("product_zones")
    .upsert({ product_slug: slug, zones, updated_at: new Date().toISOString() }, { onConflict: "product_slug" });

  if (error) {
    throw new Error(`Failed to save zones: ${error.message}`);
  }
}

// Per-SKU calibration (the inches "ruler") — stored alongside zones in the same
// product_zones row. Upsert only touches the calibration column, leaving zones
// intact (and vice-versa).
export async function getProductCalibration(slug: string): Promise<unknown | null> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("product_zones")
    .select("calibration")
    .eq("product_slug", slug)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load calibration: ${error.message}`);
  }
  return data ? data.calibration : null;
}

export async function saveProductCalibration(slug: string, calibration: unknown): Promise<void> {
  const supabase = getSupabase();
  const { error } = await supabase
    .from("product_zones")
    .upsert({ product_slug: slug, calibration, updated_at: new Date().toISOString() }, { onConflict: "product_slug" });

  if (error) {
    throw new Error(`Failed to save calibration: ${error.message}`);
  }
}

// Per-SKU garment measurements (spec-sheet points of measure) — stored in the
// same product_zones row. Seeds the full garment tech pack later.
export async function getProductMeasurements(slug: string): Promise<unknown | null> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("product_zones")
    .select("measurements")
    .eq("product_slug", slug)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load measurements: ${error.message}`);
  }
  return data ? data.measurements : null;
}

export async function saveProductMeasurements(slug: string, measurements: unknown): Promise<void> {
  const supabase = getSupabase();
  const { error } = await supabase
    .from("product_zones")
    .upsert({ product_slug: slug, measurements, updated_at: new Date().toISOString() }, { onConflict: "product_slug" });

  if (error) {
    throw new Error(`Failed to save measurements: ${error.message}`);
  }
}
