import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";

// Event ingestion — the client analytics layer fire-and-forgets here so MOA owns
// every funnel event in its own Supabase (analytics_events), not just Vercel/PostHog.
// Public by design (it logs anonymous client events); never errors the caller.
export const runtime = "nodejs";

type Body = {
  event?: unknown;
  session_id?: unknown;
  anon_id?: unknown;
  path?: unknown;
  slug?: unknown;
  value?: unknown;
  props?: unknown;
  referrer?: unknown;
};

const str = (v: unknown, max = 300): string | null => (typeof v === "string" && v ? v.slice(0, max) : null);

export async function POST(req: Request) {
  try {
    const b = (await req.json()) as Body;
    if (typeof b.event !== "string" || !b.event) return NextResponse.json({ ok: false }, { status: 400 });
    let props = (b.props && typeof b.props === "object" ? b.props : {}) as Record<string, unknown>;
    if (JSON.stringify(props).length > 4000) props = {}; // cap — don't let a client bloat the table
    const value =
      typeof b.value === "number" ? b.value : typeof props.value === "number" ? (props.value as number) : null;

    await getSupabase()
      .from("analytics_events")
      .insert({
        event: b.event.slice(0, 80),
        session_id: str(b.session_id, 64),
        anon_id: str(b.anon_id, 64),
        path: str(b.path),
        slug: str(b.slug, 120) ?? str(props.slug, 120),
        value,
        props,
        referrer: str(b.referrer),
        ua: str(req.headers.get("user-agent"), 300),
      });
    return NextResponse.json({ ok: true });
  } catch {
    // analytics must never break the page — swallow and 200
    return NextResponse.json({ ok: false });
  }
}
