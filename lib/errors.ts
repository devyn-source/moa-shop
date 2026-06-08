import { NextResponse } from "next/server";
import { ZodError } from "zod";

// Normalize any thrown error into a SAFE client response. Full detail is logged
// server-side; the client never sees stack traces, SQL, file paths, or tokens.
// Zod failures become a generic 400 ("invalid request") — we don't echo paths.
export function apiError(error: unknown, opts: { fallback?: string; status?: number } = {}): NextResponse {
  if (error instanceof ZodError) {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  console.error("[api-error]", error instanceof Error ? (error.stack ?? error.message) : error);
  return NextResponse.json({ error: opts.fallback ?? "Something went wrong. Please try again." }, { status: opts.status ?? 500 });
}
