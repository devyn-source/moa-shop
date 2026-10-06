import { appendFile, writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

// External probes have no database/admin credentials and never send messages.
const targets = [
  ["Storefront", "https://shop.magnumopus.agency/shop", false],
  ["Sign-in", "https://shop.magnumopus.agency/sign-in", false],
  ["Shop database and backend", "https://shop.magnumopus.agency/api/health", true],
];
export async function observe(fetchImpl = fetch, timeoutMs = 15000) {
const checks = await Promise.all(targets.map(async ([name, url, json]) => {
  const started = Date.now();
  let status = null;
  try {
    const r = await fetchImpl(url, { redirect: "error", signal: AbortSignal.timeout(timeoutMs), cache: "no-store" });
    status = r.status;
    const valid = status === 200 && (json ? (await r.json()).status === "ok" : r.headers.get("content-type")?.includes("text/html") && (await r.text()).includes("MOA"));
    return { name, status, healthy: Boolean(valid), durationMs: Date.now() - started };
  } catch { return { name, status, healthy: false, durationMs: Date.now() - started }; }
}));
return { checkedAt: new Date().toISOString(), healthy: checks.every(x => x.healthy), checks };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
const report = await observe();
const { checks } = report;
await writeFile("availability.json", JSON.stringify(report, null, 2) + "\n");
const summary = `# Availability: ${report.healthy ? "healthy" : "needs review"}\n\nChecked ${report.checkedAt}. No notifications sent.\n\n| Check | HTTP | Result | Duration |\n| --- | --- | --- | --- |\n${checks.map(x => `| ${x.name} | ${x.status ?? "unreachable"} | ${x.healthy ? "healthy" : "unavailable"} | ${x.durationMs} ms |`).join("\n")}\n\nScheduled checks are best effort. Workflow completion is not proof that services are healthy; use the result above.\n`;
if (process.env.GITHUB_STEP_SUMMARY) await appendFile(process.env.GITHUB_STEP_SUMMARY, summary);
console.log(JSON.stringify(report));
}
// Deliberately record outages without a failed workflow triggering unapproved
// platform notification emails. Alert delivery is a separate launch gate.
