// OAuth (Google) callback: exchange the auth code for a session, set cookies,
// then send the customer on to ?next (defaults to /orders). Route handlers can
// write cookies, so the session persists from here.
import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase-server";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const next = url.searchParams.get("next") || "/orders";
  const origin = url.origin;

  if (code) {
    const supabase = await createServerSupabase();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent(error.message)}`);
    }
  }
  return NextResponse.redirect(`${origin}${next.startsWith("/") ? next : "/orders"}`);
}
