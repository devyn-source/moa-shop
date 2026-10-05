import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { RefundTicket } from "@/lib/express-refunds";
const mocks = vi.hoisted(() => ({ from: vi.fn(), rpc: vi.fn(), getOrders: vi.fn(), retrieveSession: vi.fn(), createRefund: vi.fn(), listRefunds: vi.fn(), retrieveRefund: vi.fn(), stripe: vi.fn() }));
vi.mock("@/lib/supabase", () => ({ getSupabase: () => ({ from: mocks.from, rpc: mocks.rpc }) }));
vi.mock("@/lib/store", () => ({ getCheckoutOrders: mocks.getOrders }));
vi.mock("@/lib/order-access", () => ({ ownsOrder: (o: { contactEmail: string }, e: string) => o?.contactEmail === e }));
vi.mock("@/lib/express-payment", () => ({ checkoutTotalCents: (orders: { totalUsd: number }[]) => orders.reduce((n, o) => n + Math.round(o.totalUsd * 100), 0) }));
vi.mock("@/lib/stripe", () => ({ getStripe: mocks.stripe }));
import { cancelExpressCheckout, processExpressRefund, reconcileExpressRefunds } from "@/lib/express-refunds";
const ticket: RefundTicket = { checkout_id: "checkout", order_number: "EXP-QA", payment_id: "cs_test", mode: "express_stripe", amount_cents: 10800, status: "requested", refund_id: null };
const refund = { id: "re_test", payment_intent: "pi_test", currency: "usd", amount: 10800, status: "succeeded", metadata: { expressCheckoutId: "checkout" } };
const orders = [{ id: "a", checkoutId: "checkout", checkoutMode: "express_stripe", stripeSessionId: "cs_test", contactEmail: "owner@example.com", totalUsd: 70, paymentStatus: "paid", fulfillment: { mode: "express", catalogOrderId: "EXP-QA" } }, { id: "b", checkoutId: "checkout", checkoutMode: "express_stripe", stripeSessionId: "cs_test", contactEmail: "owner@example.com", totalUsd: 38, paymentStatus: "paid", fulfillment: { mode: "express", catalogOrderId: "EXP-QA" } }];
let fetchMock: ReturnType<typeof vi.fn>;
beforeEach(() => {
  vi.clearAllMocks(); vi.stubEnv("EXPRESS_SANDBOX", "0"); vi.stubEnv("MOAOS_EXPRESS_URL", "https://ops.test"); vi.stubEnv("EXPRESS_SECRET", "mock-only");
  fetchMock = vi.fn().mockImplementation(async () => new Response(JSON.stringify({ ok: true }), { status: 200 })); vi.stubGlobal("fetch", fetchMock);
  mocks.stripe.mockReturnValue({ checkout: { sessions: { retrieve: mocks.retrieveSession } }, refunds: { create: mocks.createRefund, list: mocks.listRefunds, retrieve: mocks.retrieveRefund } });
  mocks.retrieveSession.mockResolvedValue({ payment_intent: "pi_test", payment_status: "paid", currency: "usd", amount_total: 10800, metadata: { expressCheckoutId: "checkout" } });
  mocks.listRefunds.mockResolvedValue({ has_more: false, data: [] }); mocks.createRefund.mockResolvedValue(refund); mocks.retrieveRefund.mockResolvedValue(refund);
  mocks.rpc.mockImplementation(async (_name, b) => ({ error: null, data: { ...ticket, mode: b.p_mode, status: b.p_status, refund_id: b.p_refund_id } }));
  mocks.getOrders.mockResolvedValue(orders);
  mocks.from.mockImplementation(() => { const q: Record<string, unknown> = {}; q.select = q.eq = q.limit = q.update = () => q; q.then = (resolve: (v: unknown) => unknown) => Promise.resolve({ data: [{ data: orders[0] }], error: null }).then(resolve); return q; });
});
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });
describe("whole-checkout refund orchestration", () => {
  it("reserves cancellation before refunding all items and reconciles the result", async () => {
    const result = await cancelExpressCheckout("EXP-QA", "owner@example.com");
    expect(result.status).toBe("succeeded");
    expect(fetchMock.mock.calls[0][0]).toContain("/cancel");
    expect(fetchMock.mock.invocationCallOrder[0]).toBeLessThan(mocks.createRefund.mock.invocationCallOrder[0]);
    expect(mocks.createRefund).toHaveBeenCalledWith(expect.objectContaining({ amount: 10800, payment_intent: "pi_test" }), expect.objectContaining({ idempotencyKey: "express-refund-checkout", timeout: 8000, maxNetworkRetries: 0 }));
    expect(fetchMock.mock.calls[1][0]).toContain("/refund");
  });
  it("rejects another owner and an approval conflict before touching Stripe", async () => {
    await expect(cancelExpressCheckout("EXP-QA", "other@example.com")).rejects.toMatchObject({ status: 404 });
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ error: "A piece has been approved" }), { status: 409 }));
    await expect(cancelExpressCheckout("EXP-QA", "owner@example.com")).rejects.toMatchObject({ status: 409 });
    expect(mocks.stripe).not.toHaveBeenCalled(); expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it("does not report a processor exception as a completed refund", async () => {
    mocks.createRefund.mockRejectedValue(new Error("processor timeout"));
    await expect(processExpressRefund(ticket)).rejects.toThrow("timeout");
    expect(mocks.rpc).not.toHaveBeenCalled(); expect(fetchMock).not.toHaveBeenCalled();
  });
  it.each(["pending","failed","requires_action","canceled"])("preserves %s instead of reporting success", async (status) => {
    mocks.createRefund.mockResolvedValue({ ...refund, status });
    expect((await processExpressRefund(ticket)).status).toBe(status);
    expect(mocks.rpc).toHaveBeenCalledWith("save_express_checkout_refund", expect.objectContaining({ p_status: status }));
  });
  it("recovers a lost response without creating another refund", async () => {
    mocks.listRefunds.mockResolvedValue({ has_more: false, data: [refund] });
    await processExpressRefund(ticket); expect(mocks.createRefund).not.toHaveBeenCalled();
  });
  it("never refunds a payment with unrelated refund history or wrong totals", async () => {
    mocks.listRefunds.mockResolvedValue({ has_more: false, data: [{ ...refund, metadata: {} }] });
    await expect(processExpressRefund(ticket)).rejects.toMatchObject({ status: 409 });
    mocks.retrieveSession.mockResolvedValue({ amount_total: 100 });
    await expect(processExpressRefund(ticket)).rejects.toMatchObject({ status: 409 });
    expect(mocks.createRefund).not.toHaveBeenCalled();
  });
  it("retries backend reconciliation using the existing refund ID", async () => {
    fetchMock.mockRejectedValueOnce(new Error("backend offline"));
    await expect(processExpressRefund({ ...ticket, refund_id: "re_test" })).rejects.toThrow("offline");
    await processExpressRefund({ ...ticket, refund_id: "re_test" });
    expect(mocks.createRefund).not.toHaveBeenCalled(); expect(mocks.retrieveRefund).toHaveBeenCalledTimes(2);
  });
  it("makes sandbox cancellation entirely simulated and refuses live refunds there", async () => {
    vi.stubEnv("EXPRESS_SANDBOX", "1");
    await expect(processExpressRefund(ticket)).rejects.toMatchObject({ status: 409 });
    const result = await processExpressRefund({ ...ticket, mode: "express_sandbox" });
    expect(result.refund_id).toBe("sandbox_refund_checkout"); expect(mocks.stripe).not.toHaveBeenCalled();
  });
});


