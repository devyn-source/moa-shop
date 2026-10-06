import { test } from 'node:test';
import assert from 'node:assert/strict';
import { observe } from './availability.mjs';

const healthy = url => url.endsWith('/api/health') ? Response.json({ status: 'ok' }) : new Response('<html>MOA Catalog</html>', { headers: { 'Content-Type': 'text/html' } });
test('all three public targets must pass and probes refuse redirects', async () => {
  const calls = [];
  const report = await observe(async (url, options) => { calls.push([url, options]); return healthy(url); });
  assert.equal(report.healthy, true);
  assert.equal(calls.length, 3);
  for (const [, options] of calls) {
    assert.equal(options.redirect, 'error');
    assert.equal(options.cache, 'no-store');
    assert.ok(options.signal instanceof AbortSignal);
    assert.equal(options.headers, undefined);
  }
});
for (const failure of ['http-error', 'bad-json', 'unhealthy-json', 'wrong-page', 'wrong-content-type', 'network-or-redirect']) {
  test(`${failure} is recorded as unavailable without losing the other probes`, async () => {
    const report = await observe(async url => {
      const selected = failure.startsWith('wrong-') ? url.endsWith('/sign-in') : url.endsWith('/api/health');
      if (!selected) return healthy(url);
      if (failure === 'http-error') return Response.json({ status: 'unavailable' }, { status: 503 });
      if (failure === 'bad-json') return new Response('not JSON');
      if (failure === 'unhealthy-json') return Response.json({ status: 'unavailable' });
      if (failure === 'wrong-page') return new Response('<html>Unknown site</html>', { headers: { 'Content-Type': 'text/html' } });
      if (failure === 'wrong-content-type') return new Response('MOA', { headers: { 'Content-Type': 'text/plain' } });
      throw new Error('private diagnostic must not appear');
    });
    assert.equal(report.healthy, false);
    assert.equal(report.checks.filter(x => x.healthy).length, 2);
    assert.equal(JSON.stringify(report).includes('private diagnostic'), false);
    if (failure === 'bad-json') assert.equal(report.checks[2].status, 200);
  });
}
test('an aborting probe completes as an outage within its timeout', async () => {
  const keepAlive = setTimeout(() => {}, 1000);
  try {
    const report = await observe((url, { signal }) => url.endsWith('/api/health') ? new Promise((resolve, reject) => signal.addEventListener('abort', () => reject(signal.reason), { once: true })) : Promise.resolve(healthy(url)), 20);
    assert.equal(report.healthy, false);
    assert.equal(report.checks[2].status, null);
    assert.ok(report.checks[2].durationMs < 1000);
  } finally { clearTimeout(keepAlive); }
});
