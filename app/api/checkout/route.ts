import { NextResponse } from "next/server";
import { createOrder, getProductById } from "@/lib/store";
import { getStripe } from "@/lib/stripe";
import { calculateOrderPrice, getPriceTier, round2 } from "@/lib/pricing";
import { isPromoWithinWindow, PR_BOX_PROMO } from "@/lib/promo";
import { apiError } from "@/lib/errors";
import { rateLimit, clientIp } from "@/lib/rate-limit";
import type { DecorationMethod, OrderInput, ShopOrder } from "@/lib/types";

export const runtime = "nodejs";

type CartLine = {
  productId: string;
  variantId: string;
  decorationIds: string[];
  quantity: number;
  displayName: string;
  colorLabel?: string;
  decorationLabel?: string;
  artworkFileName?: string;
  artworkFileUrl?: string;
  artworkNotes?: string;
  artworkPlacement?: OrderInput["artworkPlacement"];
  artworkPlacements?: OrderInput["artworkPlacements"];
  wovenLabel?: boolean;
  sizeBreakdown?: Record<string, number>;
  // PR Box (bundle) — present on lines that belong to a box
  bundleId?: string;
  bundleLabel?: string;
  bundleRole?: "component" | "packaging";
  perBoxQty?: number;
  printed?: boolean; // packaging: branded (printed) vs blank
};

type Body = {
  items: CartLine[];
  ipAttested?: boolean;
  contact: {
    contactName: string;
    contactEmail: string;
    contactPhone: string;
    companyName: string;
    shipToName: string;
    shipToAddress: OrderInput["shipToAddress"];
  };
};

