import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ email: vi.fn(), ready: vi.fn(), create: vi.fn() }));
vi.mock("@/lib/order-access", () => ({ currentCustomerEmail: mocks.email }));
vi.mock("@/lib/rate-limit", () => ({ rateLimit: async () => true, clientIp: () => "qa" }));
vi.mock("@/lib/store", () => ({ createOrder: mocks.create, getProductById: vi.fn(), setOrderProof: vi.fn(), updateOrderStatus: vi.fn() }));
vi.mock("@/lib/stripe", () => ({ getStripe: vi.fn() }));
vi.mock("@/lib/express-payment", () => ({ assertExpressPaymentReady: mocks.ready, beginExpressPayment: vi.fn() }));
vi.mock("@/lib/express-bridge", () => ({ expressCheckoutEnabled: () => true }));
vi.mock("@/lib/proof", () => ({ generateProof: vi.fn() }));
import { POST } from "@/app/api/checkout/route";
const submit = (email = "owner@example.com") => POST(new Request("https://shop.test/api/checkout", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ipAttested: true, items: [{ productId: "tee" }], contact: { contactName: "QA Owner", contactEmail: email, shipToAddress: { line1: "100 Main", city: "Los Angeles", state: "CA", postalCode: "90012", country: "US" } } }) }));
beforeEach(() => { vi.clearAllMocks(); mocks.email.mockResolvedValue("owner@example.com"); });
describe("checkout account ownership", () => {
  it("requires an account even if middleware is bypassed", async () => {
    mocks.email.mockResolvedValue(null); expect((await submit()).status).toBe(401); expect(mocks.create).not.toHaveBeenCalled(); expect(mocks.ready).not.toHaveBeenCalled();
  });
  it("rejects a different contact email before creating orders or opening payment", async () => {
    expect((await submit("other@example.com")).status).toBe(400); expect(mocks.create).not.toHaveBeenCalled(); expect(mocks.ready).not.toHaveBeenCalled();
  });
});
