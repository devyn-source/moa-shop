import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type Stripe from "stripe";
import type { ShopOrder } from "@/lib/types";

const mocks = vi.hoisted(() => ({
  getOrders: vi.fn(), markPaid: vi.fn(), setCheckout: vi.fn(), setFulfillment: vi.fn(), push: vi.fn(),
  createSession: vi.fn(), expireSession: vi.fn(),
}));
vi.mock("@/lib/store", () => ({ getCheckoutOrders: mocks.getOrders, markOrderPaid: mocks.markPaid, setOrderCheckout: mocks.setCheckout, setOrderFulfillment: mocks.setFulfillment }));
vi.mock("@/lib/express-bridge", () => ({ pushExpressOrder: mocks.push }));
vi.mock("@/lib/stripe", () => ({ getStripe: () => ({ checkout: { sessions: { create: mocks.createSession, expire: mocks.expireSession } } }) }));
import { beginExpressPayment, completeExpressPayment, handleExpressStripeSession, sandboxToken, validSandboxToken, validateExpressPayment } from "@/lib/express-payment";

const orders = [{ id: "one", checkoutId: "one", contactEmail: "qa@example.com", checkoutMode: "express_stripe", stripeSessionId: "cs_live_test", totalUsd: 1200, paymentStatus: "unpaid", shipToName: "Test", shipToAddress: {}, fulfillment: { mode: "express" } }, { id: "two", checkoutId: "one", contactEmail: "qa@example.com", checkoutMode: "express_stripe", stripeSessionId: "cs_live_test", totalUsd: 750, paymentStatus: "unpaid", fulfillment: { mode: "express" } }] as ShopOrder[];
const payment = { method: "stripe" as const, id: "cs_live_test", amountUsd: 1950, paidAt: "2026-10-02T12:00:00.000Z" };

beforeEach(() => { vi.clearAllMocks(); vi.stubEnv("EXPRESS_SECRET", "test-secret-only"); vi.stubEnv("EXPRESS_SANDBOX", "0"); mocks.getOrders.mockResolvedValue(structuredClone(orders)); mocks.push.mockResolvedValue({ ok: true, orderNumber: "EXP-TEST" }); });
afterEach(() => vi.unstubAllEnvs());

describe("payment before production proof", () => {
  it("does not send an unpaid Stripe session to the proof team", async () => {
    await handleExpressStripeSession({ payment_status: "unpaid", metadata: { expressCheckoutId: "one" } } as unknown as Stripe.Checkout.Session);
    expect(mocks.markPaid).not.toHaveBeenCalled(); expect(mocks.push).not.toHaveBeenCalled();
  });
  it("records payment before handing the full order to MoaOS", async () => {
    expect(await completeExpressPayment("one", payment)).toBe("EXP-TEST");
    expect(mocks.markPaid).toHaveBeenCalledTimes(2);
    expect(mocks.markPaid.mock.invocationCallOrder[1]).toBeLessThan(mocks.push.mock.invocationCallOrder[0]);
    expect(mocks.push.mock.calls[0][5]).toEqual(payment);
    expect(mocks.setFulfillment).toHaveBeenCalledTimes(2);
  });
  it("rejects a mismatched amount or session before recording money", async () => {
    await expect(completeExpressPayment("one", { ...payment, amountUsd: 19.5 })).rejects.toThrow("total");
    await expect(completeExpressPayment("one", { ...payment, id: "another-session" })).rejects.toThrow("session");
    expect(mocks.markPaid).not.toHaveBeenCalled();
  });
  it("never charges again after a downstream failure and surfaces a retry", async () => {
    mocks.push.mockResolvedValue({ ok: false, error: "Temporary outage" });
    await expect(completeExpressPayment("one", payment)).rejects.toThrow("Temporary outage");
    expect(mocks.markPaid).toHaveBeenCalledTimes(2); expect(mocks.createSession).not.toHaveBeenCalled();
  });
  it("does not duplicate a completed handoff on webhook redelivery", async () => {
    mocks.getOrders.mockResolvedValue(orders.map((o) => ({ ...o, paymentStatus: "paid", fulfillment: { mode: "express", catalogOrderId: "EXP-TEST" } })));
    expect(await completeExpressPayment("one", payment)).toBe("EXP-TEST");
    expect(mocks.push).not.toHaveBeenCalled();
  });
  it("creates only a test confirmation link while sandbox is enabled", async () => {
    vi.stubEnv("EXPRESS_SANDBOX", "1");
    const url = new URL(await beginExpressPayment(orders, "https://shop.test"));
    expect(url.pathname).toBe("/checkout/payment");
    expect(validSandboxToken("one", url.searchParams.get("token")!)).toBe(true);
    expect(mocks.createSession).not.toHaveBeenCalled(); expect(mocks.push).not.toHaveBeenCalled();
  });
  it("rejects forged, expired, wrong-order and live-mode sandbox tokens", () => {
    vi.stubEnv("EXPRESS_SANDBOX", "1"); const token = sandboxToken("one");
    expect(validSandboxToken("one", token)).toBe(true);
    expect(validSandboxToken("two", token)).toBe(false);
    expect(validSandboxToken("one", token + "x")).toBe(false);
    expect(validSandboxToken("one", sandboxToken("one", Date.now() - 1))).toBe(false);
    vi.stubEnv("EXPRESS_SANDBOX", "0"); expect(validSandboxToken("one", token)).toBe(false);
  });
  it("cannot turn a real checkout into a sandbox payment", () => {
    vi.stubEnv("EXPRESS_SANDBOX", "1");
    expect(() => validateExpressPayment(orders, { ...payment, method: "sandbox" })).toThrow("Sandbox");
  });
});
