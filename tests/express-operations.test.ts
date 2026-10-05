import { afterEach, describe, expect, it, vi } from "vitest";
import { configurationChecks, webhookCoverage, REQUIRED_STRIPE_EVENTS } from "@/lib/express-operations-model";
const mocks = vi.hoisted(() => ({ admin: vi.fn(), report: vi.fn() }));
vi.mock("@/lib/admin-auth", () => ({ isAdminRequest: mocks.admin }));
vi.mock("@/lib/express-operations", () => ({ getExpressOperations: mocks.report }));
import { GET } from "@/app/api/admin/express-operations/route";
afterEach(() => vi.clearAllMocks());
describe("operational readiness", () => {
  it("does not mark test auth, preview backend, or missing tax codes ready", () => {
    const checks = configurationChecks({ CLERK_SECRET_KEY: "sk_test_fake", NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: "pk_test_fake", MOAOS_EXPRESS_URL: "https://moa-os-git-express-lane.vercel.app", EXPRESS_SECRET: "secret-never-disclose", STRIPE_TAX_ENABLED: "true" });
    expect(checks.filter(check => check.state === "pass").map(check => check.id)).toEqual(["checkout-intake"]);
    expect(JSON.stringify(checks)).not.toContain("secret-never-disclose");
    expect(checks.find(check => check.id === "tax")?.detail).toContain("headwear");
  });
  it("rejects payment-only, disabled and wrong-destination webhook subscriptions", () => {
    const url = "https://shop.test/api/webhooks/stripe";
    const endpoint = { url, status: "enabled", enabled_events: REQUIRED_STRIPE_EVENTS };
    expect(webhookCoverage([{ ...endpoint, enabled_events: ["checkout.session.completed"] }], url).state).toBe("blocked");
    expect(webhookCoverage([{ ...endpoint, status: "disabled" }], url).state).toBe("blocked");
    expect(webhookCoverage([endpoint], "https://other.test/webhook").state).toBe("blocked");
    expect(webhookCoverage([endpoint], url).state).toBe("pass");
    expect(webhookCoverage([{ ...endpoint, enabled_events: ["*"] }], url).state).toBe("pass");
  });
  it("rejects an unauthenticated monitor before reading operational data", async () => {
    mocks.admin.mockResolvedValue(false);
    const response = await GET(new Request("https://shop.test/api/admin/express-operations"));
    expect(response.status).toBe(401); expect(mocks.report).not.toHaveBeenCalled();
  });
  it("returns non-cacheable failure for unknown checks instead of a green monitor", async () => {
    mocks.admin.mockResolvedValue(true); mocks.report.mockResolvedValue({ checks: [{ state: "unknown" }], incidents: [] });
    const response = await GET(new Request("https://shop.test/api/admin/express-operations"));
    expect(response.status).toBe(503); expect(response.headers.get("Cache-Control")).toContain("no-store");
  });
});
