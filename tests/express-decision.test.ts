import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ user: vi.fn(), post: vi.fn() }));
vi.mock("@clerk/nextjs/server", () => ({ currentUser: mocks.user }));
vi.mock("@/lib/express-account", () => ({ postExpressDecision: mocks.post }));
import { POST } from "@/app/api/express/decision/route";
const body = { number: "EXP-QA", skuId: "tee", round: 2, decision: "approved" };
const submit = (value: unknown = body) => POST(new Request("https://shop.test/api/express/decision", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(value) }));
beforeEach(() => {
  vi.clearAllMocks();
  mocks.user.mockResolvedValue({ primaryEmailAddress: { emailAddress: "owner@example.com" }, firstName: "Order", lastName: "Owner" });
  mocks.post.mockResolvedValue({ ok: true, status: 200 });
});
describe("customer production-proof decisions", () => {
  it("binds approval to the displayed round and the signed-in owner", async () => {
    expect((await submit({ ...body, email: "someone-else@example.com", name: "Imposter" })).status).toBe(200);
    expect(mocks.post).toHaveBeenCalledWith({ ...body, email: "owner@example.com", name: "Order Owner", comment: undefined });
  });
  it("requires sign-in before forwarding any decision", async () => {
    mocks.user.mockResolvedValue(null);
    expect((await submit()).status).toBe(401);
    expect(mocks.post).not.toHaveBeenCalled();
  });
  it.each([undefined, 0, 1.5, "2"])("rejects an absent or invalid proof version: %s", async (round) => {
    expect((await submit({ ...body, round })).status).toBe(409);
    expect(mocks.post).not.toHaveBeenCalled();
  });
  it("preserves a stale-proof conflict for the customer refresh action", async () => {
    mocks.post.mockResolvedValue({ ok: false, status: 409, error: "Review the current version" });
    const response = await submit();
    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ error: "Review the current version" });
  });
  it("returns a retryable response after a network failure", async () => {
    mocks.post.mockRejectedValue(new Error("Network unavailable"));
    const response = await submit();
    expect(response.status).toBe(503);
    expect((await response.json()).error).toContain("try again");
  });
});
