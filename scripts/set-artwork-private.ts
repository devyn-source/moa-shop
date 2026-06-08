// One-off: flip the Supabase `artwork` bucket to PRIVATE so artwork + proofs are
// no longer publicly enumerable. All code now mints signed URLs (upload-artwork,
// proof.ts). Rollback: change `public: false` → `public: true` and re-run.
import { createClient } from "@supabase/supabase-js";

async function main() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY");
  const sb = createClient(url, key);
  const before = await sb.storage.getBucket("artwork");
  console.log("before.public =", before.data?.public);
  const upd = await sb.storage.updateBucket("artwork", { public: false });
  console.log("update:", upd.error ? `ERROR ${upd.error.message}` : "ok");
  const after = await sb.storage.getBucket("artwork");
  console.log("after.public  =", after.data?.public);
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
