// Next.js 16 proxy (the new name for the file formerly known as middleware).
// Gates the back-office surfaces with Clerk. While Clerk env vars are absent
// — local dev or pre-rollout — this falls back to a pass-through so nothing
// breaks. The moment both keys are set in Vercel env, every matched route
// requires a signed-in user.
import { NextResponse, type NextRequest } from "next/server";
import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

const isProtectedRoute = createRouteMatcher([
  "/admin(.*)",
  "/api/admin(.*)",
  "/api/zones(.*)",
  "/api/upload-artwork(.*)"
]);

const clerkConfigured =
  Boolean(process.env.CLERK_SECRET_KEY) &&
  Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY);

const guarded = clerkMiddleware(async (auth, req) => {
  if (isProtectedRoute(req)) {
    await auth.protect();
  }
});

function passThrough(_req: NextRequest) {
  return NextResponse.next();
}

export default clerkConfigured ? guarded : passThrough;

export const config = {
  matcher: [
    // Skip static, image optimisation, and public asset folders.
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|webmanifest)).*)",
    "/(api|trpc)(.*)",
    "/__clerk/(.*)" // required by Clerk v7 for its internal handshake routes
  ]
};