describe("refund recovery queue", () => {
  function queue(rows: RefundTicket[]) {
    const calls: { method: string; args: unknown[] }[] = [];
    mocks.from.mockImplementation(() => {
      const q: Record<string, unknown> = {};
      for (const method of ["select", "eq", "or", "order", "limit", "update"]) q[method] = (...args: unknown[]) => { calls.push({ method, args }); return q; };
      q.then = (resolve: (value: unknown) => unknown) => Promise.resolve({ data: rows, error: null }).then(resolve);
      return q;
    });
    return calls;
  }
  it("does not count a pending or failed processor refund as recovered", async () => {
    const calls = queue([ticket]);
    mocks.createRefund.mockResolvedValue({ ...refund, status: "pending" });
    expect(await reconcileExpressRefunds()).toEqual({ attempted: 1, recovered: 0, pending: 1, failed: 0, hasMore: false });
    expect(calls).toContainEqual({ method: "eq", args: ["mode", "express_stripe"] });
    expect(calls).toContainEqual({ method: "order", args: ["updated_at", { ascending: true }] });
    mocks.createRefund.mockResolvedValue({ ...refund, status: "failed" });
    expect(await reconcileExpressRefunds()).toMatchObject({ recovered: 0, failed: 1 });
  });
  it("records a processor outage and continues the batch", async () => {
    const calls = queue([ticket, ticket]);
    mocks.createRefund.mockRejectedValueOnce(new Error("processor unavailable"));
    expect(await reconcileExpressRefunds()).toMatchObject({ attempted: 2, recovered: 1, failed: 1 });
    expect(calls.some(call => call.method === "update" && (call.args[0] as { last_error?: string }).last_error)).toBe(true);
  });
  it("bounds the batch and keeps sandbox recovery away from Stripe", async () => {
    vi.stubEnv("EXPRESS_SANDBOX", "1");
    const calls = queue(Array.from({ length: 51 }, () => ({ ...ticket, mode: "express_sandbox" })));
    expect(await reconcileExpressRefunds()).toMatchObject({ attempted: 50, recovered: 50, hasMore: true });
    expect(calls).toContainEqual({ method: "eq", args: ["mode", "express_sandbox"] });
    expect(mocks.stripe).not.toHaveBeenCalled();
  });
});
