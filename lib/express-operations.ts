import { getSupabase } from "./supabase";
import { getStripe } from "./stripe";
import { configurationChecks, webhookCoverage, type OperationCheck } from "./express-operations-model";

export type OperationIncident = { reference: string; mode: string; issue: string; since: string; action: string };
export type OperationsReport = { checkedAt: string; mode: string; checks: OperationCheck[]; incidents: OperationIncident[]; truncated: boolean };
const unavailable = (id: string, label: string, detail: string): OperationCheck => ({ id, label, state: "unknown", detail });

export async function getExpressOperations(): Promise<OperationsReport> {
  const env = process.env;
  const checks = configurationChecks(env);
  const incidents: OperationIncident[] = [];
  let truncated = false;
  const tasks = await Promise.allSettled([
    (async (): Promise<OperationCheck> => {
      const url = env.UPSTASH_REDIS_REST_URL || env.KV_REST_API_URL;
      const token = env.UPSTASH_REDIS_REST_TOKEN || env.KV_REST_API_TOKEN;
      if (!url || !token) return { id: "rate-limit", label: "Shared rate limiter", state: "blocked", detail: "Redis credentials are missing. Rate limiting is disabled." };
      const response = await fetch(`${url.replace(/\/$/, "")}/ping`, { headers: { Authorization: `Bearer ${token}` }, cache: "no-store", signal: AbortSignal.timeout(5000) });
      const data = await response.json();
      return { id: "rate-limit", label: "Shared rate limiter", state: response.ok && data.result === "PONG" ? "pass" : "blocked", detail: response.ok && data.result === "PONG" ? "Shared Redis responded. Limit enforcement still needs a controlled rehearsal." : "Redis did not respond successfully. Current limiter fails open." };
    })(),
    (async (): Promise<OperationCheck> => {
      const base = env.MOAOS_EXPRESS_URL?.replace(/\/$/, "");
      if (!base || !env.EXPRESS_SECRET) return { id: "backend-access", label: "Backend connectivity and mode", state: "blocked", detail: "Express backend configuration is missing." };
      const sandbox = env.EXPRESS_SANDBOX === "1";
      const response = await fetch(`${base}/api/express/engine-order?sandbox=${sandbox ? "1" : "0"}`, { headers: { "x-express-secret": env.EXPRESS_SECRET, ...(env.MOAOS_BYPASS ? { "x-vercel-protection-bypass": env.MOAOS_BYPASS } : {}) }, cache: "no-store", signal: AbortSignal.timeout(5000) });
      const data = await response.json();
      const valid = response.ok && data.payBeforeProof === true && data.mode === (sandbox ? "sandbox" : "live");
      return { id: "backend-access", label: "Backend connectivity and mode", state: valid ? "pass" : "blocked", detail: valid ? "Authenticated readiness probe matches the shop payment mode." : "Backend readiness, authentication, or payment mode does not match." };
    })(),
    (async (): Promise<OperationCheck> => {
      const target = env.STRIPE_WEBHOOK_URL || `${(env.NEXT_PUBLIC_SITE_ORIGIN || "https://shop.magnumopus.agency").replace(/\/$/, "")}/api/webhooks/stripe`;
      const endpoints = await getStripe().webhookEndpoints.list({ limit: 100 }, { timeout: 5000, maxNetworkRetries: 0 });
      if (endpoints.has_more) return unavailable("stripe-events", "Stripe lifecycle subscriptions", "Endpoint list exceeds the audit limit. Review subscriptions in Stripe.");
      return webhookCoverage(endpoints.data, target);
    })(),
    (async (): Promise<OperationCheck> => {
      const db = getSupabase();
      const [refunds, handoffs] = await Promise.all([
        db.from("express_checkout_refunds").select("order_number,mode,status,backend_synced_at,last_error,created_at")
          .or("status.neq.succeeded,backend_synced_at.is.null,last_error.not.is.null").order("created_at").limit(101).abortSignal(AbortSignal.timeout(5000)),
        db.from("orders").select("order_number,created_at,checkout_mode:data->>checkoutMode")
          .eq("data->fulfillment->>mode", "express").in("data->>paymentStatus", ["paid", "simulated_paid"])
          .is("data->fulfillment->>catalogOrderId", null).order("created_at").limit(101).abortSignal(AbortSignal.timeout(5000)),
      ]);
      if (refunds.error || handoffs.error) throw new Error("Operational queues unavailable");
      truncated = (refunds.data?.length ?? 0) > 100 || (handoffs.data?.length ?? 0) > 100;
      for (const row of (refunds.data || []).slice(0, 100)) incidents.push({ reference: row.order_number, mode: row.mode, issue: row.last_error ? "Refund recovery needs review" : `Refund ${row.status}${row.backend_synced_at ? "" : "; backend update pending"}`, since: row.created_at, action: "Verify the existing Stripe refund and backend cancellation before retrying. Never create a second refund manually." });
      for (const row of (handoffs.data || []).slice(0, 100)) incidents.push({ reference: row.order_number, mode: row.checkout_mode, issue: "Paid order has no backend handoff", since: row.created_at, action: "Check Stripe event delivery and replay the original paid event after restoring backend access. Do not charge again." });
      return { id: "queues", label: "Payment and refund exception queues", state: incidents.length || truncated ? "blocked" : "pass", detail: truncated ? "More than 100 records in at least one queue. Resolve oldest items and reload; this view is incomplete." : incidents.length ? `${incidents.length} records need review; sandbox records are labelled separately.` : "No unresolved refunds or paid orders missing a backend reference at this check." };
    })(),
  ]);
  const failures = [
    ["rate-limit", "Shared rate limiter", "Redis probe failed. Current limiter allows requests through when Redis is unavailable."],
    ["backend-access", "Backend connectivity and mode", "Readiness probe failed. Verify the Express deployment, credentials, and mode."],
    ["stripe-events", "Stripe lifecycle subscriptions", "Could not inspect Stripe subscriptions. Verify credentials and service availability."],
    ["queues", "Payment and refund exception queues", "Could not read exception queues. An unavailable queue must not be treated as empty."],
  ];
  tasks.forEach((task, i) => checks.push(task.status === "fulfilled" ? task.value : unavailable(failures[i][0], failures[i][1], failures[i][2])));
  return { checkedAt: new Date().toISOString(), mode: env.EXPRESS_SANDBOX === "1" ? "Sandbox simulation" : "Stripe payments", checks, incidents, truncated };
}
