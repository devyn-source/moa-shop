import { test } from 'node:test';
import assert from 'node:assert/strict';
import { workflow, summaryCode } from './n8n-availability.mjs';
const good = name => ({statusCode: 200, headers: {'content-type': name === 'Dependencies' ? 'application/json' : 'text/html'}, body: name === 'Dependencies' ? '{"status":"ok"}' : '<html>MOA</html>'});
const evaluate = override => new Function('$', summaryCode)(name => ({first: () => ({json: override?.[name] ?? good(name)})}))[0].json;
test('cloud observer accepts three verified public responses', () => assert.equal(evaluate().healthy, true));
for (const [name, result] of [['HTTP outage', {statusCode: 503}], ['redirect', {...good('Storefront'), statusCode: 302}], ['network failure', {error: 'timeout'}], ['wrong page', {...good('Storefront'), body: 'unrelated'}], ['wrong content type', {...good('Storefront'), headers: {'content-type': 'text/plain'}}]]) {
  test(name + ' remains an unhealthy observation', () => assert.equal(evaluate({'Storefront': result}).healthy, false));
}
test('invalid and unhealthy dependency JSON fail closed', () => {
  for (const body of ['invalid', '{"status":"unavailable"}']) assert.equal(evaluate({Dependencies: {...good('Dependencies'), body}}).healthy, false);
});
test('workflow is credential-free, bounded and has no outbound notification nodes', () => {
  const flow = workflow();
  assert.equal(flow.nodes.length, 5);
  assert.equal(flow.settings.executionTimeout, 90);
  for (const node of flow.nodes.filter(n => n.type.endsWith('httpRequest'))) {
    assert.equal(node.parameters.method, 'GET');
    assert.ok(node.parameters.url.startsWith('https://shop.magnumopus.agency/'));
    assert.equal(node.parameters.options.redirect.redirect.followRedirects, false);
    assert.equal(node.parameters.options.timeout, 15000);
    assert.equal(node.credentials, undefined);
  }
});
