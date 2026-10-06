import { serviceAvailable } from "@/lib/availability";
export const dynamic = "force-dynamic";
export async function GET() {
  const healthy = await serviceAvailable();
  return Response.json({ status: healthy ? "ok" : "unavailable" }, { status: healthy ? 200 : 503, headers: { "Cache-Control": "no-store" } });
}
