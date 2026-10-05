// Opt-in processor rehearsal. Real Stripe TEST API; memory-only shop storage
// and a simulated backend. This is not a deployed end-to-end acceptance test.
import { test, expect, vi } from "vitest";
import { createServer } from "node:http";
import { spawn } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import Stripe from "stripe";
import type { ShopOrder } from "../../lib/types";
import type { RefundTicket } from "../../lib/express-refunds";

const state = vi.hoisted(() => ({ orders: [] as ShopOrder[], ticket: null as RefundTicket | null, backendOffline: true, refundBackendOffline: false, handoffs: 0, refundSyncs: 0, cancelled: false, savedEvents: [] as { id: string; type: string; status: number }[] }));
vi.mock("@/lib/store", () => ({
  getCheckoutOrders: async (id: string) => structuredClone(state.orders.filter(o => o.checkoutId === id)),
  getProductById: async () => ({ category: "tee" }),
  setOrderCheckout: async (id: string, patch: object) => { Object.assign(state.orders.find(o => o.id === id)!, patch); },
  setOrderFulfillment: async (id: string, patch: object) => { const o = state.orders.find(o => o.id === id)!; o.fulfillment = { mode: "express", ...o.fulfillment, ...patch }; },
  markOrderPaid: async (id: string, session: string) => { const o = state.orders.find(o => o.id === id)!; o.paymentStatus = "paid"; o.stripeSessionId = session; },
  setOrderTax: async (o: ShopOrder, session: string, subtotal: number, tax: number) => { Object.assign(state.orders.find(row => row.id === o.id)!, { taxUsd: tax / 100, totalUsd: (subtotal + tax) / 100, taxCalculation: { source: "stripe_checkout", sessionId: session, subtotalCents: subtotal, taxCents: tax, totalCents: subtotal + tax } }); },
  getOrderById: async (id: string) => structuredClone(state.orders.find(o => o.id === id)),
  updateOrderStatus: async (id: string, status: string) => { Object.assign(state.orders.find(o => o.id === id)!, { status }); },
  setOrderProof: () => { throw Error("Proof generation prohibited in rehearsal"); },
}));
vi.mock("@/lib/express-bridge", () => ({ pushExpressOrder: async () => {
  if (state.backendOffline) return { ok: false, error: "Injected backend outage" };
  state.handoffs++; return { ok: true, orderNumber: "EXP-STAGE4-LOCAL" };
} }));
vi.mock("@/lib/supabase", () => ({ getSupabase: () => ({
  rpc: async (_name: string, p: Record<string, unknown>) => {
    state.ticket = { checkout_id: String(p.p_checkout_id), order_number: String(p.p_order_number), payment_id: String(p.p_payment_id), mode: p.p_mode as RefundTicket["mode"], amount_cents: Number(p.p_amount_cents), status: p.p_status as RefundTicket["status"], refund_id: p.p_refund_id as string | null, backend_synced_at: null };
    for (const o of state.orders) Object.assign(o, { status: "cancelled", refundStatus: state.ticket.status, refundId: state.ticket.refund_id, paymentStatus: state.ticket.status === "succeeded" ? "refunded" : "paid" });
    return { data: structuredClone(state.ticket), error: null };
  },
  from: (table: string) => {
    let patch: Record<string, unknown> | null = null, single = false;
    const q: Record<string, unknown> = {};
    for (const name of ["select", "eq", "or", "order", "limit"]) q[name] = () => q;
    q.maybeSingle = () => { single = true; return q; };
    q.update = (value: Record<string, unknown>) => { patch = value; return q; };
    q.then = (resolve: (value: unknown) => unknown) => {
      if (patch && state.ticket) Object.assign(state.ticket, patch);
      const data = table === "orders" ? state.orders.map(data => ({ data: structuredClone(data) })) : single ? structuredClone(state.ticket) : state.ticket ? [structuredClone(state.ticket)] : [];
      return Promise.resolve({ data, error: null }).then(resolve);
    };
    return q;
  },
}) }));
vi.mock("@/lib/email", () => ({ sendOrderConfirmation: () => { throw Error("Email prohibited"); }, sendProofApproval: () => { throw Error("Email prohibited"); }, sendPaymentIncomplete: () => { throw Error("Email prohibited"); } }));
vi.mock("@/lib/proof", () => ({ generateProof: () => { throw Error("Proof prohibited"); } }));
vi.mock("@/lib/catalog-fulfillment", () => ({ pushOrderToMoaOS: () => { throw Error("Factory handoff prohibited"); } }));
vi.mock("@/lib/analytics-server", () => ({ trackServer: () => { throw Error("Analytics prohibited"); } }));
vi.mock("@/lib/order-access", () => ({ ownsOrder: (order: ShopOrder, email: string) => order.contactEmail === email }));

import { beginExpressPayment, handleExpressStripeSession } from "../../lib/express-payment";
import { cancelExpressCheckout, processExpressRefund, reconcileExpressRefunds } from "../../lib/express-refunds";
import { POST as webhook } from "../../app/api/webhooks/stripe/route";

