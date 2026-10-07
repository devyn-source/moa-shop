// Server-side transport for the existing isolated Express service.
export async function staffService(number?: string, command?: unknown, actor?: string) {
  const base = (process.env.MOAOS_EXPRESS_URL || "").replace(/\/$/, "");
  if (process.env.EXPRESS_SANDBOX !== "1" || base !== "https://moa-shop-express-service.vercel.app" || !process.env.EXPRESS_SECRET) {
    return Response.json({ error: "Staff sandbox service is not configured" }, { status: 503 });
  }
  try {
    const response = await fetch(`${base}/api/express/staff${number ? `?number=${encodeURIComponent(number)}` : ""}`, {
      method: command ? "POST" : "GET", cache: "no-store", redirect: "error", signal: AbortSignal.timeout(20000),
      headers: { "Content-Type": "application/json", "x-express-secret": process.env.EXPRESS_SECRET, ...(actor ? { "x-express-operator": actor } : {}) },
      ...(command ? { body: JSON.stringify(command) } : {}),
    });
    const data = await response.json();
    return Response.json(data, { status: response.status, headers: { "Cache-Control": "private, no-store" } });
  } catch {
    return Response.json({ error: "Connection interrupted. Reload the order to check whether the update saved before trying again." }, { status: 503, headers: { "Cache-Control": "private, no-store" } });
  }
}
