import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

// App-level rate limiting (the industry-standard serverless pattern: a shared
// Redis store via Upstash's HTTP API — in-memory can't work across functions).
// SAFE NO-OP until UPSTASH_REDIS_REST_URL + _TOKEN are set, so it never breaks
// prod before the account exists; the moment they're configured it enforces.
// Accept both naming schemes: UPSTASH_* (direct Upstash account) and KV_* (the
// Vercel Marketplace integration injects KV_REST_API_URL/_TOKEN — same REST API).
const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
const redis = url && token ? new Redis({ url, token }) : null;
if (!redis && process.env.NODE_ENV === "production") {
  // Loud, not silent: prod without Upstash means every limiter is a no-op.
  console.warn("[rate-limit] no Upstash REST credentials (UPSTASH_REDIS_REST_* or KV_REST_API_*) — rate limiting is DISABLED in production.");
}

type Window = `${number} ${"s" | "m" | "h" | "d"}`;
function make(limit: number, window: Window, prefix: string): Ratelimit | null {
  return redis ? new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(limit, window), prefix, analytics: false }) : null;
}

// Per-IP/hour budgets — generous for real use, tight against abuse.
const limiters = {
  checkout: make(10, "1 h", "rl:checkout"),
  upload: make(40, "1 h", "rl:upload"),
  approve: make(20, "1 h", "rl:approve"),
  update: make(20, "1 h", "rl:update"),
  samples: make(5, "1 h", "rl:samples"),
  invoice: make(5, "1 h", "rl:invoice")
};

export function clientIp(req: Request): string {
  return (req.headers.get("x-forwarded-for") || "").split(",")[0]?.trim() || "anon";
}

// Returns true if the request is allowed. Allows (no-op) when Upstash is unset.
export async function rateLimit(name: keyof typeof limiters, identifier: string): Promise<boolean> {
  const l = limiters[name];
  if (!l) return true;
  try {
    const { success } = await l.limit(identifier);
    return success;
  } catch {
    // Limiter outage: fail closed in production (abuse protection holds), open
    // in dev so a missing local Upstash never blocks iteration.
    return process.env.NODE_ENV !== "production";
  }
}
