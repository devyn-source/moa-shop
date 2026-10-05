import { createHash } from "node:crypto";
import { Resend } from "resend";
import { getSupabase } from "./supabase";

export function alertMessage(incident: { id: string; summary: string; opened_at: string; source_key: string }) {
  const sandbox = incident.source_key.startsWith("drill:");
  return {
    from: process.env.RESEND_FROM_EMAIL || "Magnum Opus Agency <accounting@magnumopus.agency>",
    to: ["devyn@magnumopus.agency"],
    subject: `${sandbox ? "[SANDBOX] " : ""}MOA operations: ${incident.summary}`,
    text: `Hi Devyn,\n\n${sandbox ? "SANDBOX DELIVERY CHECK. No customer or factory receives this message. No payment or manufacturing has been requested.\n\n" : ""}${incident.summary}\nRecorded: ${incident.opened_at}\nPrimary operator: Devyn\nBackup: Tyler\n\nReview the incident and record the next action:\nhttps://shop.magnumopus.agency/admin/operations\n\nMOA`,
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
  if (!process.env.RESEND_API_KEY) throw new Error("Alert sender is not configured");
  const draft = await prepareAlert(incidentId);
  if (draft.hash !== approvedHash) throw new Error("Alert changed. Review and approve the final message again.");
  if (draft.status === "sent") return { status: "sent", providerId: draft.providerId, duplicate: true };
  const db = getSupabase();
  const reserved = await db.from("express_alert_deliveries").update({ status: "sending", approved_by: actor, updated_at: new Date().toISOString() }).eq("content_hash", approvedHash).eq("status", "draft").select("content_hash");
  if (reserved.error || !reserved.data?.length) throw new Error("Delivery is pending or uncertain. Check the provider before retrying.");
  try {
    const result = await new Resend(process.env.RESEND_API_KEY).emails.send(draft.message, { idempotencyKey: `moa-operations-${approvedHash}` });
    if (result.error || !result.data?.id) throw new Error("Provider did not confirm delivery acceptance");
    const saved = await db.from("express_alert_deliveries").update({ status: "sent", provider_id: result.data.id, updated_at: new Date().toISOString() }).eq("content_hash", approvedHash);
    if (saved.error) throw new Error("Could not save delivery acceptance");
    return { status: "sent", providerId: result.data.id, duplicate: false };
  } catch {
    await db.from("express_alert_deliveries").update({ status: "unknown", updated_at: new Date().toISOString() }).eq("content_hash", approvedHash);
    throw new Error("Delivery outcome is uncertain. Check the provider; automatic resend is blocked.");
  }
}
