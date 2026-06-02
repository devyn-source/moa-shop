// Next.js 16 proxy (the new name for the file formerly known as middleware).
// Gates the back-office surfaces. Three modes, picked at request time:
//   1. Clerk configured (both keys set)        -> require a signed-in user
//   2. ADMIN_PASSWORD set (no Clerk)            -> HTTP Basic Auth
//   3. neither                                  -> pass-through (local dev only)
//
// IMPORTANT: only /admin and /api/admin are gated. The customer configurator
// hits /api/zones (GET) and /api/upload-artwork from the PUBLIC product page,
// so those must never be behind auth.
import { NextResponse, type NextRequest } from "next/server";
import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

const isProtectedRoute = createRouteMatcher(["/admin(.*)", "/api/admin(.*)"]);

const clerkConfigured =
  Boolean(process.env.CLERK_SECRET_KEY) &&
  Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY);

const guarded = clerkMiddleware(async (auth, req) => {
  if (isProtectedRoute(req)) {
    await auth.protect();
  }
});

// --- HTTP Basic Auth fallback (no Clerk) -----------------------------------
const ADMIN_USER = process.env.ADMIN_USER || "moa";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "";

function unauthorized() {
  return new NextResponse("Authentication required", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="MOA Catalog Admin"' }
  });
}

// Constant-ish-time string compare to avoid trivial timing leaks.
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function basicAuthGate(req: NextRequest) {
  if (!isProtectedRoute(req)) return NextResponse.next();
  const header = req.headers.get("authorization") || "";
  if (!header.startsWith("Basic ")) return unauthorized();
  let decoded = "";
  try {
    decoded = atob(header.slice(6));
  } catch {
    return unauthorized();
  }
  const idx = decoded.indexOf(":");
  const user = decoded.slice(0, idx);
  const pass = decoded.slice(idx + 1);
  if (safeEqual(user, ADMIN_USER) && safeEqual(pass, ADMIN_PASSWORD)) {
    return NextResponse.next();
  }
  return unauthorized();
}

function passThrough(_req: NextRequest) {
  return NextResponse.next();
}

export default clerkConfigured
  ? guarded
  : ADMIN_PASSWORD
    ? basicAuthGate
    : passThrough;

export const config = {
  matcher: [
    // Skip static, image optimisation, and public asset folders.
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|webmanifest)).*)",
    "/(api|trpc)(.*)",
    "/__clerk/(.*)" // required by Clerk v7 for its internal handshake routes
  ]
};
