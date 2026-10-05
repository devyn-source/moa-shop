"use server";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { isAdminRequest } from "@/lib/admin-auth";
import { getSupabase } from "@/lib/supabase";
import { auth } from "@clerk/nextjs/server";

export async function acknowledgeIncident(form: FormData) {
  const request = new Request("https://shop.magnumopus.agency/admin/operations", { headers: await headers() });
  if (!await isAdminRequest(request)) throw new Error("Admin sign-in required");
  const id = String(form.get("id") || "");
  const owner = String(form.get("owner") || "");
  const action = String(form.get("action") || "").trim();
  const reviewHours = Number(form.get("reviewHours"));
  if (!/^[0-9a-f-]{36}$/i.test(id) || !["Devyn", "Tyler"].includes(owner) || action.length < 5 || action.length > 1000 || ![1,4,24].includes(reviewHours)) throw new Error("Choose an owner, next action and review time");
  const user = await auth().catch(() => ({ userId: null }));
  const { data, error } = await getSupabase().from("express_operation_incidents").update({
    owner, next_action: action, next_review_at: new Date(Date.now() + reviewHours * 3600_000).toISOString(),
    acknowledged_at: new Date().toISOString(), acknowledged_by: user.userId || "admin-basic-auth",
  }).eq("id", id).is("recovered_at", null).select("id");
  if (error || !data?.length) throw new Error("Incident changed or could not be saved. Reload and retry.");
  revalidatePath("/admin/operations");
}
