import {it,expect,afterEach,vi} from 'vitest';
import {readFileSync,writeFileSync,mkdtempSync,rmSync,existsSync} from 'node:fs';
import {resolve,dirname,join} from 'node:path';
import {tmpdir} from 'node:os';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {prepareOutcomeProbeOffline,buildOutcomeProbePreparation} from './affect-outcome-probe.ts';
import {runOutcomeDiagnostic,replayOutcomeDiagnostic,checkOutcomeProbeCandidate,compareOutcomeProbeDiagnostic} from './affect-outcome-run.ts';
import {StructuredEventInterpreter} from '../packages/adapters/src/event-interpreter.ts';
import {OUTCOME_PROBE_TASK,OUTCOME_PROBE_VERSION} from '../packages/adapters/src/outcome-probe.ts';
import {DeepSeekBudget} from '../packages/adapters/src/deepseek-budget.ts';
import {prepareOutcomeConfirmationOffline} from './affect-outcome-confirm.ts';

const dirs:string[]=[];
const read=(file:string)=>JSON.parse(readFileSync(file,'utf8'));
const write=(file:string,data:unknown)=>writeFileSync(file,JSON.stringify(data,null,2));
const jsonLines=(file:string)=>readFileSync(file,'utf8').trim().split(/\r?\n/).filter(Boolean).map(line=>JSON.parse(line));
const writeLines=(file:string,rows:unknown[])=>writeFileSync(file,rows.map(r=>JSON.stringify(r)).join('\n')+'\n');
afterEach(()=>{for(const root of dirs.splice(0)){expect(dirname(resolve(root))).toBe(resolve(tmpdir()));rmSync(root,{recursive:true,force:true});}vi.unstubAllGlobals();});
function prepare(confirm=false){
  const root=mkdtempSync(join(tmpdir(),'outcome-run-'));dirs.push(root);const prepared=join(root,'prepared');
  if(confirm)prepareOutcomeConfirmationOffline(['--prepare-outcome-confirm','--output',prepared]);
  else prepareOutcomeProbeOffline(['--prepare-outcome-probe','--output',prepared]);return {root,prepared};
}
async function mock(confirm=false){
  const data=prepare(confirm),prepared=join(data.root,'mock');
  vi.stubGlobal('fetch',vi.fn(()=>{throw new Error('FORBIDDEN_NETWORK');}));
  const manifest=await runOutcomeDiagnostic([confirm?'--rehearse-outcome-confirm':'--rehearse-outcome','--prepared',data.prepared,'--output',prepared]);
  expect(globalThis.fetch).not.toHaveBeenCalled();return {...data,offline:data.prepared,prepared,manifest};
}
const cli='evals/affect-outcome-run.ts';
const guard=`import fs from 'node:fs';import {syncBuiltinESMExports} from 'node:module';const original=fs.readFileSync;fs.readFileSync=function(path,...rest){if(/runtime-data|budget\\.json|app\\.env/i.test(String(path))){process.stderr.write('FORBIDDEN_SECRET_IO');throw new Error('forbidden_secret');}return original.call(this,path,...rest);};syncBuiltinESMExports();globalThis.fetch=()=>{process.stderr.write('FORBIDDEN_NETWORK');throw new Error('forbidden_network');};`;
const child=(args:string[],preload=guard)=>spawnSync(process.execPath,['--import','data:text/javascript;base64,'+Buffer.from(preload).toString('base64'),'--experimental-transform-types',cli,...args],{cwd:process.cwd(),encoding:'utf8',timeout:15000});
const liveArgs=(root:string,prepared:string)=>['--live-outcome-diagnostic','--prepared',prepared,'--output',join(root,'live'),'--approved-request-hash',read(join(prepared,'manifest.json')).prepared.requestHash,'--allow-paid-providers','--synthetic-inputs'];
function fakeLive(root:string,failure='',patch:{limit?:number;calls?:number;key?:string;history?:number}={}){
  const ledger=join(root,'test-ledger.json'),limit=patch.limit??.2,calls=patch.calls??36;
  const budget=new DeepSeekBudget(ledger,limit,calls,'synthetic historical entry');
  for(let i=0;i<(patch.history??1);i++)budget.finish(budget.reserve(1000,2048),{prompt_tokens:100,completion_tokens:10});
  const config=`LOCAL_ONLY=false\nALLOW_PAID_PROVIDERS=true\nDEEPSEEK_API_KEY="${patch.key??'synthetic-outcome-key'}"\nDEEPSEEK_BUDGET_AUTHORIZATION=synthetic test only\nDEEPSEEK_BUDGET_PATH=${ledger.replaceAll('\\','/')}\nDEEPSEEK_BUDGET_USD=${limit}\nDEEPSEEK_MAX_CALLS=${calls}\n`;
  const preload=`import fs from 'node:fs';import {syncBuiltinESMExports} from 'node:module';const original=fs.readFileSync;fs.readFileSync=function(path,...rest){if(String(path)==='runtime-data/deepseek.env')return ${JSON.stringify(config)};if(/runtime-data|budget\\.json|app\\.env/i.test(String(path)))throw new Error('FORBIDDEN_SECRET_IO');return original.call(this,path,...rest);};syncBuiltinESMExports();
  let calls=0;const failure=${JSON.stringify(failure)};const realTimeout=globalThis.setTimeout;if(failure==='timeout')globalThis.setTimeout=(fn,ms,...rest)=>realTimeout(fn,ms===60000?5:ms,...rest);
  globalThis.fetch=async(_url,init)=>{calls++;let content=JSON.stringify({outcome:null});const data={model:'deepseek-flash',usage:{prompt_tokens:100,completion_tokens:10},choices:[{finish_reason:'stop',message:{role:'assistant',content}}]};
  if(calls===2){if(failure==='http')return Response.json({error:'private server error'},{status:402});if(failure==='usage')delete data.usage;
  if(failure==='json')data.choices[0].message.content='{';if(failure==='reference'){const v=JSON.parse(JSON.parse(init.body).messages.at(-1).content);const input=v.sources.find(s=>s.id===v.eventId),episode=v.sources.find(s=>s.kind==='episode');data.choices[0].message.content=JSON.stringify({outcome:{episodeId:'r999',use:'used',result:'pending',evidence:[input,episode].map(s=>({sourceId:s.id,revision:s.revision,quote:s.text}))}});}
  if(failure==='model')data.model='wrong';if(failure==='finish')data.choices[0].finish_reason='length';if(failure==='truncated')data.choices[0].message.content=' '.repeat(131073);
  if(failure==='timeout')await new Promise(r=>realTimeout(r,25));}
  return Response.json(data);};process.on('exit',()=>process.stderr.write('FAKE_HTTP_COUNT='+calls));`;
  return {preload,ledger,history:read(ledger).entries[0]};
}

