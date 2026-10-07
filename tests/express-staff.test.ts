import { afterEach, beforeEach, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({ user: "staff", email: "devyn@magnumopus.agency" as string | null, admin: true, fetch: vi.fn() }));
vi.mock("@clerk/nextjs/server", () => ({ auth: async () => ({ userId: state.user }) }));
vi.mock("@/lib/admin-auth", () => ({ isAdminRequest: async () => state.admin, clerkEmail: async () => state.email, emailIsAdmin: (email: string) => email === "devyn@magnumopus.agency" }));
import { GET, POST } from "@/app/api/admin/express-staff/route";
const request = (body: unknown = { kind: "fulfillment", number: "EXP-1011" }, origin = "https://shop.magnumopus.agency") => new Request("https://shop.magnumopus.agency/api/admin/express-staff", { method: "POST", headers: { "content-type": "application/json", origin, "x-express-operator": "forged@example.com" }, body: JSON.stringify(body) });
beforeEach(() => {
  state.user = "staff"; state.email = "devyn@magnumopus.agency"; state.admin = true;
  state.fetch.mockReset().mockResolvedValue(Response.json({ order: { number: "EXP-1011" } }));
  vi.stubGlobal("fetch", state.fetch); vi.stubEnv("EXPRESS_SANDBOX", "1"); vi.stubEnv("MOAOS_EXPRESS_URL", "https://moa-shop-express-service.vercel.app"); vi.stubEnv("EXPRESS_SECRET", "test-secret");
});
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });
it("blocks unauthorized reads before reaching the backend", async () => { state.admin = false; expect((await GET(new Request("https://shop.magnumopus.agency/api/admin/express-staff"))).status).toBe(401); expect(state.fetch).not.toHaveBeenCalled(); });
it.each([["", "devyn@magnumopus.agency", 401], ["user", null, 403], ["user", "customer@example.com", 403]])("blocks unnamed, unverified and customer mutations", async (user, email, status) => { state.user = user as string; state.email = email as string | null; expect((await POST(request())).status).toBe(status); expect(state.fetch).not.toHaveBeenCalled(); });
it.each(["https://attacker.example", "null", ""])("rejects cross-origin writes: %s", async origin => { expect((await POST(request(undefined, origin))).status).toBe(403); expect(state.fetch).not.toHaveBeenCalled(); });
it("binds actor to Clerk and never forwards the browser's actor header", async () => { const response = await POST(request()); expect(response.status).toBe(200); expect(response.headers.get("cache-control")).toBe("private, no-store"); expect(state.fetch.mock.calls[0][1].headers["x-express-operator"]).toBe("devyn@magnumopus.agency"); expect(state.fetch.mock.calls[0][1].redirect).toBe("error"); });
it.each(["sendPreview", "refund", "release"])("does not proxy action %s", async kind => { expect((await POST(request({ kind, number: "EXP-1011" }))).status).toBe(400); expect(state.fetch).not.toHaveBeenCalled(); });
it("fails closed outside sandbox or at an unexpected backend", async () => { vi.stubEnv("EXPRESS_SANDBOX", "0"); expect((await POST(request())).status).toBe(503); vi.stubEnv("EXPRESS_SANDBOX", "1"); vi.stubEnv("MOAOS_EXPRESS_URL", "https://example.com"); expect((await POST(request())).status).toBe(503); expect(state.fetch).not.toHaveBeenCalled(); });
it("reports uncertain writes without automatically retrying", async () => { state.fetch.mockRejectedValue(new Error("timeout")); const result = await POST(request()); expect(result.status).toBe(503); expect((await result.json()).error).toMatch(/Reload/); expect(state.fetch).toHaveBeenCalledTimes(1); });
