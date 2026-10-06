import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomBytes } from 'node:crypto';
import { backup, inventory, readonlyFetch, seal, unseal, verifyArchive } from './storage-backup.mjs';
import { extractArchive } from './storage-archive.mjs';

test('authenticated encryption rejects a wrong key, modified content and truncation', () => {
  const key = randomBytes(32), text = Buffer.from('Synthetic artwork bytes');
  const encrypted = seal(text, key);
  assert.deepEqual(unseal(encrypted, key), text);
  assert.throws(() => unseal(encrypted, randomBytes(32)));
  const altered = Buffer.from(encrypted); altered[altered.length - 1] ^= 1;
  assert.throws(() => unseal(altered, key));
  assert.throws(() => unseal(encrypted.subarray(0, 30), key));
});
test('transport blocks remote mutations, other projects and redirects', async () => {
  const calls = [];
  const read = readonlyFetch('https://source.example', async (...args) => { calls.push(args); return new Response('[]'); });
  await read('https://source.example/storage/v1/object/list/artwork', { method: 'POST' });
  assert.equal(calls[0][1].redirect, 'error');
  assert.throws(() => read('https://source.example/storage/v1/object/artwork/file', { method: 'POST' }), /read-only/);
  assert.throws(() => read('https://source.example/storage/v1/object/artwork/file', { method: 'DELETE' }), /read-only/);
  assert.throws(() => read('https://other.example/file'), /restricted/);
  assert.equal(calls.length, 1);
});
test('inventory follows nested folders and every page', async () => {
  const entries = { '': [{ name: 'folder', id: null }, { name: 'top', id: '1', metadata: { size: 1 } }], folder: [{ name: 'nested', id: '2', metadata: { size: 2 } }] };
  const storage = { from: () => ({ list: async (prefix, { offset, limit }) => ({ data: entries[prefix].slice(offset, offset + limit) }) }) };
  const result = await inventory(storage, ['artwork'], 1);
  assert.deepEqual(result.map(x => x.path), ['folder/nested', 'top']);
});
test('a failed listing cannot look like an empty successful backup', async () => {
  await assert.rejects(() => inventory({ from: () => ({ list: async () => ({ data: [], error: {} }) }) }, ['artwork']), /failed/);
});
test('backup verifies every object offline and detects tampering', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'moa-storage-test-'));
  try {
    const output = join(dir, 'archive'), key = randomBytes(32);
    const entry = { name: 'fixture', id: 'one', updated_at: '2026-01-01', metadata: { size: 5 } };
    const storage = { from: () => ({ list: async () => ({ data: [entry] }), download: async () => ({ data: new Blob(['hello']) }) }) };
    const result = await backup(storage, 'shop', ['artwork'], output, key, []);
    assert.equal(result.objectCount, 1); assert.equal(result.bytes, 5); assert.equal(result.verified, true);
    const manifest = JSON.parse(unseal(await readFile(join(output, 'manifest.aes')), key));
    assert.equal(manifest.objects[0].path, 'fixture');
    const recovered = join(dir, 'restored');
    assert.equal((await extractArchive(output, key, recovered)).extracted, true);
    assert.equal(await readFile(join(recovered, 'artwork/fixture'), 'utf8'), 'hello');
    await assert.rejects(() => extractArchive(output, key, recovered), /EEXIST/);
    const unsafeManifest = { ...manifest, objects: [{ ...manifest.objects[0], path: '../outside' }] };
    await writeFile(join(output, 'manifest.aes'), seal(Buffer.from(JSON.stringify(unsafeManifest)), key));
    await assert.rejects(() => extractArchive(output, key, join(dir, 'unsafe')), /Unsafe restored/);
    await writeFile(join(output, 'manifest.aes'), seal(Buffer.from(JSON.stringify(manifest)), key));
    await writeFile(join(output, manifest.objects[0].file), randomBytes(100));
    await assert.rejects(() => verifyArchive(output, key));
    await assert.rejects(() => backup(storage, 'shop', ['artwork'], output, key, []), /EEXIST/);
  } finally { await rm(dir, { recursive: true, force: true }); }
});
test('source changes during a download prevent a completed manifest', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'moa-storage-test-'));
  try {
    let calls = 0;
    const storage = { from: () => ({ list: async () => ({ data: [{ name: 'fixture', id: 'one', updated_at: String(++calls), metadata: { size: 5 } }] }), download: async () => ({ data: new Blob(['hello']) }) }) };
    const output = join(dir, 'archive');
    await assert.rejects(() => backup(storage, 'shop', ['artwork'], output, randomBytes(32), []), /changed during backup/);
    await assert.rejects(() => readFile(join(output, 'manifest.aes')), /ENOENT/);
  } finally { await rm(dir, { recursive: true, force: true }); }
});
test('verification refuses a manifest with a path outside the archive', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'moa-storage-test-'));
  try {
    const key = randomBytes(32);
    await writeFile(join(dir, 'manifest.aes'), seal(Buffer.from(JSON.stringify({ version: 1, objects: [{ file: '../outside' }] })), key));
    await assert.rejects(() => verifyArchive(dir, key), /Unsafe/);
  } finally { await rm(dir, { recursive: true, force: true }); }
});
