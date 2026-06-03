// Changes are 100% self-serve — the customer redoes the proof themselves. This
// legacy "request changes" path no longer routes to a human; it just sends the
// customer to the self-serve adjust editor (covers any stale links).
import { NextResponse } from "next/server";

const ORIGIN = process.env.NEXT_PUBLIC_SITE_ORIGIN || "https://shop.magnumopus.agency";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return NextResponse.redirect(`${ORIGIN}/adjust/${id}`, 302);
}

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return NextResponse.redirect(`${ORIGIN}/adjust/${id}`, 302);
}
