// Next.js 16 proxy (formerly middleware). Two responsibilities:
//   1. Gate /admin + /api/admin with HTTP Basic Auth (back-office).
//   2. Refresh the customer's Supabase Auth session cookie on every other
//      request that carries one, so Server Components see a fresh user.
// Customer auth = Supabase (email OTP + Google). Admin auth = Basic Auth.
import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

// ---- Admin Basic Auth ------------------------------------------------------
const ADMIN_USER = process.env.ADMIN_USER || "moa";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "";

function isAdminRoute(path: string): boolean {
  return path === "/admin" || path.startsWith("/admin/") || path.startsWith("/api/admin");
}

function unauthorized() {
  return new NextResponse("Authentication required", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="MOA Catalog Admin"' }
  });
}

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function adminGate(req: NextRequest): NextResponse | null {
  if (!ADMIN_PASSWORD) return null; // pass-through in local dev when unset
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

// ---- Supabase session refresh ----------------------------------------------
async function refreshSession(request: NextRequest): Promise<NextResponse> {
  const response = NextResponse.next({ request });
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) return response;

  const supabase = createServerClient(url, anon, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options)
        );
      }
    }
  });

  // Touch the user to trigger a token refresh if needed.
  await supabase.auth.getUser();
  return response;
}

export default async function proxy(request: NextRequest): Promise<NextResponse> {
  const { pathname } = request.nextUrl;

  if (isAdminRoute(pathname)) {
    return adminGate(request) ?? NextResponse.next();
  }

  // Only pay the refresh round-trip when a Supabase auth cookie is present.
  const hasSession = request.cookies.getAll().some((c) => c.name.startsWith("sb-"));
  if (hasSession) return refreshSession(request);

  return NextResponse.next();
}

export const config = {
  matcher: [
    // Skip static, image optimisation, and public asset folders.
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|webmanifest)).*)",
    "/(api|trpc)(.*)"
  ]
};
