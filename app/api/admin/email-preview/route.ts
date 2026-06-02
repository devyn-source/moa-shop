// Admin-only preview for the order-confirmation email (gated by proxy.ts).
//   GET /api/admin/email-preview            -> renders HTML with a sample order
//   GET /api/admin/email-preview?slug=...   -> use a specific catalog product
//   GET /api/admin/email-preview?orderId=.. -> use a real order
//   GET /api/admin/email-preview?to=a@b.com -> ALSO sends a test via the live
//                                              email path (Resend or N8N Gmail)
import { NextResponse } from "next/server";
import { getProducts, getProductBySlug, getOrderById, getProductById } from "@/lib/store";
import { renderHtml, sendOrderConfirmation } from "@/lib/email";
import type { ShopOrder, CatalogProduct } from "@/lib/types";

export const runtime = "nodejs";

function sampleOrder(product: CatalogProduct): ShopOrder {
  const variant = product.variants[0];
  const deco = product.decorations.find((d) => d.isAvailable) ?? product.decorations[0];
  const qty = Math.max(product.moq, 100);
  const tier = [...product.priceTiers].reverse().find((t) => qty >= t.minQty) ?? product.priceTiers[0];
  const perUnit = tier?.perUnitUsd ?? product.vendorUnitCostUsd * 2.2;
  const adder = deco?.perUnitAdderUsd ?? 0;
  const subtotal = (perUnit + adder) * qty;
  return {
    id: "preview",
    orderNumber: "MOA-1042",
    contactName: "Jordan Reyes",
    contactEmail: "jordan@example.com",
    contactPhone: "",
    companyName: "Atlas Studio",
    productId: product.id,
    variantId: variant?.id ?? "",
    decorationIds: deco ? [deco.id] : [],
    quantity: qty,
    perUnitUsd: perUnit,
    decorationAdderUsd: adder,
    subtotalUsd: subtotal,
    taxUsd: 0,
    totalUsd: subtotal,
    artworkFileName: "atlas-logo-vector.ai",
    artworkNotes: "",
    paymentStatus: "paid",
    status: "artwork_qa",
    shipToName: "Jordan Reyes",
    shipToAddress: {
      line1: "1847 Industrial Blvd",
      line2: "Suite 200",
      city: "Los Angeles",
      state: "CA",
      postalCode: "90021",
      country: "United States"
    },
    internalNotes: "",
    statusLog: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const slug = url.searchParams.get("slug");
  const orderId = url.searchParams.get("orderId");
  const to = url.searchParams.get("to");
  const origin = url.origin;

  let order: ShopOrder | null = null;
  let product: CatalogProduct | null = null;

  if (orderId) {
    order = await getOrderById(orderId);
    if (order) product = await getProductById(order.productId);
  }
  if (!order) {
    product = slug
      ? await getProductBySlug(slug)
      : (await getProducts())[0] ?? null;
    if (!product) return NextResponse.json({ error: "No products in catalog" }, { status: 404 });
    order = sampleOrder(product);
  }

  if (to) {
    const sendOrder = { ...order, contactEmail: to };
    const result = await sendOrderConfirmation(sendOrder, request);
    return NextResponse.json({ previewSentTo: to, ...result });
  }

  const html = renderHtml(order, product, origin);
  return new NextResponse(html, { headers: { "content-type": "text/html; charset=utf-8" } });
}
