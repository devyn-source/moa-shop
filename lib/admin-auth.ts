// Admin authentication — two ways in, both honoured everywhere:
//   1. Clerk session whose email is on the ADMIN_ALLOWLIST (the "sexy" path —
//      a branded sign-in, no browser popup).
//   2. HTTP Basic Auth (ADMIN_USER/ADMIN_PASSWORD) — kept as a silent fallback
//      for automation/curl and as an emergency break-glass so a Clerk misconfig
//      can never lock the operator out.
// Fails CLOSED in production when no password is configured.
import { auth, clerkClient } from "@clerk/nextjs/server";

const ADMIN_USER = process.env.ADMIN_USER || "moa";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "";

// Comma-separated allowlist of admin emails. Defaults to Devyn so a missing env
// var never locks the owner out; add more (e.g. Tyler) via the env var.
const ADMIN_EMAILS = (process.env.ADMIN_ALLOWLIST || "devyn@magnumopus.agency")
  .split(",")
  .map((s) => s.trim().toLowerCase())
  .filter(Boolean);

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export function emailIsAdmin(email?: string | null): boolean {
  return Boolean(email && ADMIN_EMAILS.includes(email.toLowerCase()));
}

// Validate an HTTP Basic Auth header against the admin credentials.
export function basicAuthValid(req: Request): boolean {
  if (!ADMIN_PASSWORD) return false;
  const header = req.headers.get("authorization") || "";
  if (!header.startsWith("Basic ")) return false;
  let decoded = "";
  try {
    decoded = atob(header.slice(6));
  } catch {
    return false;
  }
  const idx = decoded.indexOf(":");
  if (idx < 0) return false;
  return safeEqual(decoded.slice(0, idx), ADMIN_USER) && safeEqual(decoded.slice(idx + 1), ADMIN_PASSWORD);
}

// Resolve a Clerk user's primary email (server-side). Null on any failure.
export async function clerkEmail(userId: string): Promise<string | null> {
  try {
    const client = await clerkClient();
    const u = await client.users.getUser(userId);
    return (u.primaryEmailAddress?.emailAddress || u.emailAddresses?.[0]?.emailAddress || "").toLowerCase() || null;
  } catch {
    return null;
  }
}

// Is this request from an admin? True if it carries valid Basic Auth OR a Clerk
// session whose email is allowlisted. Used by route handlers that self-gate
// (e.g. zones PUT, where GET must stay public so it can't be method-gated by the
// proxy). Async because the Clerk path resolves the session + email.
export async function isAdminRequest(req: Request): Promise<boolean> {
  if (basicAuthValid(req)) return true;
  if (!ADMIN_PASSWORD && process.env.NODE_ENV !== "production") return true; // dev convenience
  try {
    const { userId } = await auth();
    if (!userId) return false;
    return emailIsAdmin(await clerkEmail(userId));
  } catch {
    return false;
  }
}
