import { createHash } from "node:crypto";
import { getSupabase } from "./supabase";

function slackDestination() {
  const workspace = process.env.SLACK_OPERATIONS_TEAM_ID || "";
  const from = process.env.SLACK_OPERATIONS_BOT_ID || "";
  const to = process.env.SLACK_OPERATIONS_TARGET_ID || "";
  const destination = process.env.SLACK_OPERATIONS_TARGET_LABEL || "";
  if (!/^T[A-Z0-9]+$/.test(workspace) || !/^U[A-Z0-9]+$/.test(from) || !/^[CDGU][A-Z0-9]+$/.test(to) || !destination.trim()) throw new Error("Slack alert destination is not configured");
  return { workspace, from, to, destination };
}

export function alertMessage(incident: { id: string; summary: string; opened_at: string; source_key: string }) {
  const sandbox = incident.source_key.startsWith("drill:") || /\(sandbox\)/i.test(incident.summary);
  return {
    provider: "slack" as const,
    ...slackDestination(),
    text: `MOA Catalog operations${sandbox ? " [SANDBOX]" : ""}\n\n${incident.summary}\nRecorded: ${incident.opened_at}\nPrimary: Devyn | Backup: Tyler\n\nReview and record the next action:\nhttps://shop.magnumopus.agency/admin/operations`,
  };
}
export function alertHash(message: ReturnType<typeof alertMessage>) { return createHash("sha256").update(JSON.stringify(message)).digest("hex"); }

export async function prepareAlert(incidentId: string) {
  const db = getSupabase();
  const { data, error } = await db.from("express_operation_incidents").select("id,summary,opened_at,source_key,recovered_at").eq("id", incidentId).single();
  if (error || !data || data.recovered_at) throw new Error("Active incident not found");
  const message = alertMessage(data); const hash = alertHash(message);
  const saved = await db.from("express_alert_deliveries").upsert({ content_hash: hash, incident_id: incidentId, message }, { onConflict: "content_hash", ignoreDuplicates: true });
  if (saved.error) throw new Error("Could not save alert draft");
  const delivery = await db.from("express_alert_deliveries").select("status,provider_id").eq("content_hash", hash).single();
  if (delivery.error) throw new Error("Could not load alert delivery");
  return { message, hash, attachments: [], status: delivery.data.status, providerId: delivery.data.provider_id };
}

export async function sendApprovedAlert(incidentId: string, approvedHash: string, actor: string) {
  if (!process.env.SLACK_OPERATIONS_BOT_TOKEN) throw new Error("Slack alert sender is not configured");
  const draft = await prepareAlert(incidentId);
  if (draft.hash !== approvedHash) throw new Error("Alert changed. Review and approve the final message again.");
  if (draft.status === "sent") return { status: "sent", providerId: draft.providerId, duplicate: true };
  // Bind approval to the actual workspace and bot, not only the destination.
  const identityResponse = await fetch("https://slack.com/api/auth.test", {
    method: "POST", headers: { Authorization: `Bearer ${process.env.SLACK_OPERATIONS_BOT_TOKEN}` },
    signal: AbortSignal.timeout(10000),
  });
  const identity = await identityResponse.json();
  if (!identityResponse.ok || !identity.ok || identity.team_id !== draft.message.workspace || identity.user_id !== draft.message.from) throw new Error("Slack sender changed. Review configuration before sending.");
  const db = getSupabase();
  const reserved = await db.from("express_alert_deliveries").update({ status: "sending", approved_by: actor, updated_at: new Date().toISOString() }).eq("content_hash", approvedHash).eq("status", "draft").select("content_hash");
  if (reserved.error || !reserved.data?.length) throw new Error("Delivery is pending or uncertain. Check the provider before retrying.");
  try {
    const response = await fetch("https://slack.com/api/chat.postMessage", {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.SLACK_OPERATIONS_BOT_TOKEN}`, "Content-Type": "application/json" },
      body: JSON.stringify({ channel: draft.message.to, text: draft.message.text, mrkdwn: false, parse: "none", unfurl_links: false, unfurl_media: false }),
      signal: AbortSignal.timeout(10000),
    });
    const result = await response.json();
    if (!response.ok || !result.ok || !result.ts || !result.channel) throw new Error("Slack did not confirm delivery acceptance");
    const providerId = `${result.channel}:${result.ts}`;
    const saved = await db.from("express_alert_deliveries").update({ status: "sent", provider_id: providerId, updated_at: new Date().toISOString() }).eq("content_hash", approvedHash);
    if (saved.error) throw new Error("Could not save delivery acceptance");
    return { status: "sent", providerId: providerId, duplicate: false };
  } catch {
    await db.from("express_alert_deliveries").update({ status: "unknown", updated_at: new Date().toISOString() }).eq("content_hash", approvedHash);
    throw new Error("Delivery outcome is uncertain. Check the provider; automatic resend is blocked.");
  }
}
