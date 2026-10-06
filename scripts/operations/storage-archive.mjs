// Dependency-free offline recovery. Requires only Node.js; no provider credentials.
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve, relative, isAbsolute, join, dirname } from 'node:path';
import { pathToFileURL } from 'node:url';
const magic = Buffer.from('MOABAK01');
const hash = value => createHash('sha256').update(value).digest('hex');
const within = (parent, child) => { const p = relative(parent, child); return p === '' || (!p.startsWith('..') && !isAbsolute(p)); };
export function seal(bytes, key) {
  if (key.length !== 32) throw new Error('A 32-byte encryption key is required');
  const nonce = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, nonce);
  cipher.setAAD(magic);
  const ciphertext = Buffer.concat([cipher.update(bytes), cipher.final()]);
  return Buffer.concat([magic, nonce, cipher.getAuthTag(), ciphertext]);
}
export function unseal(bytes, key) {
  if (bytes.length < 36 || !bytes.subarray(0, 8).equals(magic)) throw new Error('Invalid backup format');
  const cipher = createDecipheriv('aes-256-gcm', key, bytes.subarray(8, 20));
  cipher.setAAD(magic);
  cipher.setAuthTag(bytes.subarray(20, 36));
  return Buffer.concat([cipher.update(bytes.subarray(36)), cipher.final()]);
}
export async function verifyArchive(output, key) {
  const manifest = JSON.parse(unseal(await readFile(join(output, 'manifest.aes')), key).toString('utf8'));
  if (manifest.version !== 1 || !Array.isArray(manifest.objects)) throw new Error('Unsupported backup manifest');
  let bytes = 0;
  const seen = new Set();
  for (const object of manifest.objects) {
    if (!/^[a-f0-9]{64}\.aes$/.test(object.file) || seen.has(object.file)) throw new Error('Unsafe or duplicate archive filename');
    seen.add(object.file);
    const data = unseal(await readFile(join(output, object.file)), key);
    if (data.length !== object.bytes || hash(data) !== object.sha256) throw new Error('Backup object integrity failed');
    bytes += data.length;
  }
  return { profile: manifest.profile, objectCount: manifest.objects.length, bytes, verified: true, keyId: hash(key).slice(0, 16), capturedAt: manifest.capturedAt };
}

export async function extractArchive(archive, key, destination) {
  const report = await verifyArchive(archive, key);
  const manifest = JSON.parse(unseal(await readFile(join(archive, 'manifest.aes')), key));
  const root = resolve(destination);
  const paths = manifest.objects.map(object => {
    if (!/^[a-z0-9-]+$/.test(object.bucket) || typeof object.path !== 'string' || !object.path || object.path.includes('\\') || object.path.includes('\0') || object.path.split('/').some(p => !p || p === '.' || p === '..')) throw new Error('Unsafe restored object path');
    const target = resolve(root, object.bucket, object.path);
    if (!within(root, target)) throw new Error('Unsafe restored object path');
    return target;
  });
  if (new Set(paths).size !== paths.length) throw new Error('Duplicate restored object path');
  await mkdir(root, { mode: 0o700 });
  for (let i = 0; i < manifest.objects.length; i++) {
    await mkdir(dirname(paths[i]), { mode: 0o700, recursive: true });
    const bytes = unseal(await readFile(join(archive, manifest.objects[i].file)), key);
    await writeFile(paths[i], bytes, { mode: 0o600, flag: 'wx' });
  }
  await writeFile(join(root, 'recovery-manifest.json'), JSON.stringify(manifest, null, 2), { mode: 0o600, flag: 'wx' });
  return { ...report, extracted: true };
}
async function main() {
  const [command, archive, keyFile, destination] = process.argv.slice(2);
  if (!['verify','extract'].includes(command) || !archive || !keyFile || command === 'extract' && !destination) throw new Error('Usage: storage-archive.mjs verify|extract ARCHIVE KEY_FILE [NEW_DESTINATION]');
  const key = await readFile(keyFile);
  if (key.length !== 32) throw new Error('Invalid recovery key');
  console.log(JSON.stringify(command === 'verify' ? await verifyArchive(resolve(archive), key) : await extractArchive(resolve(archive), key, destination)));
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main().catch(() => { console.error('Archive recovery failed; keep the original archive and check the key and file integrity.'); process.exitCode = 1; });
