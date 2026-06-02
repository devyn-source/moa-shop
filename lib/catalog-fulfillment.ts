// Storefront → MoaOS catalog pipeline. On payment, pushes the order into MoaOS
// (which creates a DRAFT PO routed to a TEST vendor). Mode-gated so nothing
// moves until MOA is ready; the push itself only ever CREATES internal records
// — vendor send is a separate, MoaOS-side gated step. Status syncs back so the
// customer tracker stays live.
// Design: docs/catalog-fulfillment-architecture.md
import type { ShopOrder } from "./types";
import { getProductById, setOrderFulfillment, getOrderById, updateOrderStatus } from "./store";
import { sendShippingNotification } from "./email";

export type FulfillmentMode = "off" | "dry_run" | "draft_only" | "manual_release" | "auto";

export function fulfillmentMode(): FulfillmentMode {
  const m = (process.env.CATALOG_FULFILLMENT_MODE || "off").toLowerCase();
  return (["off", "dry_run", "draft_only", "manual_release", "auto"] as const).includes(m as FulfillmentMode)
    ? (m as FulfillmentMode)
    : "off";
}

function moaosConfig() {
  return {
    url: process.env.MOAOS_INTAKE_URL || "", // e.g. https://os.magnumopus.agency
    secret: process.env.MOAOS_INTAKE_SECRET || "",
  };
}

// Map a single-product shop order into the MoaOS intake payload.
async function buildIntakePayload(order: ShopOrder) {
  const origin = process.env.NEXT_PUBLIC_SITE_ORIGIN || "https://shop.magnumopus.agency";
  const product = await getProductById(order.productId);
  const variant = product?.variants.find((v) => v.id === order.variantId) ?? null;
  const decos = (product?.decorations ?? []).filter((d) => order.decorationIds.includes(d.id));
  const shot = variant?.frontImage || product?.greyFront || null;
  return {
    shopOrderId: order.id,
    orderNumber: order.orderNumber,
    customer: { name: order.contactName, email: order.contactEmail, company: order.companyName },
    subtotalUsd: order.subtotalUsd,
    taxUsd: order.taxUsd,
    totalUsd: order.totalUsd,
    artworkFileUrl: order.artworkFileUrl ?? null,
    artworkFileName: order.artworkFileName ?? null,
    shipTo: order.shipToAddress ?? null,
    items: [
      {
        skuCode: product?.skuCode ?? null,
        productName: product?.displayName ?? "Catalog product",
        variantLabel: variant?.colorLabel ?? null,
        decoration: order.artworkPlacement?.method || decos.map((d) => d.label).join(" + ") || null,
        // The customer's ACTUAL chosen placement (falls back to the decoration's
        // default zones only if no placement was captured).
        placement: order.artworkPlacement?.zoneLabel || Array.from(new Set(decos.flatMap((d) => d.placementZones))).join(", ") || null,
        placementSpec: order.artworkPlacement ?? null,
        maxColors: order.artworkPlacement?.maxColors ?? null,
        quantity: order.quantity,
        clientUnitCost: order.perUnitUsd + order.decorationAdderUsd,
        // The standardized catalog cost — lets MoaOS build the draft PO with no quoting.
        vendorUnitCost: product?.vendorUnitCostUsd ?? null,
        // Rich display spec for the vendor PO email (stored in tech_pack_data).
        imageUrl: shot ? `${origin}${shot}` : null,
        colorHex: variant?.colorHex ?? null,
        colorTcx: variant?.colorTcx ?? null,
        fabric: variant?.fabric ?? null,
        category: product?.category ?? null,
        sizes: product?.sizes ?? null,
        sizeBreakdown: order.sizeBreakdown ?? null,
      },
    ],
  };
}

// Push an order into MoaOS. Idempotent on the MoaOS side (shop_order_id), and
// safe to re-run from the reconcile cron. Records the outcome on the order.
export async function pushOrderToMoaOS(order: ShopOrder): Promise<{ pushed: boolean; reason?: string }> {
  const mode = fulfillmentMode();
  if (mode === "off") return { pushed: false, reason: "mode=off" };

  const payload = await buildIntakePayload(order);

  if (mode === "dry_run") {
    await setOrderFulfillment(order.id, { mode, dryRunPayload: payload, pushedAt: new Date().toISOString() });
    return { pushed: false, reason: "dry_run (recorded, not sent)" };
  }

  const { url, secret } = moaosConfig();
  if (!url || !secret) {
    await setOrderFulfillment(order.id, { mode, lastError: "MOAOS_INTAKE_URL/SECRET not configured" });
    return { pushed: false, reason: "not configured" };
  }

  try {
    const res = await fetch(`${url}/api/catalog/intake`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-moa-internal-secret": secret },
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      await setOrderFulfillment(order.id, { mode, lastError: `intake ${res.status}: ${JSON.stringify(data).slice(0, 200)}` });
      return { pushed: false, reason: `intake ${res.status}` };
    }
    await setOrderFulfillment(order.id, {
      mode,
      pushedAt: new Date().toISOString(),
      catalogOrderId: data.catalogOrderId,
      poIds: data.poIds,
      poNumber: data.poNumber,
      catalogStatus: data.status,
      lastError: undefined,
    });
    return { pushed: true };
  } catch (err) {
    await setOrderFulfillment(order.id, { mode, lastError: err instanceof Error ? err.message : "push failed" });
    return { pushed: false, reason: "exception" };
  }
}

// Pull current MoaOS status for an already-pushed order, mirror it back, and —
// when it ships — email the customer their tracking (once). Drives the back half.
export async function syncOrderFromMoaOS(order: ShopOrder): Promise<void> {
  const { url, secret } = moaosConfig();
  if (!url || !secret) return;
  try {
    const res = await fetch(`${url}/api/catalog/${encodeURIComponent(order.id)}`, {
      headers: { "x-moa-internal-secret": secret },
    });
    if (!res.ok) return;
    const data = await res.json();
    if (!data?.found) return;
    const now = new Date().toISOString();
    await setOrderFulfillment(order.id, {
      catalogOrderId: data.catalogOrderId,
      catalogStatus: data.status,
      poNumber: data.pos?.[0]?.po_number,
      trackingCarrier: data.trackingCarrier ?? undefined,
      trackingNumber: data.trackingNumber ?? undefined,
      lastSyncedAt: now,
    });

    const fresh = (await getOrderById(order.id)) ?? order;
    if (data.status === "shipped" && !fresh.fulfillment?.shippedNotifiedAt) {
      // Notify the customer once, with tracking.
      if (data.trackingCarrier && data.trackingNumber) {
        await sendShippingNotification(fresh, { carrier: data.trackingCarrier, number: data.trackingNumber });
      }
      await updateOrderStatus(order.id, "shipped", "Shipped — tracking sent to customer.", {
        trackingCarrier: data.trackingCarrier,
        trackingNumber: data.trackingNumber,
      });
      await setOrderFulfillment(order.id, { shippedNotifiedAt: new Date().toISOString() });
    } else if (data.status === "delivered" && fresh.status !== "delivered") {
      await updateOrderStatus(order.id, "delivered", "Delivered.");
    }
  } catch {
    /* transient — next cron tick retries */
  }
}
