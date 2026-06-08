// Shared admin Basic-Auth check, used by route handlers that must be admin-only
// but can't be method-gated by proxy.ts (e.g. zones PUT while zones GET stays
// public). Mirrors the credential check in proxy.ts. Fails CLOSED in production
// when no password is configured.
const ADMIN_USER = process.env.ADMIN_USER || "moa";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "";

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export function isAdminRequest(req: Request): boolean {
  if (!ADMIN_PASSWORD) return process.env.NODE_ENV !== "production"; // dev: allow, prod: deny
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
