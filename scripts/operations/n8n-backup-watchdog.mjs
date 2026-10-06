import {pathToFileURL} from 'node:url';
export function evaluateBackup(identity, folder, listing, now = Date.now()) {
  const report = {checkedAt: new Date(now).toISOString(), healthy: false, notificationsSent: false};
  const ownerOnly = permissions => Array.isArray(permissions) && permissions.length === 1 && permissions[0].type === 'user' && permissions[0].role === 'owner' && permissions[0].emailAddress === 'devyn@magnumopus.agency';
  if (identity?.statusCode !== 200 || identity.body?.user?.emailAddress !== 'devyn@magnumopus.agency') return {...report, reason: 'drive-identity-unavailable'};
  if (folder?.statusCode !== 200 || folder.body?.trashed || !ownerOnly(folder.body?.permissions)) return {...report, reason: 'backup-folder-access-changed'};
  if (listing?.statusCode !== 200 || !Array.isArray(listing.body?.files) || listing.body.nextPageToken) return {...report, reason: 'backup-inventory-unavailable-or-incomplete'};
  const files = listing.body.files;
  const verified = files.filter(file => {
    const p = file.properties || {};
    const t = Number(p.moaCapturedAt) * 1000;
    return p.moaCatalogBackup === 'verified-v1' && /^[a-f0-9]{64}$/.test(p.moaArchiveSha256 || '') &&
      /^[a-f0-9]{32}$/.test(p.moaArchiveMd5 || '') && p.moaArchiveMd5 === file.md5Checksum &&
      Number(p.moaArchiveBytes) > 0 && p.moaArchiveBytes === file.size && Number(p.moaObjectCount) >= 0 &&
      Number.isFinite(t) && t > 0 && t <= now + 300000 && ownerOnly(file.permissions);
  }).sort((a,b) => Number(b.properties.moaCapturedAt) - Number(a.properties.moaCapturedAt));
  if (!verified.length) return {...report, reason: 'no-valid-verified-backup'};
  const latest = verified[0];
  const age = Math.max(0, now - Number(latest.properties.moaCapturedAt) * 1000);
  return {...report, healthy: age <= 30 * 3600000, reason: age <= 30 * 3600000 ? 'verified-backup-current' : 'verified-backup-overdue',
    ageHours: Math.round(age / 36000) / 100, driveFileId: latest.id, objectCount: Number(latest.properties.moaObjectCount)};
}

export function workflow(credentialId, minute = 42) {
  if (!credentialId || !Number.isInteger(minute) || minute < 0 || minute > 59) throw Error('Credential and minute required');
  const folder = '1IGbP1f78FSkJXOY6GopJPNJHwm3e2YA2';
  const query = new URLSearchParams({q: `'${folder}' in parents and trashed = false and properties has { key='moaCatalogBackup' and value='verified-v1' }`, pageSize: '1000', fields: 'nextPageToken,files(id,size,md5Checksum,properties,permissions(type,role,emailAddress))'});
  const targets = [['Drive identity', 'about?fields=user(emailAddress)'], ['Recovery folder', `files/${folder}?fields=id,trashed,permissions(type,role,emailAddress)`], ['Verified archives', 'files?' + query]];
  const nodes = [{id: 'clock', name: 'Hourly backup check', type: 'n8n-nodes-base.scheduleTrigger', typeVersion: 1.2,
    position: [0,0], parameters: {rule:{interval:[{field:'cronExpression',expression:`${minute} * * * *`}]}}}];
  targets.forEach(([name,path],i) => nodes.push({id:'read-'+i,name,type:'n8n-nodes-base.httpRequest',typeVersion:4.2,position:[240*(i+1),0],
    onError:'continueRegularOutput', credentials:{googleDriveOAuth2Api:{id:credentialId,name:'Google Drive OAuth2 API'}},
    parameters:{method:'GET',url:'https://www.googleapis.com/drive/v3/'+path,authentication:'predefinedCredentialType',nodeCredentialType:'googleDriveOAuth2Api',
      options:{timeout:15000,redirect:{redirect:{followRedirects:false}},response:{response:{fullResponse:true,neverError:true,responseFormat:'json'}}}}}));
  nodes.push({id:'result',name:'Backup result',type:'n8n-nodes-base.code',typeVersion:2,position:[960,0],parameters:{jsCode:
    `const evaluate = ${evaluateBackup.toString()};\nreturn [{json:evaluate($('Drive identity').first().json,$('Recovery folder').first().json,$('Verified archives').first().json)}];`}});
  const connections={};for(let i=0;i<nodes.length-1;i++)connections[nodes[i].name]={main:[[{node:nodes[i+1].name,type:'main',index:0}]]};
  return {name:'MOA Catalog backup watchdog',nodes,connections,settings:{timezone:'Etc/UTC',executionOrder:'v1',executionTimeout:90,saveDataSuccessExecution:'all',saveDataErrorExecution:'all'}};
}
if(process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) console.log(JSON.stringify(workflow(process.argv[2],Number(process.argv[3] || 42)),null,2));
