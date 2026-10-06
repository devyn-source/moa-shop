import { afterEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ probe: vi.fn() }));
vi.mock("@/lib/supabase", () => ({ getSupabase: () => ({ from: () => ({ select: () => ({ limit: () => ({ abortSignal: mocks.probe }) }) }) }) }));
import { GET } from "@/app/api/health/route";
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); vi.clearAllMocks(); });
function setup(result = { error: null as unknown }) {
  vi.stubEnv("MOAOS_EXPRESS_URL", "https://backend.test"); vi.stubEnv("EXPRESS_SECRET", "private"); vi.stubEnv("EXPRESS_SANDBOX", "1");
  mocks.probe.mockResolvedValue(result);
}
it("reports healthy dependencies without exposing records or secrets", async () => {
  setup(); vi.stubGlobal("fetch", vi.fn().mockImplementation(() => Promise.resolve(Response.json({ status: "ok", ok: true, payBeforeProof: true, mode: "sandbox" }))));
  const r = await GET(); expect(r.status).toBe(200); expect(await r.json()).toEqual({ status: "ok" }); expect(r.headers.get("Cache-Control")).toBe("no-store");
});
it("fails closed on a database error", async () => {
  setup({ error: { message: "private database details" } }); vi.stubGlobal("fetch", vi.fn().mockImplementation(() => Promise.resolve(Response.json({ status: "ok", ok: true, payBeforeProof: true, mode: "sandbox" }))));
  const r = await GET(); expect(r.status).toBe(503); expect(await r.text()).not.toContain("private");
});
it.each(["live", "unknown"])("rejects an unexpected backend mode %s", async mode => {
  setup(); vi.stubGlobal("fetch", vi.fn().mockImplementation(() => Promise.resolve(Response.json({ status: "ok", ok: true, payBeforeProof: true, mode }))));
  expect((await GET()).status).toBe(503);
});
it("reports an unreachable backend as unavailable", async () => {
  setup(); vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("timeout")));
  expect((await GET()).status).toBe(503);
});

it("detects a backend database outage even when the mode probe succeeds", async () => {
  setup(); vi.stubGlobal("fetch", vi.fn().mockImplementation((url: string) => Promise.resolve(url.endsWith("/health") ? Response.json({ status: "unavailable" }, { status: 503 }) : Response.json({ ok: true, payBeforeProof: true, mode: "sandbox" }))));
  expect((await GET()).status).toBe(503);
});
