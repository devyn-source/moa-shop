// Opt-in destructive rehearsal, pinned to the two disposable October 6 branches.
// Never accepts a production URL or reads a production credential.
import assert from 'node:assert/strict';
import {readFileSync, writeFileSync, existsSync} from 'node:fs';
import {join, resolve} from 'node:path';
import {spawnSync} from 'node:child_process';
import {createHash, randomBytes} from 'node:crypto';
import {createClient} from '@supabase/supabase-js';
import {backup, readonlyFetch} from './storage-backup.mjs';
import {extractArchive} from './storage-archive.mjs';

const root = resolve(process.argv[2] || '');
if (!process.argv[2] || !root.startsWith('/Users/moabot/.config/moa-stage4/')) throw Error('Private rehearsal directory required');
process.umask(0o077);
const refs = {shop:'ljjqxecobutaorqwsvkh',backend:'mywiahomkqhhzerquzhh'};
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const quote = value => "'" + String(value).replaceAll("'", "''") + "'";
const json = value => quote(JSON.stringify(value)) + '::jsonb';
const started = Date.now();
const passed = [];
const mark = text => {passed.push(text); console.log(text);};
const contexts = {};
const recovering = process.argv[3] === '--recover-captured';
const key = recovering ? readFileSync(join(root,'rehearsal.key')) : randomBytes(32);
if (!recovering) {
  if (existsSync(join(root,'rehearsal.key'))) throw Error('Refusing to reuse a rehearsal directory');
  writeFileSync(join(root,'rehearsal.key'),key,{mode:0o600,flag:'wx'});
}

function command(kind, binary, args, input) {
  const result = spawnSync('/opt/homebrew/opt/libpq/bin/'+binary,args,{env:contexts[kind].env,input,encoding:'utf8',timeout:120000,maxBuffer:16*1024*1024});
  if (result.status !== 0) {
    writeFileSync(join(root,kind+'-private-error.log'),result.stderr || 'Process failed',{mode:0o600});
    throw Error(kind+' '+binary+' failed; private diagnostic retained');
  }
  return result.stdout.trim();
}
const sql = (kind, input) => command(kind,'psql',['-XqAt','-v','ON_ERROR_STOP=1'],input);
const fingerprint = kind => sql(kind, `DO $$ DECLARE r record; n bigint; h text; result jsonb := '{}'::jsonb; BEGIN
 FOR r IN SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename LOOP
 EXECUTE format('select count(*), md5(coalesce(jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text)::text, %L)) from public.%I t','[]',r.tablename) INTO n,h;
 result := result || jsonb_build_object(r.tablename,jsonb_build_object('count',n,'hash',h)); END LOOP;
 PERFORM set_config('moa.recovery_fingerprint',result::text,false); END $$;
 SELECT current_setting('moa.recovery_fingerprint');`);
const check = result => {if(result.error) throw Error('Isolated storage operation failed');return result.data;};

