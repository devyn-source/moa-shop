import { getSupabase } from "./supabase";

export async function serviceAvailable(): Promise<boolean> {
  try {
    const target = process.env.MOAOS_EXPRESS_URL;
    if (!target || !process.env.EXPRESS_SECRET) return false;
    const [database, backend, backendDatabase] = await Promise.all([
      getSupabase().from("orders").select("id").limit(1).abortSignal(AbortSignal.timeout(4000)),
      fetch(`${target.replace(/\/$/, "")}/api/express/engine-order`, {
        headers: { "x-express-secret": process.env.EXPRESS_SECRET, ...(process.env.MOAOS_BYPASS ? { "x-vercel-protection-bypass": process.env.MOAOS_BYPASS } : {}) },
        cache: "no-store", signal: AbortSignal.timeout(5000), redirect: "error",
      }),
      fetch(`${target.replace(/\/$/, "")}/api/express/health`, {
        headers: process.env.MOAOS_BYPASS ? { "x-vercel-protection-bypass": process.env.MOAOS_BYPASS } : {},
        cache: "no-store", signal: AbortSignal.timeout(5000), redirect: "error",
      }),
    ]);
    if (database.error || !backend.ok || !backendDatabase.ok || (await backendDatabase.json()).status !== "ok") return false;
    const result = await backend.json();
    return result.ok === true && result.payBeforeProof === true && result.mode === (process.env.EXPRESS_SANDBOX === "1" ? "sandbox" : "live");
  } catch { return false; }
}
