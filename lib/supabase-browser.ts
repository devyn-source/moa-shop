"use client";
// Browser-side Supabase client for customer auth (email OTP + Google OAuth).
// Uses the public anon key — safe to ship to the client. Session is persisted
// in cookies via @supabase/ssr so the server can read it too.
import { createBrowserClient } from "@supabase/ssr";

export function createBrowserSupabase() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