for (const [kind,ref] of Object.entries(refs)) {
  const config = JSON.parse(readFileSync(join(root,kind+'-config.json')));
  const branch = JSON.parse(readFileSync(join(root,kind+'-created.json')));
  assert.equal(branch.project_ref,ref);assert.equal(branch.is_default,false);assert.equal(branch.with_data,false);
  assert.equal(branch.name,'stage4-recovery-20261006');
  assert.equal(config.SUPABASE_URL,'https://'+ref+'.supabase.co');
  const u = new URL(config.POSTGRES_URL);
  assert.ok(u.hostname.includes(ref) || decodeURIComponent(u.username).endsWith('.'+ref));
  const env = {PATH:process.env.PATH,PGHOST:u.hostname,PGPORT:u.port || '5432',PGUSER:decodeURIComponent(u.username),PGPASSWORD:decodeURIComponent(u.password),PGDATABASE:u.pathname.slice(1),PGSSLMODE:'require',PGCONNECT_TIMEOUT:'20'};
  const transport = (input, options={}) => {
    const url=new URL(input instanceof Request ? input.url : input);
    assert.equal(url.origin,config.SUPABASE_URL);
    if ((options.method || 'GET').toUpperCase()==='GET' && url.pathname.startsWith('/storage/v1/object/')) url.searchParams.set('recoveryCheck',randomBytes(12).toString('hex'));
    return fetch(url,{...options,cache:'no-store',redirect:'error',signal:AbortSignal.timeout(30000)});
  };
  const client = createClient(config.SUPABASE_URL,config.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false},global:{fetch:transport}});
  contexts[kind] = {config,env,client};
  const bucket=kind==='shop'?'artwork':'express-artwork';
  const path='recovery-fixture/proof.svg';
  const bytes=Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="200" height="80"><text x="10" y="40">SYNTHETIC '+kind.toUpperCase()+' PROOF</text></svg>');
  Object.assign(contexts[kind],{bucket,path,bytes,url:config.SUPABASE_URL+'/storage/v1/object/authenticated/'+bucket+'/'+path});
  if (recovering) {
    const captured=JSON.parse(readFileSync(join(root,kind+'-checkpoint.json')));
    assert.equal(hash(readFileSync(join(root,kind+'-snapshot.sql'))),captured.dumpSha256);
    Object.assign(contexts[kind],captured);
    continue;
  }
  const existing = JSON.parse(fingerprint(kind));
  assert.ok(Object.values(existing).every(x=>x.count===0),'Initial branch must contain no records');
  let source = readFileSync(kind==='shop' ? '/Users/moabot/.config/moa-stage4/shop-schema.sql' : '/Users/moabot/projects/moa-os-express/supabase/bootstrap/20261005_express_recovery.sql','utf8');
  assert.ok(!/net\.http|http_post\s*\(|http_get\s*\(|supabase_functions\.http_request|sk_live_[A-Za-z0-9]/i.test(source));
  source = source.replace(/^\\(?:un)?restrict .*$/gm,'').replace(/^CREATE SCHEMA public;$/m,'CREATE SCHEMA IF NOT EXISTS public;').replace(/^SET transaction_timeout = 0;$/m,'');
  sql(kind,'DROP EXTENSION IF EXISTS pg_net CASCADE; DROP SCHEMA public CASCADE; CREATE SCHEMA public;');
  sql(kind,source);
  sql(kind,'REVOKE ALL ON ALL TABLES IN SCHEMA public FROM PUBLIC,anon,authenticated; REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM PUBLIC,anon,authenticated; GRANT USAGE ON SCHEMA public TO service_role; GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role; GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;');
  const tables = Object.keys(JSON.parse(fingerprint(kind))).length;
  assert.equal(tables,kind==='shop'?14:87);
  contexts[kind].schemaSha256=hash(source);
  mark(kind+': schema restored empty, '+tables+' tables, outbound network extension removed');
  assert.equal(check(await client.storage.listBuckets()).length,0,'Initial storage must be empty');
  check(await client.storage.createBucket(bucket,{public:false,allowedMimeTypes:['image/svg+xml'],fileSizeLimit:1024*1024}));
  check(await client.storage.from(bucket).upload(path,bytes,{contentType:'image/svg+xml',upsert:false}));
}
const approved='EXP-RECOVERY-APPROVED',cancelled='EXP-RECOVERY-CANCELLED';
const sku='00000000-0000-4000-8000-000000000001';
const payment={id:'sandbox-recovery-payment',amountUsd:100.25};
const payload={contact:{contactEmail:'synthetic@example.invalid'},payment};
const op='00000000-0000-4000-8000-000000000002';
const handoff={version:1,stage:'handoff',pack:{pieces:[{skuId:sku,qty:50,spec:'Synthetic recovery fixture',mockups:[contexts.backend.url],proofRound:1,factory:'Synthetic factory'}]},events:[{id:op}]};
if (!recovering) {
sql('backend',`INSERT INTO public.express_orders(order_number,mode,status,paid_at,payload) VALUES
 (${quote(approved)},'sandbox','paid',now(),${json(payload)}),(${quote(cancelled)},'sandbox','paid',now(),${json(payload)});
 SELECT public.reserve_express_cancellation(${quote(cancelled)},'synthetic@example.invalid',${quote(payment.id)});
 SELECT public.update_express_refund(${quote(cancelled)},${quote(payment.id)},'sandbox-recovery-refund','succeeded',100.25);
 INSERT INTO public.express_proof_rounds(express_order_id,round,items) SELECT id,1,${json([{sku_id:sku,decision:'approved',spec:'Synthetic recovery fixture',mockups:[contexts.backend.url]}])} FROM public.express_orders WHERE order_number=${quote(approved)};
 UPDATE public.express_orders SET approved_at=now(),lines=${json([{sku_id:sku,qty:50}])} WHERE order_number=${quote(approved)};`);
sql('backend',`SELECT public.save_express_fulfillment(${quote(approved)},0,${quote(op)},${json(handoff)});`);
sql('shop',`INSERT INTO public.orders(id,order_number,status,data) VALUES
 ('00000000-0000-4000-8000-000000000011',${quote(approved)},'received',${json({mode:'express_sandbox',backendOrderNumber:approved,proof:contexts.backend.url,artwork:contexts.shop.url,payment})}),
 ('00000000-0000-4000-8000-000000000012',${quote(cancelled)},'cancelled',${json({mode:'express_sandbox',backendOrderNumber:cancelled,payment,refundId:'sandbox-recovery-refund'})});
 INSERT INTO public.express_checkout_refunds(checkout_id,order_number,payment_id,mode,amount_cents,status,refund_id,backend_synced_at)
 VALUES ('00000000-0000-4000-8000-000000000012',${quote(cancelled)},${quote(payment.id)},'express_sandbox',10025,'succeeded','sandbox-recovery-refund',now());`);
mark('Synthetic approved proof, handoff, cancellation and exact refund state seeded across both databases');

for (const [kind,c] of Object.entries(contexts)) {
  c.before=fingerprint(kind);
  const dump=command(kind,'pg_dump',['--schema=public','--no-owner','--format=plain']);
  writeFileSync(join(root,kind+'-snapshot.sql'),dump,{mode:0o600,flag:'wx'});
  c.dumpSha256=hash(dump);
  const reader=createClient(c.config.SUPABASE_URL,c.config.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false},global:{fetch:readonlyFetch(c.config.SUPABASE_URL)}});
  c.archive=await backup(reader.storage,kind,[c.bucket],join(root,kind+'-archive'),key,[{id:c.bucket,public:false,allowed_mime_types:['image/svg+xml'],file_size_limit:1024*1024}]);
  assert.equal(c.archive.objectCount,1);
  assert.equal(fingerprint(kind),c.before,'Database changed during file capture');
  writeFileSync(join(root,kind+'-checkpoint.json'),JSON.stringify({before:c.before,dumpSha256:c.dumpSha256,schemaSha256:c.schemaSha256,archive:c.archive}),{mode:0o600,flag:'wx'});
  mark(kind+': SQL snapshot and encrypted proof captured, database remained stable');
}
}
for (const [kind,c] of Object.entries(contexts)) {
  const current=fingerprint(kind);
  assert.ok(current===c.before || recovering && current==='{}','Refusing loss simulation after unexpected writes');
  check(await c.client.storage.from(c.bucket).remove([c.path]));
  assert.equal(sql(kind,`SELECT count(*) FROM storage.objects WHERE bucket_id=${quote(c.bucket)} AND name=${quote(c.path)};`),'0');
  assert.ok((await c.client.storage.from(c.bucket).download(c.path)).error,'File loss must be observable');
  sql(kind,'DROP SCHEMA IF EXISTS public CASCADE;');
  assert.deepEqual(JSON.parse(fingerprint(kind)),{});
  const dump=readFileSync(join(root,kind+'-snapshot.sql'),'utf8');
  assert.equal(hash(dump),c.dumpSha256);
  command(kind,'psql',['-XqAt','-v','ON_ERROR_STOP=1','--single-transaction'],dump);
  assert.equal(fingerprint(kind),c.before,'Restored rows must exactly match captured state');
  await extractArchive(join(root,kind+'-archive'),key,join(root,kind+'-extracted'));
  const manifest=JSON.parse(readFileSync(join(root,kind+'-extracted/recovery-manifest.json')));
  for(const object of manifest.objects){
    const bytes=readFileSync(join(root,kind+'-extracted',object.bucket,object.path));
    assert.equal(hash(bytes),object.sha256);
    check(await c.client.storage.from(object.bucket).upload(object.path,bytes,{contentType:object.mimeType,upsert:false}));
    const restored=Buffer.from(await check(await c.client.storage.from(object.bucket).download(object.path)).arrayBuffer());
    assert.equal(hash(restored),object.sha256);
  }
  const bucket=check(await c.client.storage.getBucket(c.bucket));assert.equal(bucket.public,false);
  for(const role of ['anon','authenticated']){
    const grants=sql(kind,`SELECT count(*) FROM pg_class c JOIN pg_namespace n ON c.relnamespace=n.oid WHERE n.nspname='public' AND c.relkind IN ('r','p','v','m') AND has_table_privilege('${role}',c.oid,'SELECT,INSERT,UPDATE,DELETE');`);
    assert.equal(grants,'0');
  }
  const publicRead=await fetch(c.config.SUPABASE_URL+'/storage/v1/object/public/'+c.bucket+'/'+c.path+'?recoveryCheck='+randomBytes(12).toString('hex'),{cache:'no-store',redirect:'error',signal:AbortSignal.timeout(30000)});
  assert.ok(!publicRead.ok,'Private proof must not become publicly accessible');
  mark(kind+': actual row/file loss restored, all row fingerprints and proof bytes match, private access preserved');
}
assert.deepEqual(JSON.parse(sql('backend',`SELECT public.save_express_fulfillment(${quote(approved)},0,${quote(op)},${json(handoff)});`)),handoff);
const refund=JSON.parse(sql('backend',`SELECT public.update_express_refund(${quote(cancelled)},${quote(payment.id)},'sandbox-recovery-refund','pending',100.25);`));
assert.equal(refund.status,'succeeded');
const shopOrder=JSON.parse(sql('shop',`SELECT data FROM public.orders WHERE order_number=${quote(approved)};`));
const proof=JSON.parse(sql('backend',`SELECT items FROM public.express_proof_rounds WHERE express_order_id=(SELECT id FROM public.express_orders WHERE order_number=${quote(approved)});`));
assert.equal(shopOrder.proof,proof[0].mockups[0]);
assert.equal(shopOrder.artwork,contexts.shop.url);
assert.equal(proof[0].mockups[0],contexts.backend.url);
mark('Restored proof references reconcile across databases and files; handoff replay is idempotent and refund cannot regress');
const evidence={checkedAt:new Date().toISOString(),elapsedSeconds:Math.round((Date.now()-started)/1000),resumedFromVerifiedCapture:recovering,passed,
  branches:Object.entries(contexts).map(([kind,c])=>({kind,ref:refs[kind],tables:Object.keys(JSON.parse(c.before)).length,schemaSha256:c.schemaSha256,snapshotSha256:c.dumpSha256,dataFingerprintSha256:hash(c.before),populatedTables:Object.entries(JSON.parse(c.before)).filter(([,v])=>v.count>0).map(([table,v])=>({table,rows:v.count})),storage:c.archive,restoredObjectSha256:hash(c.bytes)})),
  productionAccess:false,externalMessages:false,paymentProviderAccess:false,cleanupVerified:false,
  limits:['Synthetic logical SQL snapshots, not a production physical backup or PITR restore.','Source branches were quiescent; live recovery must reconcile later payment and file changes.','Production customer data, auth identities, secrets and provider configuration were not copied.']};
writeFileSync(join(root,'result.json'),JSON.stringify(evidence,null,2)+'\n',{mode:0o600});
console.log(JSON.stringify(evidence,null,2));