it.each(['mock','live'])('R4B-AUDIT-OUTPUT preserves a competing %s output after preflight',async mode=>{
  const {root,prepared,offline}=await mock(),fake=mode==='live'?fakeLive(root):null;
  const output=join(root,'collision'),args=mode==='live'?liveArgs(root,prepared):['--rehearse-outcome','--prepared',offline,'--output',output];args[4]=output;
  const sentinels={'manifest.json':'other run manifest','results.jsonl':'other run results','responses.jsonl':'other run raw',
    'synthetic-budget.json':JSON.stringify({version:1,provider:'deepseek',model:'deepseek-flash',inputUsdPerMillion:.3,outputUsdPerMillion:1.2,limitUsd:.2,entries:[]})};
  const before=fake?readFileSync(fake.ledger,'utf8'):null;
  // Deterministically insert a competing creator between the check and mkdir.
  const inject=`import {resolve as raceResolve,dirname as raceDirname} from 'node:path';
  const output=${JSON.stringify(output)},sentinels=${JSON.stringify(sentinels)},mkdir=fs.mkdirSync,writeFile=fs.writeFileSync,readFile=fs.readFileSync;
  let writes=0,budgetReads=0;
  fs.mkdirSync=function(path,...rest){if(raceResolve(String(path))===output){mkdir.call(this,path);for(const [name,text] of Object.entries(sentinels))writeFile.call(this,raceResolve(output,name),text);}return mkdir.call(this,path,...rest);};
  fs.writeFileSync=function(path,...rest){if(raceDirname(raceResolve(String(path)))===output)writes++;return writeFile.call(this,path,...rest);};
  fs.readFileSync=function(path,...rest){if(raceResolve(String(path))===raceResolve(output,'synthetic-budget.json')){budgetReads++;return original.call(this,path,...rest);}return readFile.call(this,path,...rest);};
  syncBuiltinESMExports();process.on('exit',()=>process.stderr.write('RACE_OUTPUT_WRITES='+writes+';RACE_BUDGET_READS='+budgetReads));`;
  const result=child(args,(fake?.preload??guard)+inject);
  expect(result.status).not.toBe(0);expect(result.stderr).toContain('EEXIST');expect(result.stderr).not.toContain('FORBIDDEN_');
  for(const [name,value] of Object.entries(sentinels))expect(readFileSync(join(output,name),'utf8'),name).toBe(value);
  expect(result.stderr).toContain('RACE_OUTPUT_WRITES=0;RACE_BUDGET_READS=0');
  if(fake){expect(result.stderr).toContain('FAKE_HTTP_COUNT=0');expect(readFileSync(fake.ledger,'utf8')).toBe(before);expect(existsSync(fake.ledger+'.o1-dev.lock')).toBe(false);}
});
it.each(['mock','live'])('R4B-AUDIT-OUTPUT leaves no artifact when %s mkdir fails',async mode=>{
  const {root,prepared,offline}=await mock(),fake=mode==='live'?fakeLive(root):null,output=join(root,'denied');
  const args=mode==='live'?liveArgs(root,prepared):['--rehearse-outcome','--prepared',offline,'--output',output];args[4]=output;
  const before=fake?readFileSync(fake.ledger,'utf8'):null;
  const inject=`import {resolve as failResolve} from 'node:path';const mkdir=fs.mkdirSync,readFile=fs.readFileSync;
  fs.readFileSync=function(path,...rest){if(failResolve(String(path))===${JSON.stringify(join(output,'synthetic-budget.json'))})return original.call(this,path,...rest);return readFile.call(this,path,...rest);};
  fs.mkdirSync=function(path,...rest){if(failResolve(String(path))===${JSON.stringify(output)})throw Object.assign(new Error('synthetic mkdir denied'),{code:'EACCES'});return mkdir.call(this,path,...rest);};syncBuiltinESMExports();`;
  const result=child(args,(fake?.preload??guard)+inject);
  expect(result.status).not.toBe(0);expect(result.stderr).toContain('EACCES');expect(result.stderr).not.toContain('FORBIDDEN_');expect(existsSync(output)).toBe(false);
  if(fake){expect(result.stderr).toContain('FAKE_HTTP_COUNT=0');expect(readFileSync(fake.ledger,'utf8')).toBe(before);expect(existsSync(fake.ledger+'.o1-dev.lock')).toBe(false);}
});
it.each(['synthetic invalid key','synthetic\tinvalid-key','','   '])('R4B-AUDIT-SETUP rejects invalid key %j without output and can recover',async key=>{
  const {root,prepared}=await mock(),fake=fakeLive(root,'',{key}),before=readFileSync(fake.ledger,'utf8'),args=liveArgs(root,prepared);
  const result=child(args,fake.preload);
  expect(result.status).not.toBe(0);expect(result.stderr).toContain(key.trim()?'deepseek_key_missing':'outcome_key_and_authorization_required');
  expect(result.stderr).toContain('FAKE_HTTP_COUNT=0');expect(result.stderr).not.toContain('FORBIDDEN_');
  expect(readFileSync(fake.ledger,'utf8')).toBe(before);expect(existsSync(fake.ledger+'.o1-dev.lock')).toBe(false);
  expect(existsSync(args[4]!)).toBe(false);if(key.trim())expect(result.stdout+result.stderr).not.toContain(key);
  // Correct only the injected key; do not recreate or reset the ledger.
  const corrected=fake.preload.replace(JSON.stringify(`DEEPSEEK_API_KEY="${key}"`).slice(1,-1),JSON.stringify('DEEPSEEK_API_KEY="synthetic-outcome-key"').slice(1,-1));
  const recovered=child(args,corrected);expect(recovered.status,recovered.stderr).toBe(0);expect(recovered.stderr).toContain('FAKE_HTTP_COUNT=8');
  expect(read(fake.ledger).entries[0]).toEqual(fake.history);expect(read(fake.ledger).entries).toHaveLength(9);expect(existsSync(fake.ledger+'.o1-dev.lock')).toBe(false);
});
it('R4B-AUDIT-SETUP preserves acceptance of a valid key with surrounding whitespace',async()=>{
  const {root,prepared}=await mock(),fake=fakeLive(root,'',{key:'  synthetic-outcome-key  '}),result=child(liveArgs(root,prepared),fake.preload);
  expect(result.status,result.stderr).toBe(0);expect(result.stderr).toContain('FAKE_HTTP_COUNT=8');expect(read(fake.ledger).entries[0]).toEqual(fake.history);expect(existsSync(fake.ledger+'.o1-dev.lock')).toBe(false);
});
it('R4B-AUDIT-SETUP still rejects a STOPPED record with only NOT_SENT rows',async()=>{
  const {root,prepared}=await mock(),manifest=read(join(prepared,'manifest.json'));
  manifest.results=manifest.results.map((row:any)=>({id:row.id,attempted:false,received:false,execution:'NOT_SENT',result:null,checks:null,error:null}));
  manifest.status='STOPPED';manifest.failure='deepseek_key_missing';manifest.mockCalls=0;manifest.comparison=compareOutcomeProbeDiagnostic(manifest.results);
  write(join(prepared,'manifest.json'),manifest);writeLines(join(prepared,'results.jsonl'),manifest.results);writeFileSync(join(prepared,'responses.jsonl'),'');
  expect(()=>replayOutcomeDiagnostic(['--replay-outcome','--recorded',prepared,'--output',join(root,'replay')])).toThrow('outcome_stop_missing');expect(existsSync(join(root,'replay'))).toBe(false);
});

