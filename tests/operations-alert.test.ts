import { beforeEach, afterEach, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  incident: { id: "incident-1", source_key: "drill:stage4", summary: "Stage 4 alert delivery check", opened_at: "2026-10-05T22:00:00Z", recovered_at: null as string | null },
  rows: new Map<string, Record<string, unknown>>(),
  send: vi.fn(), failSave: false,
}));
vi.mock("resend", () => ({ Resend: class { emails = { send: state.send }; } }));
vi.mock("@/lib/supabase", () => ({ getSupabase: () => ({ from: (table: string) => {
  const filters: Record<string, unknown> = {};
  let patch: Record<string, unknown> | undefined;
  const execute = () => {
    if (patch?.status === "sent" && state.failSave) return { data: null, error: {} };
    const rows = [...state.rows.values()].filter(row => Object.entries(filters).every(([key, value]) => row[key] === value));
    if (patch) rows.forEach(row => Object.assign(row, patch));
    return { data: rows, error: null };
  };
  const query = {
    eq(key: string, value: unknown) { filters[key] = value; return query; },
    select() { return query; },
    update(value: Record<string, unknown>) { patch = value; return query; },
    async upsert(row: Record<string, unknown>) {
      if (!state.rows.has(row.content_hash as string)) state.rows.set(row.content_hash as string, { ...row, status: "draft", provider_id: null });
      return { error: null };
    },
    async single() { return { data: table === "express_operation_incidents" ? state.incident : execute().data?.[0], error: null }; },
    then(resolve: (value: ReturnType<typeof execute>) => unknown) { return Promise.resolve(execute()).then(resolve); },
  };
  return query;
} }) }));
import { alertHash, alertMessage, prepareAlert, sendApprovedAlert } from "@/lib/operations-alert";

beforeEach(() => {
  vi.stubEnv("RESEND_API_KEY", "test-only-mock");
  vi.stubEnv("RESEND_FROM_EMAIL", "MOA Catalog <production@magnumopus.agency>");
  state.rows.clear(); state.send.mockReset(); state.failSave = false; state.incident.recovered_at = null;
  state.send.mockResolvedValue({ data: { id: "provider-1" }, error: null });
});
afterEach(() => vi.unstubAllEnvs());

it("prepares a fixed-recipient sandbox draft without sending", async () => {
  const draft = await prepareAlert("incident-1");
  expect(draft.message.to).toEqual(["devyn@magnumopus.agency"]);
  expect(draft.message.subject).toMatch(/^\[SANDBOX\]/);
  expect(draft.attachments).toEqual([]);
  expect(state.send).not.toHaveBeenCalled();
});
it("binds approval to sender, recipients, subject and full body", async () => {
  const original = alertMessage(state.incident);
  for (const changed of [{ ...original, from: "changed@example.com" }, { ...original, to: ["changed@example.com"] }, { ...original, subject: "changed" }, { ...original, text: "changed" }]) expect(alertHash(changed)).not.toBe(alertHash(original));
  await expect(sendApprovedAlert("incident-1", "stale-approval", "Devyn")).rejects.toThrow("changed");
  expect(state.send).not.toHaveBeenCalled();
});
it("reserves a delivery atomically and suppresses concurrent and repeated sends", async () => {
  const draft = await prepareAlert("incident-1");
  await Promise.allSettled([sendApprovedAlert("incident-1", draft.hash, "Devyn"), sendApprovedAlert("incident-1", draft.hash, "Devyn")]);
  expect(state.send).toHaveBeenCalledTimes(1);
  expect(state.send).toHaveBeenCalledWith(draft.message, { idempotencyKey: `moa-operations-${draft.hash}` });
  expect(await sendApprovedAlert("incident-1", draft.hash, "Devyn")).toMatchObject({ duplicate: true });
  expect(state.send).toHaveBeenCalledTimes(1);
});
it.each(["provider", "persistence"])("blocks retries after uncertain %s outcome", async failure => {
  const draft = await prepareAlert("incident-1");
  if (failure === "provider") state.send.mockRejectedValue(new Error("timeout"));
  else state.failSave = true;
  await expect(sendApprovedAlert("incident-1", draft.hash, "Devyn")).rejects.toThrow("uncertain");
  expect(state.rows.get(draft.hash)?.status).toBe("unknown");
  await expect(sendApprovedAlert("incident-1", draft.hash, "Devyn")).rejects.toThrow("pending or uncertain");
  expect(state.send).toHaveBeenCalledTimes(1);
});
it("refuses to send an incident that recovered after review", async () => {
  const draft = await prepareAlert("incident-1");
  state.incident.recovered_at = "2026-10-05T22:01:00Z";
  await expect(sendApprovedAlert("incident-1", draft.hash, "Devyn")).rejects.toThrow("Active incident");
  expect(state.send).not.toHaveBeenCalled();
});
