import {it,expect,afterEach} from 'vitest';
import {readFileSync,writeFileSync,mkdtempSync,rmSync,existsSync} from 'node:fs';
import {join,dirname,resolve} from 'node:path';
import {tmpdir} from 'node:os';
import {spawnSync} from 'node:child_process';
import {referenceInputs,referenceMetadata,referenceSourceHashes,referenceHash,verifyDeepSeekReferenceRequests} from './affect-reference-artifacts.ts';
import {affectRequest,affectSource,affectNow} from './affect-fixture.ts';
import {authoredReferenceReply} from './affect-reference-fixture.ts';
import {buildEventInterpretationRequest} from '../packages/adapters/src/event-interpreter.ts';
import {deepseekPayload} from '../packages/adapters/src/deepseek.ts';
import {DeepSeekBudget} from '../packages/adapters/src/deepseek-budget.ts';

const dirs:string[]=[];
function directory(){const path=mkdtempSync(join(tmpdir(),'refs-artifacts-'));dirs.push(path);return path;}
afterEach(()=>{for(const path of dirs.splice(0)){expect(dirname(resolve(path))).toBe(resolve(tmpdir()));rmSync(path,{recursive:true,force:true});}});
const write=(path:string,data:unknown)=>writeFileSync(path,JSON.stringify(data,null,2));
const read=(path:string)=>JSON.parse(readFileSync(path,'utf8'));
function scene(){
  const request=affectRequest();request.experience.status='ambiguous';request.sources.push(affectSource(7,'episode','숨긴 후보',affectNow-1000));
  const inputs=referenceInputs([{id:'R1',request}]),requests=[{id:'R1',body:deepseekPayload(buildEventInterpretationRequest(request,'refs-v1'),2048)}];
  const prepared={provider:'deepseek',syntheticOnly:true,...referenceMetadata(inputs),sourceHashes:referenceSourceHashes(),requestHash:referenceHash(requests.map(r=>JSON.stringify(r.body)).sort())};
  return {request,inputs,requests,prepared};
}
const guardScript=`import fs from 'node:fs';import {syncBuiltinESMExports} from 'node:module';const original=fs.readFileSync;fs.readFileSync=function(path,...rest){if(/runtime-data|budget\\.json|app\\.env/i.test(String(path))){process.stderr.write('FORBIDDEN_SECRET_IO');throw new Error('forbidden_secret_io');}return original.call(this,path,...rest);};syncBuiltinESMExports();globalThis.fetch=()=>{process.stderr.write('FORBIDDEN_NETWORK');throw new Error('forbidden_network');};`;
function run(file:string,args:string[],guard=guardScript){return spawnSync(process.execPath,['--import','data:text/javascript;base64,'+Buffer.from(guard).toString('base64'),'--experimental-transform-types',file,...args],{cwd:process.cwd(),encoding:'utf8',timeout:15000});}
function recorded(){
  const data=scene(),root=directory();write(join(root,'manifest.json'),{prepared:data.prepared,results:[{id:'R1',checks:{status:'captured-authored-only'}}]});
  write(join(root,'event-inputs.json'),data.inputs);write(join(root,'requests.json'),data.requests);
  const content=JSON.stringify(authoredReferenceReply(JSON.parse(data.requests[0]!.body.messages.at(-1)!.content)));
  writeFileSync(join(root,'responses.jsonl'),JSON.stringify({caseId:'R1',content,truncated:false})+'\n');return {root,...data};
}
it('records original hidden candidates and validates deterministic wire regeneration',()=>{
  const {inputs,requests,prepared}=scene();expect(inputs[0]!.request.sources.some(s=>s.kind==='episode')).toBe(true);
  expect(JSON.stringify(requests)).not.toContain('숨긴 후보');expect(verifyDeepSeekReferenceRequests(prepared,inputs,requests)).toEqual(inputs);
});
it.each(['snapshot','rehash_snapshot','codec','prompt','wire_version','source','wire','duplicate','missing_row'])('rejects %s artifact drift without guessing from current fixtures',kind=>{
  const {inputs,requests,prepared}=scene();
  if(kind==='snapshot'||kind==='rehash_snapshot')inputs[0]!.request.sources[0]!.text='기록 뒤 변경';
  if(kind==='rehash_snapshot')prepared.eventInputsHash=referenceHash(inputs);
  if(kind==='codec')(prepared as any).codecVersion='new';if(kind==='prompt')prepared.promptVersion='new';if(kind==='wire_version')(prepared as any).wireFormat='guess';
  if(kind==='source')prepared.sourceHashes['packages/adapters/src/event-reference-codec.ts']='bad';
  if(kind==='wire')requests[0]!.body.messages.at(-1)!.content='{}';
  if(kind==='duplicate'){inputs.push(inputs[0]!);prepared.eventInputsHash=referenceHash(inputs);}
  if(kind==='missing_row')requests.pop();
  expect(()=>verifyDeepSeekReferenceRequests(prepared,inputs,requests)).toThrow();
});
it('offline replay restores the original UUID snapshot and keeps recorded checks separate',()=>{
  const {root,request}=recorded(),out=join(root,'replayed');
  const result=run('evals/affect-deepseek-replay.ts',['--recorded',root,'--output',out]);expect(result.status,result.stderr).toBe(0);
  const report=read(join(out,'replay.json'));expect(report).toMatchObject({providerCalls:0,inputScope:'recorded_original_snapshot',wireFormat:'refs-v1'});
  expect(report.results[0]).toMatchObject({status:'REPLAYED',recordedChecks:{status:'captured-authored-only'},result:{status:'interpreted',interpretation:authoredReferenceReply(request)}});
});
it('refs replay refuses a missing original and never falls back to the wire input',()=>{
  const {root}=recorded();rmSync(join(root,'event-inputs.json'));
  const result=run('evals/affect-deepseek-replay.ts',['--recorded',root,'--output',join(root,'replayed')]);expect(result.status).not.toBe(0);expect(existsSync(join(root,'replayed'))).toBe(false);
});
it('legacy UUID preserves the actual D09 failure and labels its visible-input limit',()=>{
  const fixture=JSON.parse(readFileSync(new URL('./fixtures/affect-diagnostic-regression-v1.json',import.meta.url),'utf8')),row=fixture.cases.find((r:any)=>r.id==='D09'),root=directory();
  write(join(root,'manifest.json'),{prepared:{provider:'deepseek',syntheticOnly:true},results:[{id:row.id,checks:row.originalChecks}]});
  write(join(root,'requests.json'),[{id:row.id,body:deepseekPayload(buildEventInterpretationRequest(row.request),2048)}]);
  writeFileSync(join(root,'responses.jsonl'),JSON.stringify({caseId:row.id,content:row.raw,truncated:false})+'\n');
  const out=join(root,'replayed'),result=run('evals/affect-deepseek-replay.ts',['--recorded',root,'--output',out]);expect(result.status,result.stderr).toBe(0);
  const report=read(join(out,'replay.json'));expect(report.inputScope).toBe('legacy_wire_visible_input_only');
  expect(report.results[0]).toMatchObject({recordedChecks:row.originalChecks,result:{status:'unavailable',reason:'invalid_output'}});
});
it.each(['deepseek','openai'])('%s explicit refs live is rejected before filesystem secrets or HTTP',provider=>{
  const file=provider==='deepseek'?'evals/affect-deepseek.ts':'evals/affect-live.ts';
  const result=run(file,['--live-dev','--wire-format','refs-v1']);
  expect(result.status).not.toBe(0);expect(result.stderr).toContain('reference_live_not_authorized');expect(result.stderr).not.toContain('FORBIDDEN_');
});
it.each(['deepseek','openai'])('%s refs manifest is rejected before key/ledger even without a CLI refs flag',provider=>{
  const root=directory();write(join(root,'manifest.json'),provider==='deepseek'?{prepared:{wireFormat:'refs-v1'}}:{wireFormat:'refs-v1'});
  const args=provider==='deepseek'?['--live-diagnostic','--output',join(root,'out'),'--prepared',root,'--allow-paid-providers','--synthetic-inputs']:
    ['--live-dev','--prepared',root,'--approved-total-usd','1','--output',join(root,'out'),'--allow-paid-providers','--synthetic-inputs'];
  const result=run(provider==='deepseek'?'evals/affect-deepseek.ts':'evals/affect-live.ts',args);
  expect(result.status).not.toBe(0);expect(result.stderr).toContain('reference_live_not_authorized');expect(result.stderr).not.toContain('FORBIDDEN_');
});
it('new source metadata cannot bypass the unchanged UUID diagnostic attempt identity',()=>{
  const root=directory(),prepared=join(root,'prepared');
  const mock=run('evals/affect-deepseek.ts',['--prepare-diagnostic','--output',prepared],`globalThis.fetch=()=>{throw new Error('FORBIDDEN_NETWORK');};`);
  expect(mock.status,mock.stderr).toBe(0);const manifest=read(join(prepared,'manifest.json'));
  expect(manifest.prepared.requestHash).toBe('23268ba53b10308d72e34c10f24dcbfa5bd4cab266fc5e9f95763aebe25bae4b');
  const ledger=join(root,'test-ledger.json'),budget=new DeepSeekBudget(ledger,.2,36,`test; O1 DeepSeek diagnostic ${manifest.prepared.requestHash}`);
  budget.finish(budget.reserve(1000,2048),{prompt_tokens:1000,completion_tokens:100});const before=readFileSync(ledger,'utf8');
  const config=`LOCAL_ONLY=false\nALLOW_PAID_PROVIDERS=true\nDEEPSEEK_API_KEY=synthetic-no-network\nDEEPSEEK_BUDGET_AUTHORIZATION=synthetic scope\nDEEPSEEK_BUDGET_PATH=${ledger.replaceAll('\\','/')}\nDEEPSEEK_BUDGET_USD=0.20\nDEEPSEEK_MAX_CALLS=36\n`;
  const guard=`import fs from 'node:fs';import {syncBuiltinESMExports} from 'node:module';const original=fs.readFileSync;fs.readFileSync=function(path,...rest){if(String(path)==='runtime-data/deepseek.env')return ${JSON.stringify(config)};if(/runtime-data|budget\\.json|app\\.env/i.test(String(path)))throw new Error('FORBIDDEN_SECRET_IO');return original.call(this,path,...rest);};syncBuiltinESMExports();globalThis.fetch=()=>{throw new Error('FORBIDDEN_NETWORK');};`;
  const result=run('evals/affect-deepseek.ts',['--live-diagnostic','--output',join(root,'live'),'--prepared',prepared,'--allow-paid-providers','--synthetic-inputs'],guard);
  expect(result.status).not.toBe(0);expect(result.stderr).toContain('dev_attempt_already_recorded');expect(result.stderr).not.toContain('FORBIDDEN_');
  expect(readFileSync(ledger,'utf8')).toBe(before);expect(existsSync(ledger+'.o1-dev.lock')).toBe(false);
});

