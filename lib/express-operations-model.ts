export type OperationCheck = { id: string; label: string; state: "pass" | "blocked" | "unknown"; detail: string };
export const REQUIRED_STRIPE_EVENTS = ["checkout.session.completed", "checkout.session.expired", "checkout.session.async_payment_succeeded", "checkout.session.async_payment_failed", "refund.created", "refund.updated", "refund.failed"];
export const EXPRESS_TAX_CATEGORIES = ["tee", "hoodie", "outerwear", "headwear", "bag"];

export function configurationChecks(env: Record<string, string | undefined>): OperationCheck[] {
  const check = (id: string, label: string, pass: boolean, detail: string): OperationCheck => ({ id, label, state: pass ? "pass" : "blocked", detail });
  const missingCodes = EXPRESS_TAX_CATEGORIES.filter(category => !/^txcd_\d{8}$/.test(env[`STRIPE_TAX_CODE_${category.toUpperCase()}`] || ""));
  let backendProduction = false;
  try { const url = new URL(env.MOAOS_EXPRESS_URL || ""); backendProduction = url.protocol === "https:" && !url.hostname.includes("-git-") && !!env.EXPRESS_SECRET; } catch { /* shown as blocked */ }
  return [
    check("checkout-intake", "New checkout intake", env.EXPRESS_CHECKOUT_PAUSED !== "1", env.EXPRESS_CHECKOUT_PAUSED === "1" ? "New orders are paused. Existing paid-event and refund processing is unchanged." : "New checkout intake is not paused. Payment and launch gates still apply."),
    check("customer-auth", "Production customer authentication", !!env.CLERK_SECRET_KEY?.startsWith("sk_live_") && !!env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY?.startsWith("pk_live_"), "Requires production Clerk keys and a separate sign-in and ownership rehearsal."),
    { id: "backend-target", label: "Stable production backend target", state: backendProduction ? "unknown" : "blocked", detail: "Requires a stable HTTPS target and authenticated confirmation of its restricted production deployment." },
    check("tax", "Tax configuration", env.STRIPE_TAX_ENABLED === "true" && !missingCodes.length, missingCodes.length ? `Missing classifications: ${missingCodes.join(", ")}. Finance review and Stripe Tax rehearsal remain required.` : "Codes are configured; this does not certify classifications, registrations, or tax results."),
    check("cron-auth", "Recovery job authorization", !!env.CRON_SECRET, "Secret presence only. Scheduler execution and missed-run monitoring need separate evidence."),
    check("webhook-secret", "Webhook signature configuration", !!env.STRIPE_WEBHOOK_SECRET, "Secret presence only. Signed event delivery must be rehearsed."),
  ];
}

export function webhookCoverage(endpoints: { url: string; status: string; enabled_events: string[] }[], target: string): OperationCheck {
  const active = endpoints.filter(endpoint => endpoint.url === target && endpoint.status === "enabled");
  // Require one endpoint to cover the complete lifecycle, not a union of
  // unrelated or disabled destinations that hides an incomplete subscription.
  const covered = active.some(endpoint => endpoint.enabled_events.includes("*") || REQUIRED_STRIPE_EVENTS.every(event => endpoint.enabled_events.includes(event)));
  return { id: "stripe-events", label: "Stripe lifecycle subscriptions", state: covered ? "pass" : "blocked", detail: covered ? "Configured destination subscribes to payment and refund lifecycle events. Delivery still needs rehearsal." : "No enabled endpoint at the configured webhook URL covers all required payment and refund events." };
}
