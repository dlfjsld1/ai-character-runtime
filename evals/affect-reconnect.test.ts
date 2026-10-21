import {it,expect,vi,afterEach} from 'vitest';
import {readFileSync,writeFileSync,mkdtempSync,rmSync,existsSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve,dirname} from 'node:path';
import {buildReconnectPreparation,validateReconnectSuites,runReconnect,rehearseReconnect,replayReconnect,checkReconnectCandidate,ensureReconnectSceneBudget} from './affect-reconnect.ts';
import {DeepSeekBudget} from '../packages/adapters/src/deepseek-budget.ts';
import {prepareAppraisalProbe} from '../packages/adapters/src/appraisal-probe.ts';

const dirs:string[]=[];const read=(p:string)=>JSON.parse(readFileSync(p,'utf8')),write=(p:string,d:unknown)=>writeFileSync(p,JSON.stringify(d,null,2));
afterEach(()=>{for(const d of dirs.splice(0)){expect(dirname(resolve(d))).toBe(resolve(tmpdir()));rmSync(d,{recursive:true,force:true});}vi.unstubAllGlobals();});
async function prepared(split:'dev'|'confirm'='dev'){const root=mkdtempSync(join(tmpdir(),'reconnect-'));dirs.push(root);const path=join(root,'prepared');await runReconnect(['--prepare-reconnect','--split',split,'--output',path]);return {root,path};}
const response=(raw:unknown)=>Response.json({model:'deepseek-flash',usage:{prompt_tokens:1000,completion_tokens:100},choices:[{finish_reason:'stop',message:{role:'assistant',content:JSON.stringify(raw)}}]});
it.each(['dev','confirm'] as const)('%s runs two fake stages and replays twelve Core results without real fetch',async split=>{
  const {root,path}=await prepared(split);vi.stubGlobal('fetch',vi.fn(()=>{throw Error('forbidden_network');}));
  const out=join(root,'mock'),m=await rehearseReconnect(path,out);expect(m).toMatchObject({status:'RECONNECT_MOCK_COMPLETE',realProviderCalls:0,comparison:{planned:12,stageCalls:24,interpreted:12,rubricMatched:12,notSent:0,semanticQuality:'NOT_RUN'},summary:{attempts:24,unresolvedEntries:0}});
  const rows=read(join(out,'results.json')),before=readFileSync(join(out,'results.json'),'utf8');
  expect(rows.every((r:any)=>r.outcome.execution==='DECODED'&&r.appraisal.execution==='DECODED')).toBe(true);
  const mixed=rows.find((r:any)=>r.id===(split==='dev'?'A03':'V09'));expect(mixed.core.snapshot.levels.positive).toBeGreaterThan(0);expect(mixed.core.snapshot.levels.negative).toBeGreaterThan(0);
  const nullRow=rows.find((r:any)=>r.id===(split==='dev'?'A07':'V12'));expect(nullRow.result.interpretation.outcome).toBeNull();expect(nullRow.result.interpretation.appraisals.length).toBeGreaterThan(0);
  const neutral=rows.find((r:any)=>r.id===(split==='dev'?'A04':'V03'));expect(neutral.result.status).toBe('interpreted');expect(neutral.core.snapshot.levels).toEqual({positive:0,negative:0,activation:0});
  const replay=await replayReconnect(out,join(root,'replay'));expect(replay.results.map(r=>r.core)).toEqual(rows.map((r:any)=>r.core));expect(replay.comparison).toEqual(m.comparison);
  expect(readFileSync(join(out,'results.json'),'utf8')).toBe(before);expect(globalThis.fetch).not.toHaveBeenCalled();
});
it('fixed split IDs, traits, body metadata exclusion and expectation/persona pairs are checked',()=>{
  const dev=buildReconnectPreparation('dev'),confirm=buildReconnectPreparation('confirm');
  for(const p of [dev,confirm])for(const row of p.requests){for(const body of [row.outcomeBody,row.authoredAppraisalBody]){const text=JSON.stringify(body);expect(text).not.toContain('authored');expect(text).not.toContain('polarity');expect(text).not.toContain('expectedRoles');expect(text).not.toMatch(/"[AV]\d{2}"/);}}
  const v1=confirm.originals[0]!.request,v3=confirm.originals[2]!.request;expect(v1.sources.filter(s=>s.kind!=='persona')).toEqual(v3.sources.filter(s=>s.kind!=='persona'));
  const v5=confirm.originals[4]!.request,v8=confirm.originals[7]!.request;expect(v5.sources).toEqual(v8.sources.filter(s=>s.kind!=='expectation'));
  const bad=structuredClone(confirm.suite);bad.cases[0]!.id='A01';expect(()=>validateReconnectSuites(dev.suite,bad)).toThrow('reconnect_case_order');
  bad.cases[0]!.id='V01';bad.cases[0]!.input=dev.suite.cases[0]!.input;expect(()=>validateReconnectSuites(dev.suite,bad)).toThrow('reconnect_split_leak');
});
it.each(['outcome','appraisal'] as const)('a valid semantic error in %s remains in fixed denominator and does not stop the batch',async stage=>{
  const {root,path}=await prepared(),out=join(root,'mock');
  const result=await rehearseReconnect(path,out,(id,s,_,raw:any)=>{if(id==='A01'&&s===stage){if(s==='outcome')raw.outcome.result='unfavorable';else raw.appraisals[0].congruence=-.7;}return response(raw);});
  expect(result.comparison).toMatchObject({planned:12,stageCalls:24,interpreted:12,rubricMatched:11});
  expect(read(join(out,'results.json'))[0].checks.status).toBe('FAIL');expect((await replayReconnect(out,join(root,'replay'))).comparison).toEqual(result.comparison);
});
it.each(['outcome','appraisal'] as const)('failed %s raw is preserved, next stage/Core/following scenes are stopped',async stage=>{
  const {root,path}=await prepared(),out=join(root,'mock');
  const result=await rehearseReconnect(path,out,(id,s,_,raw)=>id==='A02'&&s===stage?Response.json({model:'deepseek-flash',choices:[{finish_reason:'stop',message:{role:'assistant',content:JSON.stringify(raw)}}]}):response(raw));
  expect(result).toMatchObject({status:'RECONNECT_STOPPED',comparison:{planned:12,stageCalls:stage==='outcome'?3:4,interpreted:1,notSent:10}});
  const rows=read(join(out,'results.json'));expect(rows[1].core).toBeNull();expect(rows[1][stage].response.content).toBeTruthy();expect(rows[1][stage].ledgerEntry.status).toBe('unknown');
  if(stage==='outcome')expect(rows[1].appraisal.execution).toBe('NOT_SENT');else expect(rows[1].outcome.execution).toBe('DECODED');
  const replay=await replayReconnect(out,join(root,'replay'));expect(replay.results).toHaveLength(2);expect(replay.results[1]!.result.status).toBe('unavailable');expect(replay.results[1]!.core).toBeNull();
  rows[1][stage].response.content='{}';write(join(out,'results.json'),rows);
  await expect(replayReconnect(out,join(root,'changed'))).rejects.toThrow('reconnect_raw_hash');
});
it.each(['http','json','outcome_field','wrong_reference','truncated','model'] as const)('second-stage %s stops immediately without applying partial facts to Core',async failure=>{
  const {root,path}=await prepared(),out=join(root,'mock');
  const result=await rehearseReconnect(path,out,(_,stage,body,raw:any)=>{
    if(stage==='outcome')return response(raw);
    if(failure==='http')return Response.json({error:'synthetic'},{status:503});
    if(failure==='outcome_field')raw.outcome=null;if(failure==='wrong_reference')raw.appraisals[0].concern.source.sourceId='r999';
    return Response.json({model:failure==='model'?'wrong':'deepseek-flash',usage:{prompt_tokens:1000,completion_tokens:100},choices:[{finish_reason:'stop',message:{role:'assistant',content:failure==='json'?'{':failure==='truncated'?' '.repeat(131073):JSON.stringify(raw)}}]});
  });
  expect(result.comparison).toMatchObject({planned:12,stageCalls:2,interpreted:0,notSent:11});
  const rows=read(join(out,'results.json'));expect(rows[0].outcome.execution).toBe('DECODED');expect(rows[0].appraisal.execution).toBe('ERROR');expect(rows[0].core).toBeNull();
  expect((await replayReconnect(out,join(root,'replay'))).results[0]!.result.status).toBe('unavailable');
});
it.each(['source','raw','body','core','denominator','split','mode','after_stop','ledger','status'] as const)('replay refuses %s mutation',async mutation=>{
  const {root,path}=await prepared(),out=join(root,'mock');await rehearseReconnect(path,out);const m=read(join(out,'manifest.json')),rows=read(join(out,'results.json'));
  if(mutation==='source')m.prepared.sourceHashes['evals/affect-reconnect.ts']='changed';if(mutation==='raw')rows[0].appraisal.response.content='{}';
  if(mutation==='body')rows[0].appraisal.body.messages[1].content='changed';if(mutation==='core')rows[0].core.snapshot.levels.positive=0;
  if(mutation==='denominator'){rows.pop();m.comparison.planned=11;}if(mutation==='split')m.prepared.split='confirm';if(mutation==='mode')m.mode='live';
  if(mutation==='after_stop')rows[0].result=null;if(mutation==='ledger')rows[0].outcome.ledgerEntry.usd=0;if(mutation==='status')m.status='RECONNECT_STOPPED';
  write(join(out,'manifest.json'),m);write(join(out,'results.json'),rows);
  await expect(replayReconnect(out,join(root,'replay'))).rejects.toThrow();expect(existsSync(join(root,'replay'))).toBe(false);
});
it.each(['calls','money','unknown'])('both-stage budget gate rejects %s before any provider operation',async kind=>{
  const {root}=await prepared(),b=new DeepSeekBudget(join(root,'synthetic-budget.json'),.2,kind==='calls'?1:24,'synthetic');
  if(kind==='unknown')b.reserve(1000,2048);
  expect(()=>ensureReconnectSceneBudget(b,kind==='money'?.21:.01)).toThrow();
});
it('role/stance and required scope gates reject victim/quotation misattribution separately from valid JSON',async()=>{
  const {root,path}=await prepared(),out=join(root,'mock');await rehearseReconnect(path,out);const prep=buildReconnectPreparation('dev'),rows=read(join(out,'results.json'));
  for(const id of ['A07','A11','A12']){const i=prep.suite.cases.findIndex(c=>c.id===id),result=structuredClone(rows[i].result);result.interpretation.appraisals[0].actorId=id==='A07'?prep.originals[i]!.request.speakerId:prep.originals[i]!.request.scope.characterId;
    const checks=checkReconnectCandidate(prep.suite.cases[i]!,prep.originals[i]!.request,result);
    expect(checks.failures).toContain('input.actor');expect(checks.status).toBe('FAIL');expect(checks.scopes.input).toBe('FAIL');}
  const p=prepareAppraisalProbe(prep.originals[0]!.request,rows[0].result.interpretation.outcome);
  expect(()=>p.decode({status:'irrelevant',outcome:null,appraisals:[]})).toThrow();
});
it.each(['--live-reconnect','--paid-reconnect'])('offline CLI refuses %s and extra paid flags',async mode=>{
  const {root,path}=await prepared();await expect(runReconnect([mode,'--prepared',path,'--output',join(root,'bad')])).rejects.toThrow('reconnect_offline_only');
  await expect(runReconnect(['--rehearse-reconnect','--prepared',path,'--output',join(root,'bad'),'--allow-paid-providers'])).rejects.toThrow('reconnect_offline_arguments');
  expect(existsSync(join(root,'bad'))).toBe(false);
});
it('refuses non-J paths, changed preparation, and existing output without overwriting',async()=>{
  const {root,path}=await prepared(),out=join(root,'mock');await rehearseReconnect(path,out);const original=readFileSync(join(out,'manifest.json'),'utf8');
  await expect(rehearseReconnect(path,out)).rejects.toThrow('evidence_exists');expect(readFileSync(join(out,'manifest.json'),'utf8')).toBe(original);
  await expect(rehearseReconnect(path,join(process.cwd(),'runtime-data','not-created'))).rejects.toThrow('reconnect_J_path_required');
  const m=read(join(path,'manifest.json'));m.prepared.requestHash='changed';write(join(path,'manifest.json'),m);
  await expect(rehearseReconnect(path,join(root,'changed'))).rejects.toThrow('reconnect_preparation_changed');expect(existsSync(join(root,'changed'))).toBe(false);
});
it('the split composition imports no provider SDK/name and runtime does not register the new probes',()=>{
  const source=readFileSync('packages/adapters/src/split-event-interpreter.ts','utf8');expect(source).not.toMatch(/deepseek|openai|ollama|jev/i);
  expect(readFileSync('apps/runtime/src/providers.ts','utf8')).not.toMatch(/DeepSeekAppraisalProbe|SplitEventInterpreter/);
});