const refsHash='952a8661bc547c89cc2fee408e0ae64e0ee7964ad6c22927adb1b3b443776545';
function prepareReferences(){
  const root=directory(),prepared=join(root,'prepared');
  const result=run('evals/affect-deepseek.ts',['--prepare-diagnostic','--output',prepared,'--wire-format','refs-v1'],
    guardScript.replace('runtime-data|budget\\.json|app\\.env','runtime-data|app\\.env'));
  expect(result.status,result.stderr).toBe(0);expect(read(join(prepared,'manifest.json')).prepared.requestHash).toBe(refsHash);
  return {root,prepared};
}
function referenceLiveArgs(root:string,prepared:string){return ['--live-reference-diagnostic','--output',join(root,'live'),'--prepared',prepared,
  '--wire-format','refs-v1','--approved-request-hash',refsHash,'--allow-paid-providers','--synthetic-inputs'];}
function fakeLive(root:string,failure='none'){
  const ledger=join(root,'test-ledger.json'),budget=new DeepSeekBudget(ledger,.2,36,'historical synthetic');
  budget.finish(budget.reserve(1000,2048),{prompt_tokens:1000,completion_tokens:100});const historical=read(ledger).entries;
  const config=`LOCAL_ONLY=false\nALLOW_PAID_PROVIDERS=true\nDEEPSEEK_API_KEY=synthetic-no-network\nDEEPSEEK_BUDGET_AUTHORIZATION=synthetic refs diagnostic\nDEEPSEEK_BUDGET_PATH=${ledger.replaceAll('\\','/')}\nDEEPSEEK_BUDGET_USD=0.20\nDEEPSEEK_MAX_CALLS=36\n`;
  const counter=join(root,'http-count.json');
  const guard=`import fs from 'node:fs';import {syncBuiltinESMExports} from 'node:module';import {authoredReferenceReply} from ${JSON.stringify(new URL('./affect-reference-fixture.ts',import.meta.url).href)};
    const original=fs.readFileSync;fs.readFileSync=function(path,...rest){if(String(path)==='runtime-data/deepseek.env')return ${JSON.stringify(config)};if(/runtime-data|budget\\.json|app\\.env/i.test(String(path)))throw new Error('FORBIDDEN_SECRET_IO');return original.call(this,path,...rest);};syncBuiltinESMExports();
    let calls=0;globalThis.fetch=async(url,init)=>{if(String(url)!=='https://api.deepseek.com/chat/completions')throw new Error('FORBIDDEN_NETWORK');
      fs.writeFileSync(${JSON.stringify(counter)},JSON.stringify(++calls));
      const reply=authoredReferenceReply(JSON.parse(JSON.parse(init.body).messages.at(-1).content));
      if(reply.appraisals.length)reply.appraisals[0].relevance=.123;
      if(calls===2&&${JSON.stringify(failure)}==='malformed')reply.appraisals[0].concern.source.sourceId='r999';
      if(calls===2&&${JSON.stringify(failure)}==='http')return Response.json({},{status:503});
      return Response.json({model:'deepseek-flash',usage:calls===2&&${JSON.stringify(failure)}==='usage'?null:{prompt_tokens:1000,completion_tokens:100},choices:[{finish_reason:'stop',message:{role:'assistant',content:JSON.stringify(reply)}}]});};`;
  return {ledger,historical,counter,guard};
}
it('reference live rejects missing/wrong authorization flags before any secret read',()=>{
  const {root,prepared}=prepareReferences();
  for(const variant of ['missing_hash','wrong_hash','missing_format','uuid','missing_paid','missing_synthetic','duplicate_hash']){
    const args=referenceLiveArgs(root,prepared),drop=(name:string,n:number)=>args.splice(args.indexOf(name),n);
    if(variant==='missing_hash')drop('--approved-request-hash',2);
    if(variant==='wrong_hash')args[args.indexOf('--approved-request-hash')+1]='0'.repeat(64);
    if(variant==='missing_format')drop('--wire-format',2);
    if(variant==='uuid')args[args.indexOf('--wire-format')+1]='uuid-v3';
    if(variant==='missing_paid')drop('--allow-paid-providers',1);
    if(variant==='missing_synthetic')drop('--synthetic-inputs',1);
    if(variant==='duplicate_hash')args.push('--approved-request-hash',refsHash);
    const result=run('evals/affect-deepseek.ts',args);expect(result.status,variant).not.toBe(0);
    expect(result.stderr,variant).not.toContain('FORBIDDEN_');expect(existsSync(join(root,'live'))).toBe(false);
  }
});
it('reference live rejects stale preparation, wrong scope and tampered original/wire before secrets',()=>{
  const {root,prepared}=prepareReferences(),paths=['manifest.json','event-inputs.json','requests.json'];
  const originals=paths.map(name=>readFileSync(join(prepared,name),'utf8'));
  for(const variant of ['source','scope','count','original','wire','request_id','missing_original']){
    paths.forEach((name,i)=>writeFileSync(join(prepared,name),originals[i]!));
    const manifest=read(join(prepared,'manifest.json'));
    if(variant==='source')manifest.prepared.sourceHashes['evals/affect-deepseek.ts']='stale';
    if(variant==='scope')manifest.prepared.evaluationKind='development-thirty';
    if(variant==='count')manifest.prepared.generationCalls=30;
    write(join(prepared,'manifest.json'),manifest);
    if(variant==='original'){const rows=read(join(prepared,'event-inputs.json'));rows[0].request.sources[0].text='changed';write(join(prepared,'event-inputs.json'),rows);}
    if(variant==='wire'||variant==='request_id'){const rows=read(join(prepared,'requests.json'));if(variant==='wire')rows[0].body.messages.at(-1).content='{}';else rows[0].id='wrong';write(join(prepared,'requests.json'),rows);}
    if(variant==='missing_original')rmSync(join(prepared,'event-inputs.json'));
    const result=run('evals/affect-deepseek.ts',referenceLiveArgs(root,prepared));expect(result.status,variant).not.toBe(0);
    expect(result.stderr,variant).not.toContain('FORBIDDEN_');expect(existsSync(join(root,'live'))).toBe(false);
  }
});
it('reference live mock accepts non-fixture valid responses, preserves history and blocks the same attempt',()=>{
  const {root,prepared}=prepareReferences(),fake=fakeLive(root);
  const result=run('evals/affect-deepseek.ts',referenceLiveArgs(root,prepared),fake.guard);expect(result.status,result.stderr).toBe(0);
  const manifest=read(join(root,'live','manifest.json'));
  expect(manifest).toMatchObject({status:'SEMANTIC_REVIEW_REQUIRED',realProviderCalls:8,summary:{attempts:9,unresolvedEntries:0,limitUsd:.2}});
  expect(manifest.results).toHaveLength(8);expect(manifest.results[0].result.interpretation.appraisals[0].relevance).toBe(.123);
  expect(manifest.results.some((r:any)=>r.checks.status==='FAIL')).toBe(true);expect(read(fake.counter)).toBe(8);
  expect(read(fake.ledger).entries.slice(0,1)).toEqual(fake.historical);expect(existsSync(fake.ledger+'.o1-dev.lock')).toBe(false);
  const before=readFileSync(fake.ledger,'utf8'),args=referenceLiveArgs(root,prepared);args[2]=join(root,'repeat');
  const duplicate=run('evals/affect-deepseek.ts',args,fake.guard);expect(duplicate.stderr).toContain('dev_attempt_already_recorded');
  expect(readFileSync(fake.ledger,'utf8')).toBe(before);expect(read(fake.counter)).toBe(8);
  const replay=run('evals/affect-deepseek-replay.ts',['--recorded',join(root,'live'),'--output',join(root,'replayed')]);expect(replay.status,replay.stderr).toBe(0);
  expect(read(join(root,'replayed','replay.json')).results.map((r:any)=>r.result)).toEqual(manifest.results.map((r:any)=>r.result));
});
it.each(['malformed','http','usage'])('reference live mock stops after %s without retries or dropping unknown reservations',failure=>{
  const {root,prepared}=prepareReferences(),fake=fakeLive(root,failure);
  const result=run('evals/affect-deepseek.ts',referenceLiveArgs(root,prepared),fake.guard);expect(result.status).not.toBe(0);
  expect(result.stderr).not.toContain('FORBIDDEN_');expect(read(fake.counter)).toBe(2);
  const manifest=read(join(root,'live','manifest.json'));expect(manifest).toMatchObject({status:'STOPPED',realProviderCalls:2,summary:{attempts:3,unresolvedEntries:failure==='malformed'?0:1}});
  expect(read(fake.ledger).entries.slice(0,1)).toEqual(fake.historical);expect(existsSync(fake.ledger+'.o1-dev.lock')).toBe(false);
  if(failure!=='malformed'){expect(read(fake.ledger).entries.at(-1)).toMatchObject({status:'unknown',maxOutputTokens:2048});expect(read(fake.ledger).entries.at(-1).usd).toBeGreaterThan(.00042);}
});
