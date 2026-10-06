import { pathToFileURL } from 'node:url';

// No credentials, messages, customer records or factory routes in this workflow.
export const summaryCode = `
const checks = [['Storefront', false], ['Sign-in', false], ['Dependencies', true]].map(([name, isJson]) => {
  try {
    const result = $(name).first().json;
    const status = result.statusCode ?? null;
    const type = String(result.headers?.['content-type'] || '').toLowerCase();
    const body = result.body ?? result.data;
    const content = isJson ? JSON.parse(body).status === 'ok' : type.includes('text/html') && String(body).includes('MOA');
    return {name, status, healthy: !result.error && status === 200 && content};
  } catch { return {name, status: null, healthy: false}; }
});
return [{json: {checkedAt: new Date().toISOString(), healthy: checks.every(x => x.healthy), checks, notificationsSent: false}}];
`;

export function workflow() {
  const targets = [['Storefront', '/shop'], ['Sign-in', '/sign-in'], ['Dependencies', '/api/health']];
  const nodes = [{id: 'schedule', name: 'Every 15 minutes', type: 'n8n-nodes-base.scheduleTrigger', typeVersion: 1.2,
    position: [0, 0], parameters: {rule: {interval: [{field: 'cronExpression', expression: '4,19,34,49 * * * *'}]}}}];
  targets.forEach(([name, path], i) => nodes.push({id: 'probe-' + i, name, type: 'n8n-nodes-base.httpRequest', typeVersion: 4.2,
    position: [240 * (i + 1), 0], onError: 'continueRegularOutput', parameters: {method: 'GET', url: 'https://shop.magnumopus.agency' + path,
      options: {timeout: 15000, redirect: {redirect: {followRedirects: false}}, response: {response: {fullResponse: true, neverError: true, responseFormat: 'text', outputPropertyName: 'body'}}}}}));
  nodes.push({id: 'summary', name: 'Availability result', type: 'n8n-nodes-base.code', typeVersion: 2,
    position: [960, 0], parameters: {jsCode: summaryCode}});
  const connections = {};
  for (let i = 0; i < nodes.length - 1; i++) connections[nodes[i].name] = {main: [[{node: nodes[i + 1].name, type: 'main', index: 0}]]};
  return {name: 'MOA Catalog availability observations', nodes, connections,
    settings: {timezone: 'Etc/UTC', executionOrder: 'v1', executionTimeout: 90, saveDataSuccessExecution: 'all', saveDataErrorExecution: 'all'}};
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) console.log(JSON.stringify(workflow(), null, 2));
