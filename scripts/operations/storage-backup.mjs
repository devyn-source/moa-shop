import { createClient } from '@supabase/supabase-js';
import { createHash } from 'node:crypto';
import { seal, verifyArchive } from './storage-archive.mjs';
export { seal, unseal, verifyArchive } from './storage-archive.mjs';
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { resolve, relative, isAbsolute, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const profiles = {
  shop: { host: 'ntppmyydbmwweosuavuw.supabase.co', buckets: ['artwork', 'sku-patterns', 'sku-models', 'sku-plates'] },
  backend: { host: 'dzrwsorqhwepcfusklqx.supabase.co', buckets: ['express-artwork'] },
};
const hash = value => createHash('sha256').update(value).digest('hex');
const within = (parent, child) => { const p = relative(parent, child); return p === '' || (!p.startsWith('..') && !isAbsolute(p)); };
export function readonlyFetch(base, fetchImpl = fetch) {
  return (input, options = {}) => {
    const url = new URL(input instanceof Request ? input.url : input);
    const method = (options.method || (input instanceof Request ? input.method : 'GET')).toUpperCase();
    if (url.origin !== base || !(method === 'GET' || method === 'POST' && url.pathname.startsWith('/storage/v1/object/list/'))) throw new Error('Backup transport is read-only and restricted to its project');
    return fetchImpl(input, { ...options, redirect: 'error', signal: AbortSignal.timeout(30000) });
  };
}
export async function inventory(storage, buckets, pageSize = 1000) {
  const objects = [];
  let scanned = 0;
  for (const bucket of buckets) {
    const folders = [''];
    const visited = new Set();
    while (folders.length) {
      const prefix = folders.shift();
      if (visited.has(prefix)) throw new Error('Repeated storage folder');
      visited.add(prefix);
      for (let offset = 0; ; offset += pageSize) {
        if (++scanned > 20000) throw new Error('Storage listing safety limit reached; inventory is incomplete');
        const { data, error } = await storage.from(bucket).list(prefix, { limit: pageSize, offset, sortBy: { column: 'name', order: 'asc' } });
        if (error || !Array.isArray(data)) throw new Error('Storage inventory failed');
        for (const entry of data) {
          if (!entry.name || entry.name.includes('/') || entry.name === '.' || entry.name === '..') throw new Error('Invalid storage entry');
          const path = prefix ? `${prefix}/${entry.name}` : entry.name;
          if (entry.id == null) folders.push(path);
          else objects.push({ bucket, path, id: entry.id, updatedAt: entry.updated_at, size: entry.metadata?.size ?? null, etag: entry.metadata?.eTag ?? entry.metadata?.etag ?? null, mimeType: entry.metadata?.mimetype ?? null });
        }
        if (data.length < pageSize) break;
      }
    }
  }
  return objects.sort((a, b) => `${a.bucket}/${a.path}`.localeCompare(`${b.bucket}/${b.path}`));
}
export async function backup(storage, profile, buckets, output, key, bucketSettings) {
  const before = await inventory(storage, buckets);
  if (before.reduce((sum, x) => sum + (x.size || 0), 0) > 2 * 1024 ** 3) throw new Error('Backup exceeds 2 GiB; review capacity before proceeding');
  await mkdir(output, { mode: 0o700 }); // Refuse reuse or accidental overwrite.
  const objects = [];
  let bytes = 0;
  for (const object of before) {
    const { data, error } = await storage.from(object.bucket).download(object.path);
    if (error || !data) throw new Error('Storage download failed; partial archive is not complete');
    const content = Buffer.from(await data.arrayBuffer());
    bytes += content.length;
    if (bytes > 2 * 1024 ** 3 || object.size != null && content.length !== object.size) throw new Error('Storage size changed or backup exceeds safety limit');
    const file = `${hash(`${object.bucket}/${object.path}`)}.aes`;
    await writeFile(join(output, file), seal(content, key), { mode: 0o600, flag: 'wx' });
    objects.push({ ...object, file, bytes: content.length, sha256: hash(content) });
  }
  const after = await inventory(storage, buckets);
  if (JSON.stringify(before) !== JSON.stringify(after)) throw new Error('Storage changed during backup; no completed manifest was written');
  const manifest = { version: 1, profile, capturedAt: new Date().toISOString(), bucketSettings, objects };
  await writeFile(join(output, 'manifest.aes'), seal(Buffer.from(JSON.stringify(manifest)), key), { mode: 0o600, flag: 'wx' });
  const report = await verifyArchive(output, key);
  await writeFile(join(output, 'verification.json'), JSON.stringify(report, null, 2) + '\n', { mode: 0o600, flag: 'wx' });
  return report;
}

async function main() {
  const [command, profileName, outputArg, keyArg] = process.argv.slice(2);
  if (!['backup', 'verify', 'inventory'].includes(command) || !profiles[profileName]) throw new Error('Usage: storage-backup.mjs backup|verify|inventory shop|backend OUTPUT KEY_FILE');
  const profile = profiles[profileName];
  const output = outputArg && resolve(outputArg);
  const keyPath = keyArg && resolve(keyArg);
  let key;
  if (command !== 'inventory') {
    const repo = fileURLToPath(new URL('../../', import.meta.url));
    if (!output || !keyPath || within(repo, output) || within(repo, keyPath) || within(output, keyPath)) throw new Error('Keep archives outside the repository and their key outside both the archive and repository');
    if ((await stat(keyPath)).mode & 0o077) throw new Error('Encryption key permissions must restrict access to its owner');
    key = await readFile(keyPath);
    if (key.length !== 32) throw new Error('Encryption key must contain 32 random bytes');
  }
  if (command === 'verify') { console.log(JSON.stringify(await verifyArchive(output, key))); return; }
  const base = (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '').trim();
  if (base !== `https://${profile.host}` || !process.env.SUPABASE_SERVICE_ROLE_KEY) throw new Error('Wrong or missing source project configuration');
  const client = createClient(base, process.env.SUPABASE_SERVICE_ROLE_KEY.trim(), { auth: { persistSession: false, autoRefreshToken: false }, global: { fetch: readonlyFetch(base) } });
  const settings = await client.storage.listBuckets();
  if (settings.error || profile.buckets.some(id => !settings.data.some(x => x.id === id))) throw new Error('Expected source buckets are missing');
  if (command === 'inventory') {
    const objects = await inventory(client.storage, profile.buckets);
    console.log(JSON.stringify({ profile: profileName, buckets: profile.buckets.map(bucket => ({ name: bucket, count: objects.filter(x => x.bucket === bucket).length, bytes: objects.filter(x => x.bucket === bucket).reduce((sum, x) => sum + (x.size || 0), 0) })) }));
    return;
  }
  const bucketSettings = settings.data.filter(x => profile.buckets.includes(x.id)).map(({ id, public: isPublic, file_size_limit, allowed_mime_types }) => ({ id, public: isPublic, file_size_limit, allowed_mime_types }));
  console.log(JSON.stringify(await backup(client.storage, profileName, profile.buckets, output, key, bucketSettings)));
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main().catch(() => {
  console.error('Storage backup did not complete. No remote writes were made. Retain any partial archive for inspection; do not mark it as verified.');
  process.exitCode = 1;
});
