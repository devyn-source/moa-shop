import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ admin: vi.fn(), basic: vi.fn(), email: vi.fn(), auth: vi.fn(), prepare: vi.fn(), send: vi.fn() }));
vi.mock("@/lib/admin-auth", () => ({ isAdminRequest: mocks.admin, basicAuthValid: mocks.basic, clerkEmail: mocks.email }));
vi.mock("@clerk/nextjs/server", () => ({ auth: mocks.auth }));
vi.mock("@/lib/operations-alert", () => ({ prepareAlert: mocks.prepare, sendApprovedAlert: mocks.send }));
import { GET, POST } from "@/app/api/admin/operations-alert/route";
const incidentId = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";
function request(headers: Record<string, string> = {}) { return new Request("https://shop.magnumopus.agency/api/admin/operations-alert", { method: "POST", headers: { "Content-Type": "application/json", ...headers }, body: JSON.stringify({ incidentId, approvedHash: "a".repeat(64) }) }); }
beforeEach(() => { vi.resetAllMocks(); mocks.admin.mockResolvedValue(true); mocks.basic.mockReturnValue(false); mocks.auth.mockResolvedValue({ userId: "user-1" }); mocks.email.mockResolvedValue("devyn@magnumopus.agency"); mocks.send.mockResolvedValue({ status: "sent" }); });
it("rejects unauthorized reads and sends before touching incident data", async () => {
  mocks.admin.mockResolvedValue(false);
  expect((await GET(new Request(`https://shop.magnumopus.agency/api/admin/operations-alert?incident=${incidentId}`))).status).toBe(401);
  expect((await POST(request())).status).toBe(401);
  expect(mocks.prepare).not.toHaveBeenCalled(); expect(mocks.send).not.toHaveBeenCalled();
});
it("allows staff review but requires Devyn for sending", async () => {
  mocks.email.mockResolvedValue("tyler@magnumopus.agency");
  expect((await POST(request())).status).toBe(403); expect(mocks.send).not.toHaveBeenCalled();
});
it("rejects cross-origin and simple-form submissions", async () => {
  expect((await POST(request({ Origin: "https://unrelated.example" }))).status).toBe(403);
  expect((await POST(request({ "Content-Type": "text/plain" }))).status).toBe(415);
  expect(mocks.send).not.toHaveBeenCalled();
});
it("passes only the reviewed identity and hash to the sender", async () => {
  expect((await POST(request())).status).toBe(200);
  expect(mocks.send).toHaveBeenCalledWith(incidentId, "a".repeat(64), "user-1");
});
