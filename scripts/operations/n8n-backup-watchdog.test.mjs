import {test} from 'node:test';
import assert from 'node:assert/strict';
import {evaluateBackup,workflow} from './n8n-backup-watchdog.mjs';
const now=1791312000000;
const permissions=[{type:'user',role:'owner',emailAddress:'devyn@magnumopus.agency'}];
const identity={statusCode:200,body:{user:{emailAddress:'devyn@magnumopus.agency'}}};
const folder={statusCode:200,body:{permissions,trashed:false}};
const file={id:'fixture',size:'1000',md5Checksum:'a'.repeat(32),permissions,properties:{moaCatalogBackup:'verified-v1',moaCapturedAt:String(now/1000-3600),moaArchiveSha256:'b'.repeat(64),moaArchiveMd5:'a'.repeat(32),moaArchiveBytes:'1000',moaObjectCount:'197'}};
const listing={statusCode:200,body:{files:[file]}};
test('fresh verified archive is healthy without the Mac',()=>assert.equal(evaluateBackup(identity,folder,listing,now).healthy,true));
test('time alone makes a missing daily capture overdue',()=>{const r=evaluateBackup(identity,folder,listing,now+31*3600000);assert.equal(r.healthy,false);assert.equal(r.reason,'verified-backup-overdue');});
test('Drive outage, missing archive and incomplete listing fail closed',()=>{
 for(const body of [{files:[]},{files:[file],nextPageToken:'more'}])assert.equal(evaluateBackup(identity,folder,{statusCode:200,body},now).healthy,false);
 assert.equal(evaluateBackup(identity,folder,{error:'timeout'},now).healthy,false);
});
test('wrong account and widened folder access fail closed',()=>{
 assert.equal(evaluateBackup({statusCode:401},folder,listing,now).healthy,false);
 assert.equal(evaluateBackup(identity,{statusCode:200,body:{permissions:[...permissions,{type:'anyone'}]}},listing,now).healthy,false);
});
test('checksum mismatch, future timestamp and unverified metadata fail closed',()=>{
 for(const change of [{md5Checksum:'c'.repeat(32)},{properties:{...file.properties,moaCapturedAt:String(now/1000+600)}},{properties:{...file.properties,moaCatalogBackup:'pending'}}])
  assert.equal(evaluateBackup(identity,folder,{statusCode:200,body:{files:[{...file,...change}]}},now).healthy,false);
});
test('cloud workflow only reads metadata, never keys or archive content',()=>{
 const w=workflow('existing-credential');assert.equal(w.nodes.length,5);
 for(const n of w.nodes.filter(n=>n.type.endsWith('httpRequest'))){assert.equal(n.parameters.method,'GET');assert.ok(!n.parameters.url.includes('alt=media'));assert.ok(!n.parameters.url.includes('1DRzkHz'));}
});
