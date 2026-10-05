export type ExpressCheckoutMode = "express_sandbox" | "express_stripe" | "express_stripe_test";
export function stripeTestMode() { return process.env.EXPRESS_STRIPE_TEST === "1"; }
export function backendSandbox() { return process.env.EXPRESS_SANDBOX === "1" || stripeTestMode(); }
export function activeCheckoutMode(): ExpressCheckoutMode {
  if (stripeTestMode()) {
    if (process.env.EXPRESS_SANDBOX === "1" || process.env.VERCEL_ENV === "production" || !process.env.STRIPE_SECRET_KEY?.startsWith("sk_test_")) throw new Error("Stripe rehearsal requires a preview deployment and test credentials");
    return "express_stripe_test";
  }
  return process.env.EXPRESS_SANDBOX === "1" ? "express_sandbox" : "express_stripe";
}
export function assertRehearsalCustomer(email: string) {
  if (!stripeTestMode()) return;
  activeCheckoutMode();
  const allowed = (process.env.EXPRESS_TEST_CUSTOMERS || "devyn@magnumopus.agency,tyler@magnumopus.agency").split(",").map(s => s.trim().toLowerCase());
  if (!allowed.includes(email.toLowerCase())) throw new Error("This rehearsal is restricted to the assigned test accounts");
}
