import { afterEach, beforeEach, expect, it, vi } from "vitest";
const rpc = vi.hoisted(() => vi.fn());
vi.mock("@/lib/supabase", () => ({ getSupabase: () => ({ rpc }) }));
import { monitorExpressOrders } from "@/lib/express-order-monitor";
beforeEach(() => { vi.stubEnv("MOAOS_EXPRESS_URL", "https://backend.test"); vi.stubEnv("EXPRESS_SECRET", "test"); rpc.mockResolvedValue({error:null}); });
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); vi.clearAllMocks(); });
it("preserves existing incidents when backend is unavailable", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("{}",{status:503})));
  await expect(monitorExpressOrders()).rejects.toThrow(); expect(rpc).not.toHaveBeenCalled();
});
it("rejects stale snapshots before resolving existing incidents", async () => {
  vi.stubGlobal("fetch",vi.fn().mockResolvedValue(Response.json({checkedAt:"2020-01-01T00:00:00Z",scanned:0,incidents:[]})));
  await expect(monitorExpressOrders()).rejects.toThrow("stale"); expect(rpc).not.toHaveBeenCalled();
});
it("persists a complete validated snapshot in one atomic call", async () => {
  const incidents=[{key:"order:EXP-123:hold",category:"hold",summary:"EXP-123: review hold"}];
  vi.stubGlobal("fetch",vi.fn().mockResolvedValue(Response.json({checkedAt:new Date().toISOString(),scanned:1,incidents})));
  expect(await monitorExpressOrders()).toEqual({scanned:1,open:1});
  expect(rpc).toHaveBeenCalledWith("sync_express_order_incidents",{p_incidents:incidents});
});
