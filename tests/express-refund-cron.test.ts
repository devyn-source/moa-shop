import { afterEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ reconcile: vi.fn() }));
vi.mock("@/lib/express-refunds", () => ({ reconcileExpressRefunds: mocks.reconcile }));
import { GET } from "@/app/api/cron/express-refunds/route";
afterEach(() => { vi.clearAllMocks(); vi.unstubAllEnvs(); });
it("rejects missing cron authorization before attempting refunds", async () => {
  vi.stubEnv("CRON_SECRET", "test-secret");
  expect((await GET(new Request("https://shop.test/cron"))).status).toBe(401);
  expect(mocks.reconcile).not.toHaveBeenCalled();
});
it("surfaces a failed item as a failing job while preserving batch counts", async () => {
  vi.stubEnv("CRON_SECRET", "test-secret");
  const result = { attempted: 3, recovered: 1, pending: 1, failed: 1, hasMore: false };
  mocks.reconcile.mockResolvedValue(result);
  const response = await GET(new Request("https://shop.test/cron", { headers: { authorization: "Bearer test-secret" } }));
  expect(response.status).toBe(503); expect(await response.json()).toEqual(result);
});
it("reports pending processor results honestly without declaring a job failure", async () => {
  vi.stubEnv("CRON_SECRET", "test-secret");
  mocks.reconcile.mockResolvedValue({ attempted: 1, recovered: 0, pending: 1, failed: 0, hasMore: false });
  const response = await GET(new Request("https://shop.test/cron", { headers: { authorization: "Bearer test-secret" } }));
  expect(response.status).toBe(200); expect((await response.json()).recovered).toBe(0);
});
