import { NextResponse } from "next/server";
import { createOrder, getProductById } from "@/lib/store";
import { getStripe } from "@/lib/stripe";
import { calculateBundlePrice } from "@/lib/pricing";
import { allocateBundleDiscount } from "@/lib/bundle";
import { PR_BOX_PROMO } from "@/lib/promo";
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
  sizeBreakdown?: Record<string, number>;
  // PR Box (bundle) — present on lines that belong to a box
  bundleId?: string;
  bundleLabel?: string;
  bundleRole?: "component" | "packaging";
  perBoxQty?: number;
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

      // Derive the box quantity from the lines; calculateBundlePrice re-clamps to MOQ.
      const boxQty = Math.max(
        1,
        ...group.map((i) => Math.round((i.quantity || 0) / Math.max(i.perBoxQty ?? 1, 1)))
      );

      const price = calculateBundlePrice(
        compResolved.map(({ line, product }) => ({
          product,
          decorationIds: (line.decorationIds ?? []).filter((id) =>
            product.decorations.some((d) => d.id === id)
          ) as DecorationMethod[],
          perBoxQty: line.perBoxQty ?? 1
        })),
        packResolved.map(({ line, product }) => ({ product, perBoxQty: line.perBoxQty ?? 1 })),
        boxQty,
        PR_BOX_PROMO
      );
      const alloc = allocateBundleDiscount(price);

      // price.lines order === [components..., packaging...] === ordered selections
      const ordered = [...compResolved, ...packResolved];
      for (let idx = 0; idx < price.lines.length; idx++) {
        const line = price.lines[idx];
        const src = ordered[idx].line;
        const order = await createOrder(
          {
            ...contact,
            productId: line.productId,
            variantId: src.variantId,
            decorationIds: (src.decorationIds ?? []) as OrderInput["decorationIds"],
            quantity: line.effectiveQty,
            artworkFileName: src.artworkFileName || "Artwork file pending",
            artworkFileUrl: src.artworkFileUrl,
            artworkNotes: src.artworkNotes || "",
            artworkPlacement: src.artworkPlacement,
            sizeBreakdown: src.sizeBreakdown,
            bundleId,
            bundleLabel: src.bundleLabel || "PR Box",
            bundleRole: line.kind,
            perBoxQty: line.perBoxQty,
            promoId: price.promo.promoId,
            bundleDiscountUsd: alloc[idx].discountUsd
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
    return NextResponse.json({ error: error instanceof Error ? error.message : "Checkout failed" }, { status: 400 });
  }
}
