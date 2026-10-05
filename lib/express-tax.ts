import type Stripe from "stripe";
import type { ShopOrder } from "./types";

// Classification must be reviewed before live activation. Do not silently use
// a generic code for clothing: state exemptions depend on the product category.
export function stripeTaxCode(category: string): string {
  const code = process.env[`STRIPE_TAX_CODE_${category.toUpperCase()}`];
  if (!code || !/^txcd_\d{8}$/.test(code)) throw new Error(`Tax classification is not configured for ${category}`);
  return code;
}

export function taxableLineItems(order: ShopOrder, taxCode: string): Stripe.Checkout.SessionCreateParams.LineItem[] {
  const cents = Math.round((order.totalUsd - order.taxUsd) * 100);
  if (!Number.isSafeInteger(order.quantity) || order.quantity <= 0 || cents <= 0) throw new Error("Invalid order quantity or price");
  // Preserve actual unit quantities for per-item clothing thresholds, while
  // distributing any rounding cent instead of changing the server-priced total.
  const unit = Math.floor(cents / order.quantity), remainder = cents % order.quantity;
  return [[order.quantity - remainder, unit], [remainder, unit + 1]].filter(([quantity]) => quantity > 0).map(([quantity, amount]) => ({
    quantity, price_data: { currency: "usd", unit_amount: amount, tax_behavior: "exclusive", product_data: {
      name: order.orderNumber, tax_code: taxCode, metadata: { shopOrderId: order.id },
    } },
  }));
}

export function checkoutTaxBreakdown(orders: ShopOrder[], session: Stripe.Checkout.Session, lines: Stripe.LineItem[]) {
  if (session.automatic_tax?.enabled && session.automatic_tax.status !== "complete") throw new Error("Tax calculation is not complete");
  const subtotal = orders.reduce((n, o) => n + Math.round((o.totalUsd - o.taxUsd) * 100), 0);
  const tax = session.total_details?.amount_tax ?? 0;
  if (!Number.isSafeInteger(tax) || tax < 0 || session.amount_subtotal !== subtotal || session.amount_total !== subtotal + tax || (session.total_details?.amount_discount ?? 0) !== 0 || (session.total_details?.amount_shipping ?? 0) !== 0) throw new Error("Payment and tax totals do not match checkout");
  const amounts = new Map(orders.map((o) => [o.id, { subtotal: 0, tax: 0 }]));
  for (const line of lines) {
    const product = line.price?.product;
    const id = product && typeof product !== "string" && !product.deleted ? product.metadata?.shopOrderId : null;
    const item = id ? amounts.get(id) : null;
    if (!item || line.currency !== "usd" || line.amount_total !== line.amount_subtotal + line.amount_tax) throw new Error("Invalid checkout tax line");
    item.subtotal += line.amount_subtotal; item.tax += line.amount_tax;
  }
  for (const o of orders) if (amounts.get(o.id)!.subtotal !== Math.round((o.totalUsd - o.taxUsd) * 100)) throw new Error("Tax line subtotal does not match order");
  if ([...amounts.values()].reduce((n, x) => n + x.tax, 0) !== tax) throw new Error("Tax lines do not match checkout tax");
  return amounts;
}
