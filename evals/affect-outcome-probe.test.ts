import {it,expect,afterEach} from 'vitest';
import {readFileSync,mkdtempSync,rmSync,existsSync,readdirSync} from 'node:fs';
import {join,dirname,resolve} from 'node:path';
import {tmpdir} from 'node:os';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {StructuredEventInterpreter} from '../packages/adapters/src/event-interpreter.ts';
import {materializeAffectDiagnostic} from './affect-diagnostic.ts';
import {validateAffectSuites,checkAffectCandidate} from './affect-cases.ts';
import {materializeOutcomeIsolation} from './affect-outcome-probe.ts';

const read=(file:string|URL)=>JSON.parse(readFileSync(file,'utf8'));
const fixture=(name:string)=>read(new URL(`fixtures/${name}.json`,import.meta.url));
const hash=(value:unknown)=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const dirs:string[]=[];
const directory=()=>{const root=mkdtempSync(join(tmpdir(),'outcome-probe-'));dirs.push(root);return root;};
afterEach(()=>{for(const root of dirs.splice(0)){expect(dirname(resolve(root))).toBe(resolve(tmpdir()));rmSync(root,{recursive:true,force:true});}});
const guard=`import fs from 'node:fs';import {syncBuiltinESMExports} from 'node:module';const original=fs.readFileSync;fs.readFileSync=function(path,...rest){if(/runtime-data|budget\\.json|app\\.env/i.test(String(path))){process.stderr.write('FORBIDDEN_SECRET_IO');throw new Error('forbidden_secret_io');}return original.call(this,path,...rest);};syncBuiltinESMExports();globalThis.fetch=()=>{process.stderr.write('FORBIDDEN_NETWORK');throw new Error('forbidden_network');};`;
const run=(file:string,args:string[])=>spawnSync(process.execPath,['--import','data:text/javascript;base64,'+Buffer.from(guard).toString('base64'),'--experimental-transform-types',file,...args],{cwd:process.cwd(),encoding:'utf8',timeout:15000});
const cli='evals/affect-outcome-probe.ts';

