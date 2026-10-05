import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ start: vi.fn(), finish: vi.fn(), insert: vi.fn(), update: vi.fn() }));
vi.mock("@/lib/supabase", () => ({ getSupabase: () => ({ from: () => ({ insert: mocks.insert, update: mocks.update }) }) }));
import { monitoredJob } from "@/lib/job-monitor";
beforeEach(() => {
  vi.clearAllMocks();
  mocks.insert.mockReturnValue({ select: () => ({ single: mocks.start }) });
  mocks.update.mockReturnValue({ eq: mocks.finish });
  mocks.start.mockResolvedValue({ data: { id: "run-1" }, error: null });
  mocks.finish.mockResolvedValue({ error: null });
});
it("does no work when durable start recording fails", async () => {
  mocks.start.mockResolvedValue({ error: {} });
  const work = vi.fn();
  await expect(monitoredJob("refunds", work)).rejects.toThrow("start");
  expect(work).not.toHaveBeenCalled();
});
it("records partial batch failures without storing provider details", async () => {
  await monitoredJob("refunds", async () => ({ failed: 1 }), r => !r.failed);
  expect(mocks.update).toHaveBeenCalledWith(expect.objectContaining({ status: "failed" }));
});
it("records a thrown failure and preserves its error without persisting its payload", async () => {
  await expect(monitoredJob("refunds", async () => { throw new Error("private-provider-payload"); })).rejects.toThrow("private-provider-payload");
  expect(mocks.update).toHaveBeenCalledWith(expect.objectContaining({ status: "failed" }));
  expect(JSON.stringify(mocks.update.mock.calls)).not.toContain("private-provider-payload");
});
it("does not claim successful monitoring when result persistence fails", async () => {
  mocks.finish.mockResolvedValue({ error: {} });
  await expect(monitoredJob("refunds", async () => ({}))).rejects.toThrow("result");
});
