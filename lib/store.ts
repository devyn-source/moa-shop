import { promises as fs } from "fs";
import path from "path";
import { calculateOrderPrice } from "./pricing";
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

const dataDir = path.join(process.cwd(), ".data");
const productsPath = path.join(dataDir, "products.json");
const vendorsPath = path.join(dataDir, "vendors.json");

async function readJson<T>(filePath: string, fallback: T): Promise<T> {
  try {
    const file = await fs.readFile(filePath, "utf8");
    return JSON.parse(file) as T;
  } catch {
    return fallback;
  }
}

async function writeJson<T>(filePath: string, value: T): Promise<void> {
  await fs.mkdir(dataDir, { recursive: true });
  await fs.writeFile(filePath, JSON.stringify(value, null, 2));
}

export async function getProducts({ includeDrafts = false } = {}): Promise<CatalogProduct[]> {
  const products = await readJson<CatalogProduct[]>(productsPath, seedProducts);
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
  const products = await getProducts({ includeDrafts: true });
  const index = products.findIndex((product) => product.id === id);

  if (index === -1) {
    throw new Error("Product not found");
  }

  const updated = { ...products[index], ...input };
  products[index] = updated;
  await writeJson(productsPath, products);
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

  products.push(product);
  await writeJson(productsPath, products);
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
  if (decorationIds.length === 0) {
    throw new Error("No valid decoration method selected");
  }

  const price = calculateOrderPrice(product, input.quantity, decorationIds);
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
    totalUsd: price.totalUsd,
    artworkFileName: input.artworkFileName,
    artworkFileUrl: input.artworkFileUrl,
    artworkNotes: input.artworkNotes,
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

export function statusLabel(status: OrderStatus): string {
  return status.replace(/_/g, " ");
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