it('rehearses eight through shared transport and replays exact outcome results without real HTTP',async()=>{
  const {root,prepared,manifest}=await mock();
  expect(manifest).toMatchObject({status:'OUTCOME_MOCK_PASS',realProviderCalls:0,mockCalls:8,semanticQuality:'NOT_RUN',comparison:{planned:8,decoded:8,rubricMatched:8,manualAccepted:null,baselineMatched:5,diagnosticSuccess:'NOT_VERIFIED'}});
  expect(read(join(prepared,'synthetic-budget.json')).entries).toHaveLength(8);
  const report=replayOutcomeDiagnostic(['--replay-outcome','--recorded',prepared,'--output',join(root,'replay')]);
  expect(report).toMatchObject({providerCalls:0,mode:'mock',semanticQuality:'NOT_RUN',diagnosticSuccess:'NOT_VERIFIED'});
  expect(report.results.map((r:any)=>r.result)).toEqual(manifest.results.map((r:any)=>r.result));expect(globalThis.fetch).not.toHaveBeenCalled();
});
it('preserves the old five outcome matches and three failures without fabricating appraisals',async()=>{
  const frozen=read('evals/fixtures/affect-outcome-isolation-regression-v1.json'),current=buildOutcomeProbePreparation(),fails:string[]=[];
  for(const [i,row] of frozen.cases.entries()){
    const old=await new StructuredEventInterpreter(async()=>row.raw,undefined,'refs-v1').interpret(row.request);expect(old.status).toBe('interpreted');if(old.status!=='interpreted')throw new Error('old_decode_failed');
    const checks=checkOutcomeProbeCandidate(current.diagnostics[i]!.item,row.request,{taskKind:OUTCOME_PROBE_TASK,promptVersion:OUTCOME_PROBE_VERSION,outcome:old.interpretation.outcome});
    expect(checks.status).toBe(row.originalChecks.scopes.outcome);if(checks.status==='FAIL')fails.push(row.id);
  }
  expect(fails).toEqual(['D02','D09','P02']);
});
it.each(['hash','missing_hash','paid','synthetic','extra','mode'])('rejects %s approval before secret or ledger access',async kind=>{
  const {root,prepared}=await mock(),args=liveArgs(root,prepared);
  if(kind==='hash')args[6]='0'.repeat(64);if(kind==='missing_hash')args.splice(5,2);if(kind==='paid')args.splice(7,1);if(kind==='synthetic')args.pop();if(kind==='extra')args.push('--extra');if(kind==='mode')args[0]='--live-dev';
  const result=child(args);expect(result.status).not.toBe(0);expect(result.stderr).not.toContain('FORBIDDEN_');expect(existsSync(join(root,'live'))).toBe(false);
});
it.each(['version','task','source','missing_source','model','reservation','original','rehash_original','wire','order','duplicate','full_task','offline_only'])('rejects %s preparation before secrets',async kind=>{
  const {root,prepared}=await mock(),m=read(join(prepared,'manifest.json'));
  if(kind==='version')m.artifactVersion='old';if(kind==='task')m.prepared.taskKind='full';if(kind==='source')m.prepared.sourceHashes['packages/adapters/src/deepseek.ts']='bad';if(kind==='missing_source')delete m.prepared.sourceHashes['evals/affect-outcome-run.ts'];
  if(kind==='model')m.prepared.model='other';if(kind==='reservation')m.prepared.reservationUsd=0;if(kind==='full_task')m.status='MOCK_PASS';if(kind==='offline_only')m.status='OUTCOME_OFFLINE_PREPARED';
  if(kind==='original'||kind==='rehash_original'){const inputs=read(join(prepared,'original-inputs.json'));inputs[0].request.sources[0].text='changed';write(join(prepared,'original-inputs.json'),inputs);if(kind==='rehash_original')m.prepared.eventInputsHash=createHash('sha256').update(JSON.stringify(inputs)).digest('hex');}
  if(['wire','order','duplicate'].includes(kind)){const requests=read(join(prepared,'requests.json'));if(kind==='wire')requests[0].body.temperature=1;if(kind==='order')requests.reverse();if(kind==='duplicate')requests[1]=requests[0];write(join(prepared,'requests.json'),requests);}
  write(join(prepared,'manifest.json'),m);const result=child(liveArgs(root,prepared));expect(result.status).not.toBe(0);expect(result.stderr).not.toContain('FORBIDDEN_');expect(existsSync(join(root,'live'))).toBe(false);
});
it('live branch accepts non-fixture valid answers, retains semantic failures, and blocks a second attempt',async()=>{
  const {root,prepared}=await mock(),fake=fakeLive(root),args=liveArgs(root,prepared),result=child(args,fake.preload);
  expect(result.status,result.stderr).toBe(0);expect(result.stderr).toContain('FAKE_HTTP_COUNT=8');
  const manifest=read(join(root,'live','manifest.json'));expect(manifest).toMatchObject({status:'OUTCOME_SEMANTIC_REVIEW_REQUIRED',comparison:{planned:8,attempted:8,decoded:8,rubricMatched:1,manualAccepted:null}});
  expect(read(fake.ledger).entries[0]).toEqual(fake.history);expect(read(fake.ledger).entries).toHaveLength(9);expect(existsSync(fake.ledger+'.o1-dev.lock')).toBe(false);
  const replay=replayOutcomeDiagnostic(['--replay-outcome','--recorded',join(root,'live'),'--output',join(root,'replay')]);expect(replay.comparison).toEqual(manifest.comparison);
  const updatedMetadata=read(join(prepared,'manifest.json'));updatedMetadata.reviewNote='new review does not authorize a new attempt';write(join(prepared,'manifest.json'),updatedMetadata);
  args[4]=join(root,'again');const before=readFileSync(fake.ledger,'utf8'),again=child(args,fake.preload);
  expect(again.status).not.toBe(0);expect(again.stderr).toContain('outcome_attempt_already_recorded');expect(again.stderr).toContain('FAKE_HTTP_COUNT=0');expect(readFileSync(fake.ledger,'utf8')).toBe(before);expect(existsSync(args[4]!)).toBe(false);
});
it('live preflight rejects corrupted mock response evidence before reading secrets',async()=>{
  const {root,prepared}=await mock(),responses=jsonLines(join(prepared,'responses.jsonl'));responses[0].content='{}';writeLines(join(prepared,'responses.jsonl'),responses);
  const result=child(liveArgs(root,prepared));expect(result.status).not.toBe(0);expect(result.stderr).toContain('outcome_raw_hash');expect(result.stderr).not.toContain('FORBIDDEN_');expect(existsSync(join(root,'live'))).toBe(false);
});
it.each(['http','usage','json','reference','model','finish','truncated','timeout'])('%s stops after two attempts and replay cannot promote failed or late raw',async failure=>{
  const {root,prepared}=await mock(),fake=fakeLive(root,failure),result=child(liveArgs(root,prepared),fake.preload);
  expect(result.status).toBe(1);expect(result.stderr).toContain('FAKE_HTTP_COUNT=2');
  const manifest=read(join(root,'live','manifest.json'));expect(manifest).toMatchObject({status:'STOPPED',comparison:{planned:8,attempted:2,decoded:1,rubricMatched:0,notSent:6,diagnosticSuccess:'NOT_VERIFIED'}});
  expect(manifest.results[1].execution).toBe('ERROR');expect(read(fake.ledger).entries[0]).toEqual(fake.history);expect(read(fake.ledger).entries).toHaveLength(3);expect(existsSync(fake.ledger+'.o1-dev.lock')).toBe(false);
  if(['http','usage'].includes(failure))expect(read(fake.ledger).entries[2].status).toBe('unknown');
  if(failure==='timeout')expect(manifest.summary.unresolvedEntries).toBe(1);
  const report=replayOutcomeDiagnostic(['--replay-outcome','--recorded',join(root,'live'),'--output',join(root,'replay')]);
  expect(report.recordedStatus).toBe('STOPPED');expect(report.results[1].result).toBe(null);expect(report.comparison).toEqual(manifest.comparison);
  expect(readFileSync(join(root,'live','responses.jsonl'),'utf8')).not.toContain('private server error');
});
it.each(['cap','calls_cap','money','calls','unknown','shared_lock','request_lock','missing_ledger'])('%s preflight makes zero fake HTTP calls and preserves history',async kind=>{
  const {root,prepared}=await mock(),fake=fakeLive(root,'',kind==='cap'?{limit:.3}:kind==='calls_cap'?{calls:37}:kind==='money'?{limit:.01}:kind==='calls'?{calls:8}:{});
  if(kind==='unknown'){const v=read(fake.ledger);v.entries[0].status='unknown';write(fake.ledger,v);}
  if(kind==='shared_lock')writeFileSync(fake.ledger+'.o1-dev.lock','');if(kind==='request_lock')writeFileSync(fake.ledger+'.lock','');
  if(kind==='missing_ledger')rmSync(fake.ledger);
  const before=existsSync(fake.ledger)?readFileSync(fake.ledger,'utf8'):null,result=child(liveArgs(root,prepared),fake.preload);
  expect(result.status).not.toBe(0);expect(result.stderr).toContain('FAKE_HTTP_COUNT=0');expect(existsSync(join(root,'live'))).toBe(false);
  expect(existsSync(fake.ledger)?readFileSync(fake.ledger,'utf8'):null).toBe(before);
  if(kind==='shared_lock')expect(existsSync(fake.ledger+'.o1-dev.lock')).toBe(true);if(kind==='request_lock')expect(existsSync(fake.ledger+'.lock')).toBe(true);
});
it.each(['hash','duplicate','unknown_id','order','missing','truncated','result','checks','comparison','promote_mode'])('replay rejects %s corruption before writing',async kind=>{
  const {root,prepared}=await mock(),responses=jsonLines(join(prepared,'responses.jsonl')),m=read(join(prepared,'manifest.json'));
  if(kind==='hash')responses[0].rawSha256='bad';if(kind==='duplicate')responses.push(responses[0]);if(kind==='unknown_id')responses[0].caseId='new';if(kind==='order')responses.reverse();if(kind==='missing')responses.shift();if(kind==='truncated')responses[0].truncated=true;
  if(kind==='result')m.results[0].result.outcome=null;if(kind==='checks')m.results[0].checks.status='FAIL';if(kind==='comparison')m.comparison.rubricMatched=9;if(kind==='promote_mode')m.mode='live';
  writeLines(join(prepared,'responses.jsonl'),responses);write(join(prepared,'manifest.json'),m);
  if(kind==='result')writeLines(join(prepared,'results.jsonl'),m.results);
  expect(()=>replayOutcomeDiagnostic(['--replay-outcome','--recorded',prepared,'--output',join(root,'replay')])).toThrow();expect(existsSync(join(root,'replay'))).toBe(false);
});
it('requires J outputs, refuses overwrite, and replay CLI never reads a real secret',async()=>{
  const {root,prepared}=await mock();
  await expect(runOutcomeDiagnostic(['--rehearse-outcome','--prepared',prepared,'--output',join(process.cwd(),'runtime-data','not-created')])).rejects.toThrow('path_must_be_inside_J_ai');
  const before=readFileSync(join(prepared,'manifest.json'),'utf8');await expect(runOutcomeDiagnostic(['--rehearse-outcome','--prepared',prepared,'--output',prepared])).rejects.toThrow('evidence_exists');expect(readFileSync(join(prepared,'manifest.json'),'utf8')).toBe(before);
  const result=child(['--replay-outcome','--recorded',prepared,'--output',join(root,'replay')]);expect(result.status,result.stderr).toBe(0);expect(result.stderr).not.toContain('FORBIDDEN_');
});

