import { afterEach, describe, expect, it, vi } from "vitest";
import type Stripe from "stripe";
import type { ShopOrder } from "@/lib/types";
import { checkoutTaxBreakdown, stripeTaxCode, taxableLineItems } from "@/lib/express-tax";
afterEach(() => vi.unstubAllEnvs());
const orders = [{ id: "tee", quantity: 50, totalUsd: 2000, taxUsd: 0 }, { id: "hat", quantity: 50, totalUsd: 1000, taxUsd: 0 }] as ShopOrder[];
const session = { automatic_tax: { enabled: true, status: "complete" }, amount_subtotal: 300000, amount_total: 324750, total_details: { amount_tax: 24750, amount_discount: 0, amount_shipping: 0 } } as Stripe.Checkout.Session;
const line = (id: string, subtotal: number, tax: number) => ({ currency: "usd", amount_subtotal: subtotal, amount_tax: tax, amount_total: subtotal + tax, price: { product: { metadata: { shopOrderId: id } } } }) as unknown as Stripe.LineItem;
describe("Express tax integrity", () => {
  it("preserves physical unit quantities and allocates rounding cents exactly", () => {
    const result = taxableLineItems({ ...orders[0], totalUsd: 2000.01 }, "txcd_30011000");
    expect(result.reduce((n, l) => n + l.quantity!, 0)).toBe(50);
    expect(result.reduce((n, l) => n + l.quantity! * l.price_data!.unit_amount!, 0)).toBe(200001);
    expect(result.every((l) => l.price_data!.tax_behavior === "exclusive")).toBe(true);
  });
  it("records actual mixed-line tax, not a proportional guess", () => {
    const values = checkoutTaxBreakdown(orders, session, [line("tee", 200000, 20000), line("hat", 100000, 4750)]);
    expect(values.get("tee")).toEqual({ subtotal: 200000, tax: 20000 });
    expect(values.get("hat")).toEqual({ subtotal: 100000, tax: 4750 });
  });
  it("rejects incomplete tax, unknown lines, changed totals and missing products", () => {
    const lines = [line("tee", 200000, 20000), line("hat", 100000, 4750)];
    expect(() => checkoutTaxBreakdown(orders, { ...session, automatic_tax: { enabled: true, status: "requires_location_inputs" } } as Stripe.Checkout.Session, lines)).toThrow("not complete");
    expect(() => checkoutTaxBreakdown(orders, { ...session, amount_total: 324751 }, lines)).toThrow("totals");
    expect(() => checkoutTaxBreakdown(orders, session, [line("unknown", 300000, 24750)])).toThrow("Invalid");
    expect(() => checkoutTaxBreakdown(orders, session, [line("tee", 300000, 24750)])).toThrow("subtotal");
  });
  it("requires a reviewed tax classification before live checkout", () => {
    vi.stubEnv("STRIPE_TAX_CODE_TEE", ""); expect(() => stripeTaxCode("tee")).toThrow("not configured");
    vi.stubEnv("STRIPE_TAX_CODE_TEE", "txcd_30011000"); expect(stripeTaxCode("tee")).toBe("txcd_30011000");
  });
});
