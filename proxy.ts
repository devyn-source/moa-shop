// Next.js 16 proxy (middleware). Two responsibilities:
//   1. Gate /admin + /api/admin with HTTP Basic Auth (back-office).
//   2. Require a Clerk account to ORDER (checkout / order history / order API).
//      Browsing + pricing stay public. Customer auth = Clerk.
import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse, type NextRequest } from "next/server";
import { basicAuthValid, emailIsAdmin, clerkEmail } from "@/lib/admin-auth";

// ---- Admin gate ------------------------------------------------------------
// Primary path = Clerk session whose email is allowlisted (branded sign-in, no
// browser popup). Fallback = HTTP Basic Auth (break-glass / automation).
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "";

function isAdminRoute(path: string): boolean {
  return path === "/admin" || path.startsWith("/admin/") || path.startsWith("/api/admin");
}

// Prefetch/RSC requests must never trigger a redirect or auth challenge (pages
// merely linking to /admin would otherwise bounce the user). Answer them quietly.
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

  // 1. Admin gate — Clerk allowlist (primary) with Basic Auth break-glass.
  if (isAdminRoute(pathname)) {
    // Break-glass / automation: a valid Basic Auth header passes silently.
    if (basicAuthValid(req)) return NextResponse.next();
    // Local dev with no creds configured → open (matches prior behavior).
    if (!ADMIN_PASSWORD && process.env.NODE_ENV !== "production") return NextResponse.next();
    const { userId } = await auth();
    if (userId) {
      if (emailIsAdmin(await clerkEmail(userId))) return NextResponse.next();
      // Signed in, but not an MOA admin — forbid (don't loop back to sign-in).
      if (isBackgroundRequest(req)) return new NextResponse(null, { status: 403 });
      return new NextResponse("Not authorized — this account isn't an MOA admin.", { status: 403 });
    }
    // Not signed in → branded Clerk sign-in (no native popup). APIs get 401.
    if (isBackgroundRequest(req)) return new NextResponse(null, { status: 401 });
    if (pathname.startsWith("/api")) return new NextResponse("Admin sign-in required", { status: 401 });
    const signIn = new URL("/sign-in", req.url);
    signIn.searchParams.set("redirect_url", pathname + req.nextUrl.search);
    return NextResponse.redirect(signIn);
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