export async function POST(request: Request) {
  try {
    if (!(await rateLimit("checkout", clientIp(request)))) {
      return NextResponse.json({ error: "Too many checkout attempts. Please wait a few minutes." }, { status: 429 });
    }
    const { items, contact, ipAttested } = (await request.json()) as Body;
    if (!items?.length) {
      return NextResponse.json({ error: "Cart is empty" }, { status: 400 });
    }
    // Artwork IP attestation — the customer must certify they hold the rights.
    if (!ipAttested) {
      return NextResponse.json({ error: "Please confirm you own or have the rights to use this artwork." }, { status: 400 });
    }

    // Validate Stripe is configured before creating any orders (avoids orphans).
    const stripe = getStripe();

    // Split standalone SKUs from PR Box groups (lines sharing a bundleId).
    const singles: CartLine[] = [];
    const bundleGroups = new Map<string, CartLine[]>();
    for (const item of items) {
      if (item.bundleId) {
        const group = bundleGroups.get(item.bundleId) ?? [];
        group.push(item);
        bundleGroups.set(item.bundleId, group);
      } else {
        singles.push(item);
      }
    }

    // Create one pending, server-priced order per cart line (never trust client totals).
    const created: { order: ShopOrder; item: CartLine }[] = [];

    for (const item of singles) {
      const order = await createOrder(
        {
          ...contact,
          productId: item.productId,
          variantId: item.variantId,
          decorationIds: item.decorationIds as OrderInput["decorationIds"],
          quantity: item.quantity,
          artworkFileName: item.artworkFileName || "Artwork file pending",
          artworkFileUrl: item.artworkFileUrl,
          artworkNotes: item.artworkNotes || "",
          artworkPlacement: item.artworkPlacement,
          artworkPlacements: item.artworkPlacements,
          wovenLabel: item.wovenLabel,
          sizeBreakdown: item.sizeBreakdown
        },
        { paid: false }
      );
      created.push({ order, item });
    }

    // PR Box: re-price the whole box on the server (re-validates the promo +
    // active window), allocate the discount across lines, then create one order
    // per line with its server-validated discount share.
    for (const [bundleId, group] of bundleGroups) {
      const compItems = group.filter((i) => i.bundleRole !== "packaging");
      const packItems = group.filter((i) => i.bundleRole === "packaging");

      const resolve = async (line: CartLine) => {
        const product = await getProductById(line.productId);
        if (!product) throw new Error(`PR Box item not found: ${line.productId}`);
        return { line, product };
      };
      const compResolved = await Promise.all(compItems.map(resolve));
      const packResolved = await Promise.all(packItems.map(resolve));

      // Full-PDP model: each item is a complete order line (its own size run +
      // quantity + features). Re-price every line server-side (never trust client
      // totals); the box is the grouping + packaging + the bundle discount.
      const compPriced = compResolved.map(({ line, product }) => {
        const decorationIds = (line.decorationIds ?? []).filter((id) =>
          product.decorations.some((d) => d.id === id)
        ) as DecorationMethod[];
        const priced = calculateOrderPrice(product, line.quantity, decorationIds, {
          placementCount: line.artworkPlacements?.length,
          wovenLabel: line.wovenLabel
        });
        return { line, decorationIds, gross: priced.totalUsd };
      });
      const packPriced = packResolved.map(({ line, product }) => {
        const tier = getPriceTier(product, line.quantity).perUnitUsd;
        const blank = line.printed === false && product.printable !== false;
        const perUnit = blank ? Math.max(0, tier - (product.printUpchargeUsd ?? 0)) : tier;
        return { line, blank, gross: round2(perUnit * line.quantity) };
      });

      // Program size = one of each item per box.
      const boxQty = Math.max(1, packResolved[0]?.line.quantity ?? 0, ...compResolved.map((c) => c.line.quantity || 0));
      const grossTotal = round2(
        compPriced.reduce((s, x) => s + x.gross, 0) + packPriced.reduce((s, x) => s + x.gross, 0)
      );
      const active = isPromoWithinWindow(PR_BOX_PROMO);
      const qualifies =
        active &&
        compPriced.length >= PR_BOX_PROMO.qualify.minComponents &&
        (!PR_BOX_PROMO.qualify.requirePackaging || packPriced.length > 0) &&
        boxQty >= PR_BOX_PROMO.qualify.minBoxes;
      const percent = qualifies ? Math.min(1, Math.max(0, PR_BOX_PROMO.discount.value)) : 0;
      const discountTotal = round2(grossTotal * percent);

      // Allocate the discount across every line, proportional to its gross.
      const allPriced = [...compPriced, ...packPriced];
      let remaining = discountTotal;
      const shares = allPriced.map((x, i) => {
        const isLast = i === allPriced.length - 1;
        const d = isLast ? round2(remaining) : round2(grossTotal > 0 ? discountTotal * (x.gross / grossTotal) : 0);
        remaining = round2(remaining - d);
        return d;
      });
      const promoId = qualifies ? PR_BOX_PROMO.id : undefined;

      let shareIdx = 0;
      for (const x of compPriced) {
        const src = x.line;
        const order = await createOrder(
          {
            ...contact,
            productId: src.productId,
            variantId: src.variantId,
            decorationIds: x.decorationIds as OrderInput["decorationIds"],
            quantity: src.quantity,
            artworkFileName: src.artworkFileName || "Artwork file pending",
            artworkFileUrl: src.artworkFileUrl,
            artworkNotes: src.artworkNotes || "",
            artworkPlacement: src.artworkPlacement,
            artworkPlacements: src.artworkPlacements,
            wovenLabel: src.wovenLabel,
            sizeBreakdown: src.sizeBreakdown,
            bundleId,
            bundleLabel: src.bundleLabel || "PR Box",
            bundleRole: "component",
            promoId,
            bundleDiscountUsd: shares[shareIdx++]
          },
          { paid: false }
        );
        created.push({ order, item: src });
      }
      for (const x of packPriced) {
        const src = x.line;
        const order = await createOrder(
          {
            ...contact,
            productId: src.productId,
            variantId: src.variantId,
            decorationIds: [] as OrderInput["decorationIds"],
            quantity: src.quantity,
            artworkFileName: src.artworkFileName || "Artwork file pending",
            artworkFileUrl: src.artworkFileUrl,
            artworkNotes: src.artworkNotes || "",
            bundleId,
            bundleLabel: src.bundleLabel || "PR Box",
            bundleRole: "packaging",
            blankPackaging: x.blank,
            promoId,
            bundleDiscountUsd: shares[shareIdx++]
          },
          { paid: false }
        );
        created.push({ order, item: src });
      }
    }

    if (created.length === 0) {
      return NextResponse.json({ error: "Nothing to check out" }, { status: 400 });
    }

    const origin = request.headers.get("origin") ?? new URL(request.url).origin;
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      customer_email: contact.contactEmail,
      line_items: created.map(({ order, item }) => ({
        quantity: 1,
        price_data: {
          currency: "usd",
          unit_amount: Math.round(order.totalUsd * 100),
          product_data: {
            name: `${item.bundleLabel ? `${item.bundleLabel}: ` : ""}${item.displayName} — ${item.colorLabel ?? ""}`.trim(),
            description: `${order.quantity} units · ${item.decorationLabel ?? "decoration"}`
          }
        }
      })),
      metadata: { orderIds: created.map(({ order }) => order.id).join(",") },
      // Stripe Tax — ready, but OFF until you activate Tax + registrations in
      // the Stripe dashboard and set STRIPE_TAX_ENABLED=true (else it'd error).
      ...(process.env.STRIPE_TAX_ENABLED === "true"
        ? { automatic_tax: { enabled: true }, billing_address_collection: "required" as const }
        : {}),
      success_url: `${origin}/checkout/success?orders=${created.map(({ order }) => order.id).join(",")}`,
      cancel_url: `${origin}/cart`
    });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    return apiError(error, { fallback: "Checkout failed. Please try again.", status: 400 });
  }
}
