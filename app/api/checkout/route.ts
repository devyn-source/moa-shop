import plateIndex from "@/lib/plates.generated.json";
import { checkoutContactSchema } from "@/lib/checkout-contact";
import { validMockupUrls } from "@/lib/mockup-urls";
import { NextResponse } from "next/server";
import { createOrder, getProductById } from "@/lib/store";
import { getStripe } from "@/lib/stripe";
import { assertExpressPaymentReady, beginExpressPayment } from "@/lib/express-payment";
import { expressCheckoutEnabled } from "@/lib/express-bridge";
import { generateProof } from "@/lib/proof";
import { setOrderProof, updateOrderStatus } from "@/lib/store";
import { calculateOrderPrice, getPriceTier, round2 } from "@/lib/pricing";
import { isPromoWithinWindow, PR_BOX_PROMO } from "@/lib/promo";
import { apiError } from "@/lib/errors";
import { inLaunchScope } from "@/lib/launch";
import { rateLimit, clientIp } from "@/lib/rate-limit";
import { currentCustomerEmail } from "@/lib/order-access";
import { validateCheckoutSelection } from "@/lib/checkout-selection";
import type { DecorationMethod, OrderInput, ShopOrder } from "@/lib/types";

export const runtime = "nodejs";

type CartLine = {
  mockupUrls?: OrderInput["mockupUrls"];
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
  fabricOptionId?: string;
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
    if (expressCheckoutEnabled() && process.env.EXPRESS_CHECKOUT_PAUSED === "1") {
      return NextResponse.json({ error: "New orders are temporarily paused. Your cart is saved. Please try again later." }, { status: 503, headers: { "Retry-After": "900" } });
    }
    if (!(await rateLimit("checkout", clientIp(request)))) {
      return NextResponse.json({ error: "Too many checkout attempts. Please wait a few minutes." }, { status: 429 });
    }
    const { items, contact: rawContact, ipAttested } = (await request.json()) as Body;
    if (!Array.isArray(items) || !items.length) {
      return NextResponse.json({ error: "Cart is empty" }, { status: 400 });
    }
    if (items.length > 30) return NextResponse.json({ error: "Please check out with up to 30 items at a time." }, { status: 400 });
    // Artwork IP attestation — the customer must certify they hold the rights.
    if (!ipAttested) {
      return NextResponse.json({ error: "Please confirm you own or have the rights to use this artwork." }, { status: 400 });
    }
    const parsedContact = checkoutContactSchema.safeParse(rawContact);
    if (!parsedContact.success) {
      return NextResponse.json({ error: parsedContact.error.issues[0]?.message || "Check your contact and shipping details." }, { status: 400 });
    }
    const contact = parsedContact.data;
    const email = await currentCustomerEmail();
    if (!email) return NextResponse.json({ error: "Sign in required to order" }, { status: 401 });
    if (contact.contactEmail !== email) return NextResponse.json({ error: "Use your signed-in account email so you can review your proof and manage this order." }, { status: 400 });

    // Confirm the paid-order receiver is ready before creating a checkout.
    const express = expressCheckoutEnabled();
    const stripe = express ? null : getStripe();
    if (express) await assertExpressPaymentReady();

    // Express launch scope: only the production-ready styles (plus packaging
    // add-ons) can be ordered, whatever an old cart still holds.
    if (express) {
      if (!["United States", "USA", "US"].includes(contact.shipToAddress.country)) return NextResponse.json({ error: "Express delivery is currently available in the United States" }, { status: 400 });
      for (const item of items) {
        if (item.bundleId) return NextResponse.json({ error: "PR Box orders are not available in this launch" }, { status: 400 });
        const product = await getProductById(item.productId);
        if (product && product.slug in plateIndex && !item.bundleId && !item.mockupUrls) {
          return NextResponse.json({ error: `Open ${product.displayName} from your cart and save its design before checking out.` }, { status: 400 });
        }
        if (!product || !inLaunchScope(product)) {
          return NextResponse.json({ error: `${item.displayName || "One item"} is not available to order right now. Remove it from your cart to continue.` }, { status: 400 });
        }
        validateCheckoutSelection(product, item);
      }
    }

    for (const item of items) {
      if (item.mockupUrls && !validMockupUrls(item.mockupUrls, process.env.SUPABASE_URL)) {
        return NextResponse.json({ error: "A saved mockup is invalid. Open that item and save the design again." }, { status: 400 });
      }
    }

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
          mockupUrls: item.mockupUrls,
          wovenLabel: item.wovenLabel,
          fabricOptionId: item.fabricOptionId,
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
          wovenLabel: line.wovenLabel,
          fabricOptionId: line.fabricOptionId
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
            mockupUrls: src.mockupUrls,
            wovenLabel: src.wovenLabel,
            fabricOptionId: src.fabricOptionId,
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

    const origin = process.env.NEXT_PUBLIC_SITE_ORIGIN || new URL(request.url).origin;

    if (express) {
      // Render each line's mockup now so the customer sees it immediately and
      // MOA reviews the exact image the customer reviewed on screen.
      const proofOrigin = process.env.NEXT_PUBLIC_SITE_ORIGIN || origin;
      for (const c of created) {
        try {
          const url = await generateProof(c.order, proofOrigin);
          if (!url && c.order.mockupUrls) throw new Error("Could not store the proof");
          if (url) { await setOrderProof(c.order.id, url); c.order.proofUrl = url; }
        } catch (e) {
          console.warn("[express] proof render failed", c.order.id, e);
          if (c.order.mockupUrls) {
            for (const entry of created) await updateOrderStatus(entry.order.id, "cancelled", "Mockup could not be saved; customer can retry").catch(() => null);
            return NextResponse.json({ error: "Your mockup could not be attached to the order. Please try again." }, { status: 502 });
          }
        }
      }
      try {
        return NextResponse.json({ url: await beginExpressPayment(created.map((c) => c.order), origin) });
      } catch (error) {
        for (const c of created) await updateOrderStatus(c.order.id, "cancelled", "Payment checkout could not start. No charge was made.").catch(() => null);
        throw error;
      }
    }

    if (!stripe) throw new Error("Stripe is not configured");
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      customer_email: contact.contactEmail,
      line_items: created.map(({ order, item }) => ({
        quantity: 1,
        price_data: {
          currency: "usd",
          unit_amount: Math.round(order.totalUsd * 100),
          product_data: {
            name: `${item.bundleLabel ? `${item.bundleLabel}: ` : ""}${item.displayName}${item.colorLabel ? `, ${item.colorLabel}` : ""}`,
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
