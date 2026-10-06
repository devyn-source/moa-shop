import { beforeEach, afterEach, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  incident: { id: "incident-1", source_key: "drill:stage4", summary: "Stage 4 alert delivery check", opened_at: "2026-10-05T22:00:00Z", recovered_at: null as string | null },
  rows: new Map<string, Record<string, unknown>>(),
  send: vi.fn(), failSave: false,
}));

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
  vi.stubEnv("SLACK_OPERATIONS_BOT_TOKEN", "mock-token");
  vi.stubEnv("SLACK_OPERATIONS_TEAM_ID", "TMOA");
  vi.stubEnv("SLACK_OPERATIONS_BOT_ID", "UBOT");
  vi.stubEnv("SLACK_OPERATIONS_TARGET_ID", "UDEVYN");
  vi.stubEnv("SLACK_OPERATIONS_TARGET_LABEL", "Devyn DM");
  vi.stubGlobal("fetch", vi.fn(async (url: string, init: RequestInit) => {
    if (url.endsWith("auth.test")) return Response.json({ ok: true, team_id: "TMOA", user_id: "UBOT" });
    return state.send(url, init);
  }));
  state.rows.clear(); state.send.mockReset(); state.failSave = false; state.incident.recovered_at = null;
  state.send.mockImplementation(async () => Response.json({ ok: true, channel: "DDM", ts: "123.456" }));
});
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

it("prepares a fixed-recipient sandbox draft without sending", async () => {
  const draft = await prepareAlert("incident-1");
  expect(draft.message.to).toBe("UDEVYN");
  expect(draft.message.text).toContain("[SANDBOX]");
  expect(draft.attachments).toEqual([]);
  expect(state.send).not.toHaveBeenCalled();
});
it("binds approval to workspace, sender, destination and full body", async () => {
  const original = alertMessage(state.incident);
  for (const changed of [{ ...original, workspace: "TOTHER" }, { ...original, from: "UOTHER" }, { ...original, to: "COTHER" }, { ...original, text: "changed" }]) expect(alertHash(changed)).not.toBe(alertHash(original));
  await expect(sendApprovedAlert("incident-1", "stale-approval", "Devyn")).rejects.toThrow("changed");
  expect(state.send).not.toHaveBeenCalled();
});
it("reserves a delivery atomically and suppresses concurrent and repeated sends", async () => {
  const draft = await prepareAlert("incident-1");
  await Promise.allSettled([sendApprovedAlert("incident-1", draft.hash, "Devyn"), sendApprovedAlert("incident-1", draft.hash, "Devyn")]);
  expect(state.send).toHaveBeenCalledTimes(1);
  expect(state.send.mock.calls[0][0]).toBe("https://slack.com/api/chat.postMessage");
  expect(JSON.parse(state.send.mock.calls[0][1].body)).toMatchObject({ channel: "UDEVYN", text: draft.message.text, mrkdwn: false, unfurl_links: false });
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

it("rejects missing destinations, changed recipients and changed bot identity without sending", async () => {
  const draft = await prepareAlert("incident-1");
  vi.stubEnv("SLACK_OPERATIONS_TARGET_ID", "COTHER");
  await expect(sendApprovedAlert("incident-1", draft.hash, "Devyn")).rejects.toThrow("changed");
  vi.stubEnv("SLACK_OPERATIONS_TARGET_ID", "UDEVYN");
  vi.stubGlobal("fetch", vi.fn(async () => Response.json({ ok: true, team_id: "TOTHER", user_id: "UBOT" })));
  await expect(sendApprovedAlert("incident-1", draft.hash, "Devyn")).rejects.toThrow("sender changed");
  vi.stubEnv("SLACK_OPERATIONS_TARGET_ID", "");
  await expect(prepareAlert("incident-1")).rejects.toThrow("not configured");
  expect(state.send).not.toHaveBeenCalled();
});
it("does not fall back to email when Slack rejects the message", async () => {
  const draft = await prepareAlert("incident-1");
  state.send.mockImplementation(async () => Response.json({ ok: false, error: "channel_not_found" }));
  await expect(sendApprovedAlert("incident-1", draft.hash, "Devyn")).rejects.toThrow("uncertain");
  expect(state.rows.get(draft.hash)?.status).toBe("unknown");
});
