import { getSupabase } from "./supabase";

// Record starts before work. A killed function leaves a visible running record.
// Only fixed summaries are stored, never provider errors, credentials or payloads.
export async function monitoredJob<T>(job: string, work: () => Promise<T>, succeeded: (result: T) => boolean = () => true): Promise<T> {
  const db = getSupabase();
  const { data, error } = await db.from("express_job_runs").insert({ job, scope: process.env.VERCEL_ENV || "development", status: "running" }).select("id").single();
  if (error || !data) throw new Error("Could not record job start");
  try {
    const result = await work();
    const ok = succeeded(result);
    const saved = await db.from("express_job_runs").update({ status: ok ? "succeeded" : "failed", finished_at: new Date().toISOString(), summary: ok ? "Job completed" : "Job requires operator review" }).eq("id", data.id);
    if (saved.error) throw new Error("Could not record job result");
    return result;
  } catch (error) {
    await db.from("express_job_runs").update({ status: "failed", finished_at: new Date().toISOString(), summary: "Job failed; review function logs" }).eq("id", data.id);
    throw error;
  }
}
