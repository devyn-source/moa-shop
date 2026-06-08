// Next.js 16 proxy (middleware). Two responsibilities:
//   1. Gate /admin + /api/admin with HTTP Basic Auth (back-office).
//   2. Require a Clerk account to ORDER (checkout / order history / order API).
//      Browsing + pricing stay public. Customer auth = Clerk.
import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse, type NextRequest } from "next/server";

// ---- Admin Basic Auth ------------------------------------------------------
const ADMIN_USER = process.env.ADMIN_USER || "moa";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "";

function isAdminRoute(path: string): boolean {
  return path === "/admin" || path.startsWith("/admin/") || path.startsWith("/api/admin");
}

function unauthorized() {
  return new NextResponse("Authentication required", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="MOA Catalog Admin"' },
  });
}

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function adminGate(req: NextRequest): NextResponse | null {
  // Fail CLOSED in production if no password is configured; only pass through in
  // local dev. (Never leave /admin wide open because an env var is missing.)
  if (!ADMIN_PASSWORD) return process.env.NODE_ENV === "production" ? unauthorized() : null;
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
  if (safeEqual(user, ADMIN_USER) && safeEqual(pass, ADMIN_PASSWORD)) return null;
  return unauthorized();
}

// Prefetch/RSC requests must never get a WWW-Authenticate header (it pops the
// browser's native Basic Auth dialog on pages that merely link to /admin).
function isBackgroundRequest(req: NextRequest): boolean {
  return (
    (req.headers.get("sec-purpose") || "").includes("prefetch") ||
    req.headers.get("next-router-prefetch") === "1" ||
    req.headers.get("purpose") === "prefetch" ||
    req.headers.get("next-router-state-tree") !== null
  );
}

// Routes that REQUIRE a signed-in customer ("sign up to order").
// Self-edit page is gated here (signed-in); the API routes (approve/update) do
// in-handler auth + ownership so the emailed approve link can redirect to sign-in
// rather than returning a bare 401.
const requiresAccount = createRouteMatcher(["/checkout(.*)", "/orders(.*)", "/adjust(.*)", "/api/checkout(.*)"]);

export default clerkMiddleware(async (auth, req) => {
  const { pathname } = req.nextUrl;

  // 1. Admin gate (Basic Auth) — independent of customer auth.
  if (isAdminRoute(pathname)) {
    const denied = adminGate(req);
    if (denied && isBackgroundRequest(req)) return new NextResponse(null, { status: 401 });
    return denied ?? NextResponse.next();
  }

  // 2. Order gate — must have a Clerk account to reach checkout/orders.
  if (requiresAccount(req)) {
    const { userId } = await auth();
    if (!userId) {
      // API calls get a 401; pages bounce to sign-up (the "sign up to order"
      // intent) with a return URL back to where they were headed.
      if (pathname.startsWith("/api")) {
        return new NextResponse("Sign in required to order", { status: 401 });
      }
      const signUp = new URL("/sign-up", req.url);
      signUp.searchParams.set("redirect_url", pathname + req.nextUrl.search);
      return NextResponse.redirect(signUp);
    }
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
