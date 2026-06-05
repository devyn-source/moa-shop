import { NextResponse } from "next/server";
import { createOrder } from "@/lib/store";
import { getStripe } from "@/lib/stripe";
import type { OrderInput } from "@/lib/types";

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

    // Create one pending, server-priced order per cart line (never trust client totals).
    const created = [];
    for (const item of items) {
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
            name: `${item.displayName} — ${item.colorLabel ?? ""}`.trim(),
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