const confirmLiveArgs=(root:string,prepared:string)=>['--live-outcome-confirm','--prepared',prepared,'--output',join(root,'live'),
  '--approved-request-hash',read(join(prepared,'manifest.json')).prepared.requestHash,
  '--approved-total-usd','0.20','--approved-max-calls','52','--allow-paid-providers','--synthetic-inputs'];
it('C1-P sends exactly sixteen with synthetic history36 and retains all failures, history and approval on replay',async()=>{
  const {root,prepared}=await mock(true),fake=fakeLive(root,'',{calls:52,history:36}),before=read(fake.ledger).entries;
  const args=confirmLiveArgs(root,prepared),result=child(args,fake.preload);
  expect(result.status,result.stderr).toBe(0);expect(result.stderr).toContain('FAKE_HTTP_COUNT=16');expect(result.stderr).not.toContain('FORBIDDEN_');
  const manifest=read(join(root,'live','manifest.json'));
  expect(manifest).toMatchObject({status:'OUTCOME_SEMANTIC_REVIEW_REQUIRED',mockCalls:0,realProviderCalls:16,semanticQuality:'REVIEW_REQUIRED',
    comparison:{planned:16,attempted:16,decoded:16,rubricMatched:4,manualAccepted:null,confirmationSuccess:'NOT_VERIFIED'},
    liveApproval:{requestHash:args[6],totalUsd:.2,cumulativeCalls:52,priorCalls:36,newCalls:16},summary:{attempts:52,unresolvedEntries:0}});
  expect(manifest.comparison).not.toHaveProperty('paired');expect(read(fake.ledger).entries.slice(0,36)).toEqual(before);
  expect(existsSync(fake.ledger+'.o1-dev.lock')).toBe(false);
  const replay=replayOutcomeDiagnostic(['--replay-outcome-confirm','--recorded',join(root,'live'),'--output',join(root,'replay')]);expect(replay.comparison).toEqual(manifest.comparison);
  const unchanged=readFileSync(fake.ledger,'utf8');args[4]=join(root,'repeat');
  const repeat=child(args,fake.preload);expect(repeat.status).not.toBe(0);expect(repeat.stderr).toContain('outcome_attempt_already_recorded');expect(repeat.stderr).toContain('FAKE_HTTP_COUNT=0');
  expect(readFileSync(fake.ledger,'utf8')).toBe(unchanged);expect(existsSync(args[4]!)).toBe(false);
});
it.each(['hash','money','calls','missing_limits','paid','extra','legacy_input','offline_only','source','raw'])('C1-P rejects %s before secret or ledger access',async kind=>{
  const {root,prepared,offline}=await mock(true),args=confirmLiveArgs(root,prepared);
  if(kind==='hash')args[6]='0'.repeat(64);if(kind==='money')args[8]='0.21';if(kind==='calls')args[10]='53';
  if(kind==='missing_limits')args.splice(7,4);if(kind==='paid')args.splice(11,1);if(kind==='extra')args.push('--extra');
  if(kind==='legacy_input'){const old=join(root,'old');prepareOutcomeProbeOffline(['--prepare-outcome-probe','--output',old]);args[2]=old;}
  if(kind==='offline_only')args[2]=offline;
  if(kind==='source'){const m=read(join(prepared,'manifest.json'));m.prepared.sourceHashes['evals/affect-outcome-run.ts']='changed';write(join(prepared,'manifest.json'),m);}
  if(kind==='raw'){const rows=jsonLines(join(prepared,'responses.jsonl'));rows[0].content='{}';writeLines(join(prepared,'responses.jsonl'),rows);}
  const result=child(args);expect(result.status).not.toBe(0);expect(result.stderr).not.toContain('FORBIDDEN_');expect(existsSync(args[4]!)).toBe(false);
});
it.each(['old_cap','high_cap','wrong_money','prior35','prior37','empty_history','money','unknown','missing_ledger','shared_lock','key'])('C1-P rejects synthetic %s without calls, preserves history and releases owned lock',async kind=>{
  const {root,prepared}=await mock(true),fake=fakeLive(root,'',{
    calls:kind==='old_cap'?36:kind==='high_cap'?53:52,limit:kind==='wrong_money'?.21:.2,
    history:kind==='prior35'?35:kind==='prior37'?37:36,key:kind==='key'?'invalid synthetic key':'synthetic-confirm-key'});
  if(kind==='money'){const ledger=read(fake.ledger);ledger.entries[0].usd=.19;write(fake.ledger,ledger);}
  if(kind==='unknown'){const ledger=read(fake.ledger);ledger.entries[0].status='unknown';write(fake.ledger,ledger);}
  if(kind==='empty_history')write(fake.ledger,{version:1,provider:'deepseek',model:'deepseek-flash',inputUsdPerMillion:.3,outputUsdPerMillion:1.2,limitUsd:.2,entries:[]});
  if(kind==='missing_ledger')rmSync(fake.ledger);if(kind==='shared_lock')writeFileSync(fake.ledger+'.o1-dev.lock','competing owner');
  const before=existsSync(fake.ledger)?readFileSync(fake.ledger,'utf8'):null,result=child(confirmLiveArgs(root,prepared),fake.preload);
  expect(result.status).not.toBe(0);expect(result.stderr).toContain('FAKE_HTTP_COUNT=0');expect(result.stderr).not.toContain('FORBIDDEN_');
  expect(existsSync(fake.ledger)?readFileSync(fake.ledger,'utf8'):null).toBe(before);expect(existsSync(join(root,'live'))).toBe(false);
  expect(existsSync(fake.ledger+'.o1-dev.lock')).toBe(kind==='shared_lock');if(kind==='key')expect(result.stderr).not.toContain('invalid synthetic key');
});
it.each(['http','usage','json','reference','model','finish','truncated','timeout'])('C1-P %s stops at two and keeps planned16 plus partial replay',async failure=>{
  const {root,prepared}=await mock(true),fake=fakeLive(root,failure,{calls:52,history:36}),before=read(fake.ledger).entries;
  const result=child(confirmLiveArgs(root,prepared),fake.preload);expect(result.status).toBe(1);expect(result.stderr).toContain('FAKE_HTTP_COUNT=2');
  const m=read(join(root,'live','manifest.json'));expect(m).toMatchObject({status:'STOPPED',comparison:{planned:16,attempted:2,decoded:1,notSent:14,confirmationSuccess:'NOT_VERIFIED'}});
  expect(read(fake.ledger).entries.slice(0,36)).toEqual(before);expect(read(fake.ledger).entries).toHaveLength(38);expect(existsSync(fake.ledger+'.o1-dev.lock')).toBe(false);
  const replay=replayOutcomeDiagnostic(['--replay-outcome-confirm','--recorded',join(root,'live'),'--output',join(root,'replay')]);
  expect(replay.results[1]!.result).toBeNull();expect(replay.comparison).toEqual(m.comparison);
});
it('C1-P preserves a competing output and rejects altered live approval during replay',async()=>{
  const {root,prepared}=await mock(true),fake=fakeLive(root,'',{calls:52,history:36}),args=confirmLiveArgs(root,prepared),before=readFileSync(fake.ledger,'utf8');
  const inject=`import {resolve as collisionResolve} from 'node:path';const mkdir=fs.mkdirSync;fs.mkdirSync=function(path,...rest){if(collisionResolve(String(path))===${JSON.stringify(args[4])}){mkdir.call(this,path);fs.writeFileSync(collisionResolve(String(path),'manifest.json'),'competing');}return mkdir.call(this,path,...rest);};syncBuiltinESMExports();`;
  const result=child(args,fake.preload+inject);expect(result.status).not.toBe(0);expect(result.stderr).toContain('EEXIST');expect(result.stderr).toContain('FAKE_HTTP_COUNT=0');
  expect(readFileSync(join(root,'live','manifest.json'),'utf8')).toBe('competing');expect(readFileSync(fake.ledger,'utf8')).toBe(before);expect(existsSync(fake.ledger+'.o1-dev.lock')).toBe(false);
  args[4]=join(root,'second');const good=child(args,fake.preload);expect(good.status,good.stderr).toBe(0);
  const manifest=read(join(root,'second','manifest.json'));manifest.liveApproval.cumulativeCalls=53;write(join(root,'second','manifest.json'),manifest);
  expect(()=>replayOutcomeDiagnostic(['--replay-outcome-confirm','--recorded',join(root,'second'),'--output',join(root,'replay')])).toThrow('outcome_live_approval_changed');
});
