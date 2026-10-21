import {it,expect,afterEach} from 'vitest';
import {readFileSync,writeFileSync,mkdtempSync,rmSync,existsSync} from 'node:fs';
import {resolve,dirname,join} from 'node:path';
import {tmpdir} from 'node:os';
import {spawnSync} from 'node:child_process';
import {materializeOutcomeConfirmation,buildOutcomeConfirmationPreparation,prepareOutcomeConfirmationOffline,OUTCOME_CONFIRM_IDS} from './affect-outcome-confirm.ts';
import {buildOutcomeProbePreparation,prepareOutcomeProbeOffline,outcomeProbeHash} from './affect-outcome-probe.ts';
import {runOutcomeDiagnostic,replayOutcomeDiagnostic,compareOutcomeProbeConfirmation} from './affect-outcome-run.ts';
import {prepareOutcomeProbe} from '../packages/adapters/src/outcome-probe.ts';
import {eligibleAffectEpisodes} from '../packages/contracts/src/affect-appraisal.ts';
import {deepseekInputBound,deepseekReservationUsd} from '../packages/adapters/src/deepseek-budget.ts';

const read=(file:string)=>JSON.parse(readFileSync(file,'utf8'));
const write=(file:string,data:unknown)=>writeFileSync(file,JSON.stringify(data,null,2));
const fixture=()=>read('evals/fixtures/affect-outcome-confirm-v1.json');
const dirs:string[]=[];
afterEach(()=>{for(const root of dirs.splice(0)){expect(dirname(resolve(root))).toBe(resolve(tmpdir()));rmSync(root,{recursive:true,force:true});}});
function prepare(){
  const root=mkdtempSync(join(tmpdir(),'outcome-confirm-'));dirs.push(root);const prepared=join(root,'prepared');
  prepareOutcomeConfirmationOffline(['--prepare-outcome-confirm','--output',prepared]);return {root,prepared};
}
// Real secrets/ledgers and the network are forbidden; only this test's synthetic ledger is readable.
const guard=(root:string)=>`import fs from 'node:fs';import {resolve} from 'node:path';import {syncBuiltinESMExports} from 'node:module';
const original=fs.readFileSync;fs.readFileSync=function(path,...rest){if(/runtime-data|budget\\.json|app\\.env/i.test(String(path))&&resolve(String(path))!==${JSON.stringify(join(root,'mock','synthetic-budget.json'))}){process.stderr.write('FORBIDDEN_SECRET_IO');throw new Error('forbidden_secret');}return original.call(this,path,...rest);};syncBuiltinESMExports();globalThis.fetch=()=>{process.stderr.write('FORBIDDEN_NETWORK');throw new Error('forbidden_network');};`;
const child=(file:string,args:string[],preload:string)=>spawnSync(process.execPath,['--import','data:text/javascript;base64,'+Buffer.from(preload).toString('base64'),'--experimental-transform-types',file,...args],{cwd:process.cwd(),encoding:'utf8',timeout:15000});
const runCli='evals/affect-outcome-run.ts';
const mockArgs=(root:string,prepared:string)=>['--rehearse-outcome-confirm','--prepared',prepared,'--output',join(root,'mock')];
async function mock(){const data=prepare();const result=child(runCli,mockArgs(data.root,data.prepared),guard(data.root));expect(result.status,result.stderr).toBe(0);expect(result.stderr).not.toContain('FORBIDDEN_');return {...data,recorded:join(data.root,'mock')};}