it('freezes all eight original full-task raw responses and their four overall/three outcome failures',async()=>{
  const captured=fixture('affect-outcome-isolation-regression-v1');
  expect(captured).toMatchObject({syntheticOnly:true,origin:'refs-deepseek-live-r1',wireFormat:'refs-v1',promptVersion:'event-interpretation-v3-refs1'});
  const suite=validateAffectSuites(fixture('affect-dev-v3'),fixture('affect-confirm-v3')).dev;
  const diagnostic=materializeAffectDiagnostic(suite,fixture('affect-diagnostic-v1'));
  expect(captured.cases.map((r:any)=>r.id)).toEqual(diagnostic.map(r=>r.item.id));
  const overall:string[]=[],outcome:string[]=[];
  for(const row of captured.cases){
    expect(createHash('sha256').update(row.raw).digest('hex')).toBe(row.rawSha256);
    const item=diagnostic.find(r=>r.item.id===row.id)!;expect(row.request).toEqual(item.request);
    // Deliberately the historical FULL-task codec, never the new probe mapping.
    const result=await new StructuredEventInterpreter(async()=>row.raw,undefined,'refs-v1').interpret(row.request);
    const checks=checkAffectCandidate(item.item,row.request,result);expect(checks).toEqual(row.originalChecks);
    if(checks.status==='FAIL')overall.push(row.id);if(checks.scopes.outcome==='FAIL')outcome.push(row.id);
  }
  expect(overall).toEqual(['D02','D09','D12','P02']);expect(outcome).toEqual(['D02','D09','P02']);
});
it('keeps 24 authored scenes balanced and distinct from recorded model failures',()=>{
  const raw=fixture('affect-outcome-isolation-v1'),rows=materializeOutcomeIsolation(raw);
  expect(raw.origin).toBe('authored_contract_contrasts_not_model_outputs');expect(rows).toHaveLength(24);
  expect(new Set(rows.map(r=>r.item.family)).size).toBe(6);expect(new Set(rows.map(r=>r.item.input)).size).toBe(24);
  expect(rows.some(r=>r.item.expected===null)).toBe(true);expect(new Set(rows.flatMap(r=>r.item.expected?[r.item.expected.use]:[])).size).toBe(4);
  expect(rows.some(r=>r.item.expected?.result==='mixed')).toBe(true);
  expect(rows.filter(r=>r.item.history?.length)).toHaveLength(4);
});
it('prepares original snapshots and exact candidate wire with no HTTP, key or ledger',()=>{
  const root=directory(),out=join(root,'prepared'),result=run(cli,['--prepare-outcome-probe','--output',out]);
  expect(result.status,result.stderr).toBe(0);expect(result.stderr).not.toContain('FORBIDDEN_');
  expect(readdirSync(out).sort()).toEqual(['authored-results.json','manifest.json','original-inputs.json','requests.json']);
  const manifest=read(join(out,'manifest.json')),inputs=read(join(out,'original-inputs.json')),requests=read(join(out,'requests.json'));
  expect(manifest).toMatchObject({status:'OUTCOME_OFFLINE_PREPARED',providerCalls:0,modelInferences:0,semanticQuality:'NOT_RUN',
    artifactVersion:'outcome-probe-preparation-v2',prepared:{taskKind:'outcome-only-diagnostic-v1',wireFormat:'refs-v1',promptVersion:'outcome-probe-v1',paidAuthorization:false,authoredScenes:24,plannedProviderCalls:8,diagnosticRequests:8,provider:'deepseek',model:'deepseek-flash'}});
  expect(inputs).toHaveLength(8);expect(requests).toHaveLength(8);expect(read(join(out,'authored-results.json'))).toHaveLength(8);
  expect(manifest.prepared.eventInputsHash).toBe(hash(inputs));expect(manifest.prepared.requestHash).toBe(hash(requests));
  for(const [file,digest] of Object.entries(manifest.prepared.sourceHashes))expect(createHash('sha256').update(readFileSync(file)).digest('hex')).toBe(digest);
  for(let i=0;i<8;i++){
    expect(inputs[i].request.sources.some((s:any)=>s.kind==='persona')).toBe(true);
    const user=JSON.parse(requests[i].body.messages.at(-1).content);
    expect(user.sources.some((s:any)=>s.kind==='persona'||s.kind==='goal')).toBe(false);
    for(const field of ['currentAffect','stateSourceRefs','expected','family'])expect(user).not.toHaveProperty(field);
    const schema=JSON.parse(requests[i].body.messages[0].content.split('\n').slice(1).join('\n'));
    expect(Object.keys(schema.properties)).toEqual(['outcome']);
  }
  const before=readFileSync(join(out,'manifest.json'),'utf8'),again=run(cli,['--prepare-outcome-probe','--output',out]);
  expect(again.status).not.toBe(0);expect(again.stderr).toContain('evidence_exists');expect(readFileSync(join(out,'manifest.json'),'utf8')).toBe(before);
});
it.each(['--live-dev','--live-reference-diagnostic','--allow-paid-providers','--synthetic-inputs','--wire-format'])('offline CLI rejects %s and never opens a paid path',flag=>{
  const root=directory(),out=join(root,'bad');
  const args=flag.startsWith('--live')?[flag,'--output',out]:['--prepare-outcome-probe','--output',out,flag];
  const result=run(cli,args);expect(result.status).not.toBe(0);expect(result.stderr).not.toContain('FORBIDDEN_');expect(existsSync(out)).toBe(false);
});
it('refuses output on C before writing evidence',()=>{
  const result=run(cli,['--prepare-outcome-probe','--output',join(process.cwd(),'runtime-data','outcome-not-created')]);
  expect(result.status).not.toBe(0);expect(result.stderr).toContain('output_must_be_inside_J_ai');expect(result.stderr).not.toContain('FORBIDDEN_');
});
it.each(['deepseek_uuid','deepseek_refs','openai'])('%s live consumer rejects the experimental manifest before secrets',consumer=>{
  const root=directory(),prepared=join(root,'prepared'),prep=run(cli,['--prepare-outcome-probe','--output',prepared]);expect(prep.status,prep.stderr).toBe(0);
  const out=join(root,'live');let args:string[],file='evals/affect-deepseek.ts';
  if(consumer==='openai'){file='evals/affect-live.ts';args=['--live-dev','--prepared',prepared,'--approved-total-usd','.2','--output',out,'--allow-paid-providers','--synthetic-inputs'];}
  else if(consumer==='deepseek_uuid')args=['--live-diagnostic','--output',out,'--prepared',prepared,'--allow-paid-providers','--synthetic-inputs'];
  else args=['--live-reference-diagnostic','--output',out,'--prepared',prepared,'--wire-format','refs-v1','--approved-request-hash','952a8661bc547c89cc2fee408e0ae64e0ee7964ad6c22927adb1b3b443776545','--allow-paid-providers','--synthetic-inputs'];
  const result=run(file,args);expect(result.status).not.toBe(0);expect(result.stderr).not.toContain('FORBIDDEN_');expect(existsSync(out)).toBe(false);
});
