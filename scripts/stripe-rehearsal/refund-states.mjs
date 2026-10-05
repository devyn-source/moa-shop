// Real Stripe test API only. Does not import shop persistence or fulfillment.
import Stripe from "stripe";
import { mkdirSync, writeFileSync } from "node:fs";
if (process.env.MOA_STRIPE_REHEARSAL !== "1" || !process.env.STRIPE_SECRET_KEY?.startsWith("sk_test_") || !process.env.MOA_REHEARSAL_DIR) throw Error("Explicit test configuration required");
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { timeout: 15000, maxNetworkRetries: 0 });
const output = process.env.MOA_REHEARSAL_DIR;
mkdirSync(output, { recursive: true, mode: 0o700 });
const cases = [{ name: "pending", method: "pm_card_pendingRefund", initial: "pending", final: "succeeded" }, { name: "failure", method: "pm_card_refundFail", initial: "succeeded", final: "failed" }];
const report = { checkedAt: new Date().toISOString(), scope: "Stripe processor API only; no shop database or backend", cases: [] };
const save = () => writeFileSync(`${output}/refund-states.json`, JSON.stringify(report, null, 2), { mode: 0o600 });
for (const scenario of cases) {
 const payment = await stripe.paymentIntents.create({ amount: 1000, currency: "usd", payment_method_types: ["card"], payment_method: scenario.method, confirm: true, metadata: { purpose: `MOA Stage 4 ${scenario.name} refund test` } }, { idempotencyKey: `moa-stage4-${scenario.name}-payment-20261005` });
 if (payment.livemode || payment.status !== "succeeded") throw Error("Expected a successful TEST payment");
 const refund = await stripe.refunds.create({ payment_intent: payment.id, metadata: { purpose: "MOA Stage 4 asynchronous refund test" } }, { idempotencyKey: `moa-stage4-${scenario.name}-refund-20261005` });
 const result = { name: scenario.name, paymentId: payment.id, refundId: refund.id, initial: refund.status, initialPendingReason: refund.pending_reason ?? null, expectedInitial: scenario.initial, final: refund.status, expectedFinal: scenario.final, passed: false };
 report.cases.push(result); save();
 if (refund.status !== scenario.initial) throw Error("Unexpected initial refund state");
 const deadline = Date.now() + 180000;
 while (Date.now() < deadline) {
   const current = await stripe.refunds.retrieve(refund.id);
   result.final = current.status; save();
   if (current.status === scenario.final) break;
   await new Promise(resolve => setTimeout(resolve, 5000));
 }
 result.passed = result.final === scenario.final; save();
 if (!result.passed) throw Error("Refund transition not observed within the rehearsal window");
 console.log(JSON.stringify({ scenario: scenario.name, initial: result.initial, final: result.final, testOnly: true }));
}