const pause = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
test("Stripe test checkout, tax, replay, backend outage and refund recovery", async () => {
  if (process.env.MOA_STRIPE_REHEARSAL !== "1" || !process.env.STRIPE_SECRET_KEY?.startsWith("sk_test_") || !process.env.STRIPE_CLI || !process.env.MOA_REHEARSAL_DIR) throw Error("Explicit rehearsal flag, test key, CLI and private output directory required");
  if (process.env.SUPABASE_URL || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.RESEND_API_KEY || process.env.MOAOS_EXPRESS_URL) throw Error("Refusing mixed production configuration");
  const output = process.env.MOA_REHEARSAL_DIR;
  mkdirSync(output, { recursive: true, mode: 0o700 });
  const save = (file: string, value: unknown) => writeFileSync(`${output}/${file}`, JSON.stringify(value, null, 2), { mode: 0o600 });
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { timeout: 15000, maxNetworkRetries: 0 });
  vi.stubEnv("EXPRESS_SANDBOX", "0"); vi.stubEnv("EXPRESS_CHECKOUT_PAUSED", "0"); vi.stubEnv("STRIPE_TAX_ENABLED", "true"); vi.stubEnv("STRIPE_TAX_CODE_TEE", "txcd_30011000"); vi.stubEnv("EXPRESS_SECRET", randomUUID()); vi.stubEnv("MOAOS_EXPRESS_URL", "https://stage4-backend.invalid");
  const actualFetch = globalThis.fetch;
  vi.stubGlobal("fetch", async (input: string | URL | Request, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    if (url.startsWith("https://stage4-backend.invalid/")) {
      if (url.endsWith("/cancel")) { state.cancelled = true; return Response.json({ ok: true }); }
      if (url.endsWith("/refund")) { if (state.refundBackendOffline) throw Error("Injected refund backend outage"); state.refundSyncs++; return Response.json({ ok: true }); }
      throw Error("Unexpected rehearsal backend path");
    }
    throw Error("Fetch outside isolated backend is prohibited; Stripe uses its own SDK transport");
  });
  const checkoutId = randomUUID();
  state.orders = [2000.01, 850].map((totalUsd, index) => ({ id: index ? randomUUID() : checkoutId, orderNumber: `STAGE4-${index + 1}`, checkoutId, productId: "synthetic-tee", quantity: index ? 25 : 50, totalUsd, taxUsd: 0, contactEmail: "stage4@example.invalid", contactName: "Stage 4 Test", companyName: "Synthetic rehearsal", paymentStatus: "unpaid", status: "awaiting_payment", shipToName: "Test only", shipToAddress: { line1: "510 Townsend St", city: "San Francisco", state: "CA", postalCode: "94103", country: "US" }, fulfillment: { mode: "express" } }) as ShopOrder);
  let hostedCheckoutUrl: string | null = null;
  const server = createServer(async (req, res) => {
    if (req.url === "/checkout") {
      if (!hostedCheckoutUrl) { res.writeHead(503).end("Test checkout is starting. Reload shortly."); return; }
      res.writeHead(302, { Location: hostedCheckoutUrl, "Cache-Control": "no-store" }).end(); return;
    }
    if (req.url === "/webhook" && req.method === "POST") {
      const chunks: Buffer[] = []; let size = 0;
      for await (const chunk of req) { size += chunk.length; if (size > 1_000_000) { res.writeHead(413).end(); return; } chunks.push(Buffer.from(chunk)); }
      const raw = Buffer.concat(chunks).toString();
      try {
        const event = JSON.parse(raw);
        if (event.data?.object?.metadata?.expressCheckoutId !== checkoutId) { res.writeHead(200).end("unrelated test event ignored"); return; }
        const response = await webhook(new Request("http://127.0.0.1:3054/webhook", { method: "POST", body: raw, headers: { "stripe-signature": String(req.headers["stripe-signature"] || "") } }));
        state.savedEvents.push({ id: event.id, type: event.type, status: response.status });
        res.writeHead(response.status).end(await response.text());
      } catch { res.writeHead(500).end("rehearsal handler error"); }
    } else { res.writeHead(200, { "Content-Type": "text/plain", "Cache-Control": "no-store" }).end("MOA Stage 4 Stripe test rehearsal. No real payment or manufacturing."); }
  });
  await new Promise<void>((resolve, reject) => { server.once("error", reject); server.listen(3054, "127.0.0.1", resolve); });
  const listener = spawn(process.env.STRIPE_CLI, ["listen", "--forward-to", "http://127.0.0.1:3054/webhook", "--events", "checkout.session.completed,checkout.session.expired,checkout.session.async_payment_succeeded,checkout.session.async_payment_failed,refund.created,refund.updated,refund.failed"], { env: { ...process.env, STRIPE_API_KEY: process.env.STRIPE_SECRET_KEY }, stdio: ["ignore", "pipe", "pipe"] });
  let listenerText = "";
  const capture = (data: Buffer) => { listenerText += data.toString(); const secret = listenerText.match(/whsec_[A-Za-z0-9]+/); if (secret) process.env.STRIPE_WEBHOOK_SECRET = secret[0]; };
  listener.stdout.on("data", capture); listener.stderr.on("data", capture);
  try {
    for (let i = 0; i < 100 && !process.env.STRIPE_WEBHOOK_SECRET; i++) await pause(200);
    if (!process.env.STRIPE_WEBHOOK_SECRET) throw Error("Stripe listener did not become ready");
    const checkoutUrl = await beginExpressPayment(structuredClone(state.orders), "http://127.0.0.1:3054");
    hostedCheckoutUrl = checkoutUrl;
    const sessionId = state.orders[0].stripeSessionId!;
    let session = await stripe.checkout.sessions.retrieve(sessionId);
    expect(session.livemode).toBe(false); expect(session.amount_subtotal).toBe(285001); expect(session.total_details!.amount_tax).toBeGreaterThan(0);
    save("checkout.json", { url: checkoutUrl, sessionId, checkoutId, amountSubtotal: session.amount_subtotal, amountTax: session.total_details!.amount_tax, amountTotal: session.amount_total, testOnly: true });
    console.log("Test checkout ready. Private checkout.json contains the hosted payment URL.");
    const expiry = Date.now() + 45 * 60_000;
    while (session.payment_status !== "paid" && Date.now() < expiry) { await pause(3000); session = await stripe.checkout.sessions.retrieve(sessionId); }
    expect(session.payment_status, "Complete the hosted checkout with a Stripe test card").toBe("paid");
    for (let i = 0; i < 50 && !state.savedEvents.some(e => e.type === "checkout.session.completed"); i++) await pause(200);
    expect(state.savedEvents.some(e => e.type === "checkout.session.completed" && e.status === 500)).toBe(true);
    expect(state.orders.every(o => o.paymentStatus === "paid")).toBe(true);
    expect(state.handoffs).toBe(0);
    state.backendOffline = false;
    // Replay the canonical processor session through the same application code.
    await handleExpressStripeSession(await stripe.checkout.sessions.retrieve(sessionId));
    await handleExpressStripeSession(await stripe.checkout.sessions.retrieve(sessionId));
    expect(state.handoffs).toBe(1);
    const total = state.orders.reduce((sum, order) => sum + Math.round(order.totalUsd * 100), 0);
    expect(total).toBe(session.amount_total);
    const pi = String(session.payment_intent);
    await expect(cancelExpressCheckout("EXP-STAGE4-LOCAL", "other@example.invalid")).rejects.toMatchObject({ status: 404 });
    state.refundBackendOffline = true;
    await expect(cancelExpressCheckout("EXP-STAGE4-LOCAL", "stage4@example.invalid")).rejects.toThrow("Injected refund backend outage");
    expect(state.cancelled).toBe(true); expect(state.ticket!.status).toBe("succeeded"); expect(state.ticket!.refund_id).toBeTruthy();
    state.refundBackendOffline = false;
    const recovery = await reconcileExpressRefunds(); expect(recovery.failed).toBe(0); expect(state.ticket!.backend_synced_at).toBeTruthy();
    // Remove the LOCAL response reference only to simulate a lost response.
    // Stripe's existing refund remains the source of truth.
    await processExpressRefund({ ...state.ticket!, status: "requested", refund_id: null });
    const refunds = await stripe.refunds.list({ payment_intent: pi });
    expect(refunds.data).toHaveLength(1); expect(refunds.data[0].amount).toBe(session.amount_total);
    const forged = await webhook(new Request("http://127.0.0.1:3054/webhook", { method: "POST", body: "{}", headers: { "stripe-signature": "forged" } })); expect(forged.status).toBe(400);
    const decline = await stripe.paymentIntents.create({ amount: 1000, currency: "usd", payment_method: "pm_card_visa_chargeDeclined", payment_method_types: ["card"], confirm: true, metadata: { purpose: "MOA Stage 4 isolated decline fixture" } }).then(() => ({ unexpected: true }), (error: { code?: string; payment_intent?: Stripe.PaymentIntent }) => ({ code: error.code, status: error.payment_intent?.status, livemode: error.payment_intent?.livemode }));
    expect(decline).toMatchObject({ code: "card_declined", status: "requires_payment_method", livemode: false });
    await pause(1000);
    const report = { checkedAt: new Date().toISOString(), scope: "Real Stripe test API and signed CLI delivery; in-memory shop persistence; simulated backend; no customer/factory messages", sessionId, checkoutId, paymentIntent: pi, refundId: refunds.data[0].id, subtotal: session.amount_subtotal, tax: session.total_details!.amount_tax, total: session.amount_total, refundAmount: refunds.data[0].amount, checks: { paidWebhookDuringBackendOutage: true, retryHandoff: true, duplicateHandoffSuppressed: true, taxCentsPreserved: true, wrongOwnerRejected: true, backendRefundOutageRecovered: true, lostRefundResponseRecovered: true, singleRefund: true, forgedSignatureRejected: true, processorDecline: true }, webhookDeliveries: state.savedEvents };
    save("result.json", report);
  } finally {
    listener.kill("SIGTERM"); server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve()));
    vi.unstubAllGlobals(); vi.unstubAllEnvs(); globalThis.fetch = actualFetch;
  }
});