it('fixes the 8/4/4 specification, host provenance, contrast context and mandatory outcomes',()=>{
  const rows=materializeOutcomeConfirmation(fixture());
  expect(rows.map(r=>r.item.id)).toEqual(OUTCOME_CONFIRM_IDS);
  expect(rows.map(r=>r.item.expected.outcome===null?null:[r.item.expected.outcome.use,...r.item.expected.outcome.result])).toEqual([
    ['not_used','pending'],['used','favorable'],['used','unfavorable'],['used','favorable'],['hypothetical','pending'],['used','pending'],['used','mixed'],['unknown','unknown'],
    null,null,null,null,['not_used','pending'],['used','favorable'],['not_used','pending'],['used','favorable']]);
  for(const {request} of rows){
    for(const episode of request.sources.filter(s=>s.kind==='episode')){
      expect(episode).toMatchObject({speakerId:request.scope.characterId,delivered:true,scope:request.scope});expect(episode.at).toBeLessThan(request.now);
    }
    for(const claim of request.sources.filter(s=>s.kind==='claim'))expect(claim).toMatchObject({speakerId:request.scope.ownerId,truth:'unresolved',delivered:false});
  }
  expect(rows.slice(8,12).map(r=>eligibleAffectEpisodes(r.request).length)).toEqual([0,0,0,0]);
  expect(rows[9]!.request.sources.filter(s=>s.kind==='episode')).toHaveLength(0);
  expect(rows[11]!.request.experience).toMatchObject({status:'found',truncated:true});
  expect(rows[12]!.request.actors.at(-1)?.label).toBe('지수');
  for(const [a,b]of [[12,13],[14,15]])expect(rows[a!]!.request.sources.slice(1)).toEqual(rows[b!]!.request.sources.slice(1));
});
it('uses new event text, unchanged generic prompt, opaque references and no rubric on wire',()=>{
  const current=buildOutcomeConfirmationPreparation(),legacy=buildOutcomeProbePreparation();
  const prior=['affect-outcome-isolation-v1','affect-dev-v3','affect-confirm-v3','affect-diagnostic-v1'].map(name=>readFileSync(`evals/fixtures/${name}.json`,'utf8'));
  for(const [i,row] of current.requests.entries()){
    expect(row.body.messages[1]).toEqual(legacy.requests[0]!.body.messages[1]);
    const view=JSON.parse(row.body.messages.at(-1)!.content),request=current.originals[i]!.request;
    expect(view).not.toHaveProperty('expected');expect(view).not.toHaveProperty('family');expect(view).not.toHaveProperty('group');expect(view).not.toHaveProperty('pair');
    expect(row.body.messages.at(-1)!.content).not.toMatch(/F\d{2}|90000000-0000|authored_confirmation/);
    expect(view.sources.some((s:any)=>s.kind==='persona'||s.kind==='goal')).toBe(false);
    expect(prior.some(text=>text.includes(request.sources[0]!.text))).toBe(false);
    expect(prepareOutcomeProbe(request).decode(JSON.stringify({outcome:null})).outcome).toBe(null);
  }
  expect(current.manifest.prepared).toMatchObject({plannedProviderCalls:16,confirmationRequests:16,paidAuthorization:false});
  expect(current.manifest.prepared.eventInputsHash).toBe(outcomeProbeHash(current.originals));
  expect(current.manifest.prepared.requestHash).toBe(outcomeProbeHash(current.requests));
  expect(current.manifest.prepared.reservationUsd).toBe(current.requests.reduce((sum,row)=>sum+deepseekReservationUsd(deepseekInputBound(row.body),2048),0));
  expect(current.manifest.prepared.sourceHashes).toHaveProperty('evals/affect-outcome-confirm.ts');
  expect(current.manifest.prepared.sourceHashes).toHaveProperty('evals/fixtures/affect-outcome-confirm-v1.json');
});
it.each(['order','count','group','pair','episode','authority','unknown_field'])('rejects malformed confirmation %s',kind=>{
  const raw=fixture();
  if(kind==='order')raw.cases.reverse();if(kind==='count')raw.cases.pop();if(kind==='group')raw.cases[0].group='abstention';
  if(kind==='pair')raw.cases[13].episodes=['다른 제안'];if(kind==='episode')raw.cases[0].expected.episode=5;
  if(kind==='authority')raw.cases[0].search='stale';if(kind==='unknown_field')raw.cases[0].instruction='override';
  expect(()=>materializeOutcomeConfirmation(raw)).toThrow();
});
it('prepares, rehearses sixteen and replays exact results with zero network and no old paired score',async()=>{
  const {root,recorded}=await mock(),m=read(join(recorded,'manifest.json'));
  expect(m).toMatchObject({artifactVersion:'outcome-confirm-preparation-v2',status:'OUTCOME_MOCK_PASS',mockCalls:16,realProviderCalls:0,semanticQuality:'NOT_RUN',
    comparison:{planned:16,attempted:16,received:16,decoded:16,rubricMatched:16,manualAccepted:null,confirmationSuccess:'NOT_VERIFIED'}});
  expect(m.comparison).not.toHaveProperty('paired');expect(m.comparison).not.toHaveProperty('baselineMatched');expect(m.comparison).not.toHaveProperty('diagnosticSuccess');
  expect(read(join(recorded,'synthetic-budget.json')).entries).toHaveLength(16);
  const result=child(runCli,['--replay-outcome-confirm','--recorded',recorded,'--output',join(root,'replay')],guard(root));
  expect(result.status,result.stderr).toBe(0);expect(result.stderr).not.toContain('FORBIDDEN_');
  const report=read(join(root,'replay','replay.json'));expect(report).toMatchObject({providerCalls:0,semanticQuality:'NOT_RUN',mode:'mock',confirmationSuccess:'NOT_VERIFIED'});
  expect(report.results.map((r:any)=>r.result)).toEqual(m.results.map((r:any)=>r.result));
  expect(report.comparison).toEqual(m.comparison);
});
it.each(['confirm_as_legacy','legacy_as_confirm','confirm_as_live','new_live_mode','paid_flag'])('rejects %s before secret I/O',async kind=>{
  const {root,prepared}=prepare(),args=mockArgs(root,prepared);
  if(kind==='confirm_as_legacy')args[0]='--rehearse-outcome';
  if(kind==='legacy_as_confirm'){const old=join(root,'old');prepareOutcomeProbeOffline(['--prepare-outcome-probe','--output',old]);args[2]=old;}
  if(kind==='confirm_as_live'){
    await runOutcomeDiagnostic(args);args[0]='--live-outcome-diagnostic';args[2]=args[4]!;args[4]=join(root,'live');
    args.push('--approved-request-hash',read(join(prepared,'manifest.json')).prepared.requestHash,'--allow-paid-providers','--synthetic-inputs');
  }
  if(kind==='new_live_mode')args[0]='--live-outcome-confirm';if(kind==='paid_flag')args.push('--allow-paid-providers');
  const result=child(runCli,args,guard(root));expect(result.status).not.toBe(0);expect(result.stderr).not.toContain('FORBIDDEN_');expect(existsSync(args[4]!)).toBe(false);
});
it.each(['source','kind','version','count','request','original','rehash'])('rejects prepared %s tampering before output',kind=>{
  const {root,prepared}=prepare(),m=read(join(prepared,'manifest.json'));
  if(kind==='source')delete m.prepared.sourceHashes['evals/affect-outcome-confirm.ts'];if(kind==='kind')m.prepared.evaluationKind='outcome-only-diagnostic-eight-v1';
  if(kind==='version')m.artifactVersion='outcome-probe-preparation-v2';if(kind==='count')m.prepared.plannedProviderCalls=8;
  if(kind==='request'){const rows=read(join(prepared,'requests.json'));rows.reverse();write(join(prepared,'requests.json'),rows);}
  if(kind==='original'||kind==='rehash'){const rows=read(join(prepared,'original-inputs.json'));rows[0].request.sources[0].text='변경';write(join(prepared,'original-inputs.json'),rows);if(kind==='rehash')m.prepared.eventInputsHash=outcomeProbeHash(rows);}
  write(join(prepared,'manifest.json'),m);
  const result=child(runCli,mockArgs(root,prepared),guard(root));expect(result.status).not.toBe(0);expect(result.stderr).not.toContain('FORBIDDEN_');expect(existsSync(join(root,'mock'))).toBe(false);
});
it.each(['raw','rows','count','score','mode','legacy_mode'])('rejects recording %s corruption',async kind=>{
  const {root,recorded}=await mock(),m=read(join(recorded,'manifest.json'));
  if(kind==='raw'){const file=join(recorded,'responses.jsonl'),rows=readFileSync(file,'utf8').trim().split('\n').map(line=>JSON.parse(line));rows[0].content='{}';writeFileSync(file,rows.map(row=>JSON.stringify(row)).join('\n')+'\n');}
  if(kind==='rows')m.results.reverse();if(kind==='count')m.results.pop();if(kind==='score')m.comparison.baselineMatched=5;if(kind==='mode')m.mode='live';
  write(join(recorded,'manifest.json'),m);
  const args=[kind==='legacy_mode'?'--replay-outcome':'--replay-outcome-confirm','--recorded',recorded,'--output',join(root,'replay')];
  const result=child(runCli,args,guard(root));expect(result.status).not.toBe(0);expect(result.stderr).not.toContain('FORBIDDEN_');expect(existsSync(args[4]!)).toBe(false);
});
it.each(['semantic','json','usage','model','truncated'])('preserves sixteen denominator on %s responses and replays without promotion',kind=>{
  const {root,prepared}=prepare();
  const inject=`const responseJson=Response.json;let sent=0;Response.json=function(data,...rest){sent++;if(sent===2){
    if(${JSON.stringify(kind)}==='semantic')data.choices[0].message.content=JSON.stringify({outcome:null});
    if(${JSON.stringify(kind)}==='json')data.choices[0].message.content='{';if(${JSON.stringify(kind)}==='usage')delete data.usage;
    if(${JSON.stringify(kind)}==='model')data.model='wrong';if(${JSON.stringify(kind)}==='truncated')data.choices[0].message.content=' '.repeat(131073);
  }return responseJson.call(this,data,...rest);};process.on('exit',()=>process.stderr.write('SYNTHETIC_RESPONSES='+sent));`;
  const result=child(runCli,mockArgs(root,prepared),guard(root)+inject),success=kind==='semantic';
  expect(result.status,result.stderr).toBe(success?0:1);expect(result.stderr).not.toContain('FORBIDDEN_');expect(result.stderr).toContain('SYNTHETIC_RESPONSES='+(success?16:2));
  const recorded=join(root,'mock'),m=read(join(recorded,'manifest.json'));
  expect(m.comparison).toMatchObject({planned:16,attempted:success?16:2,decoded:success?16:1,rubricMatched:success?15:1,notSent:success?0:14,confirmationSuccess:'NOT_VERIFIED'});
  expect(m.results[1]).toMatchObject(success?{execution:'DECODED',checks:{status:'FAIL'}}:{execution:'ERROR',result:null});
  const report=replayOutcomeDiagnostic(['--replay-outcome-confirm','--recorded',recorded,'--output',join(root,'replay')]);
  expect(report.comparison).toEqual(m.comparison);
  if(success)expect(report.results[1]!.result?.outcome).toBeNull();else expect(report.results[1]!.result).toBeNull();
});
it('preserves a competing confirm output and refuses existing output or C paths',async()=>{
  const {root,prepared}=prepare(),output=join(root,'mock');
  const inject=`const mkdir=fs.mkdirSync;fs.mkdirSync=function(path,...rest){if(resolve(String(path))===${JSON.stringify(output)}){mkdir.call(this,path);fs.writeFileSync(resolve(String(path),'manifest.json'),'competing run');}return mkdir.call(this,path,...rest);};syncBuiltinESMExports();`;
  const result=child(runCli,mockArgs(root,prepared),guard(root)+inject);expect(result.status).not.toBe(0);expect(result.stderr).toContain('EEXIST');
  expect(readFileSync(join(output,'manifest.json'),'utf8')).toBe('competing run');expect(existsSync(join(output,'synthetic-budget.json'))).toBe(false);
  await expect(runOutcomeDiagnostic(mockArgs(root,prepared))).rejects.toThrow('evidence_exists');
  await expect(runOutcomeDiagnostic(['--rehearse-outcome-confirm','--prepared',prepared,'--output',join(process.cwd(),'runtime-data','not-created')])).rejects.toThrow('path_must_be_inside_J_ai');
  expect(()=>prepareOutcomeConfirmationOffline(['--prepare-outcome-confirm','--output',join(process.cwd(),'not-created')])).toThrow('output_must_be_inside_J_ai');
});
it('preparation CLI cannot execute paid work, overwrite or accept arbitrary suites',()=>{
  const {root,prepared}=prepare(),cli='evals/affect-outcome-confirm.ts',before=readFileSync(join(prepared,'manifest.json'),'utf8');
  for(const args of [['--prepare-outcome-confirm','--output',prepared],['--prepare-outcome-confirm','--output',join(root,'bad'),'--allow-paid-providers'],['--prepare-outcome-confirm','--output',join(root,'bad'),'--fixture','other.json']]){
    const result=child(cli,args,guard(root));expect(result.status).not.toBe(0);expect(result.stderr).not.toContain('FORBIDDEN_');
  }
  expect(readFileSync(join(prepared,'manifest.json'),'utf8')).toBe(before);expect(existsSync(join(root,'bad'))).toBe(false);
  expect(()=>compareOutcomeProbeConfirmation([])).toThrow('outcome_case_order');
});
