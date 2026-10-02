export function validMockupUrls(value: unknown, storageOrigin: string | undefined): value is Partial<Record<"front" | "back", string>> {
  if (!value || typeof value !== "object" || Array.isArray(value) || !storageOrigin) return false;
  const entries = Object.entries(value);
  if (!entries.length || entries.length > 2) return false;
  try {
    const origin = new URL(storageOrigin).origin;
    return entries.every(([view, raw]) => {
      if (!["front", "back"].includes(view) || typeof raw !== "string") return false;
      const url = new URL(raw);
      return url.origin === origin && url.protocol === "https:" && !url.username && !url.password
        && new RegExp(`^/storage/v1/object/sign/artwork/mockups/[a-f0-9-]{36}/${view}\\.webp$`).test(url.pathname)
        && Boolean(url.searchParams.get("token"));
    });
  } catch { return false; }
}
