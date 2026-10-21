import {it,expect,vi,afterEach} from 'vitest';
import {readFileSync,writeFileSync,mkdtempSync,rmSync,existsSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,dirname,resolve} from 'node:path';
import {prepareC2P,executeC2P,inspectC2P,runC2P,requireC2PDevelopment,buildC2P,c2pPolicy,c2pAuthorization} from './affect-reconnect-live.ts';
import {affectHash} from './affect-cases.ts';
import {createHash} from 'node:crypto';

const config=vi.hoisted(()=>({text:'',reads:0}));
vi.mock('node:fs',async importOriginal=>{
  const real=await importOriginal<typeof import('node:fs')>();
  return {...real,readFileSync:(p:any,...rest:any[])=>{
    if(String(p)==='runtime-data/deepseek.env'){config.reads++;if(!config.text)throw Error('unexpected_secret_access');return config.text;}
    return (real.readFileSync as any)(p,...rest);
  }};
});
const dirs:string[]=[];const read=(p:string)=>JSON.parse(readFileSync(p,'utf8')),write=(p:string,v:unknown)=>writeFileSync(p,JSON.stringify(v,null,2));
const realOrigin=c2pAuthorization.originEntriesHash;
afterEach(()=>{(c2pAuthorization as any).originEntriesHash=realOrigin;for(const p of dirs.splice(0)){expect(dirname(resolve(p))).toBe(resolve(tmpdir()));rmSync(p,{recursive:true,force:true});}config.text='';config.reads=0;vi.unstubAllGlobals();});
function setup(split:'dev'|'confirm'='dev'){const root=mkdtempSync(join(tmpdir(),'c2p-'));dirs.push(root);const prepared=join(root,'prepared'),b=prepareC2P(split,prepared);return {root,prepared,b};}
const reply=(raw:unknown)=>Response.json({model:'deepseek-flash',usage:{prompt_tokens:1000,completion_tokens:100},choices:[{finish_reason:'stop',message:{role:'assistant',content:JSON.stringify(raw)}}]});
function liveArgs(t:ReturnType<typeof setup>,output='live'){return {mode:'live' as const,prepared:t.prepared,output:join(t.root,output),approvedHash:t.b.requestHash,approvedUsd:t.b.spec.policy.totalUsd,approvedCalls:t.b.spec.policy.maxCalls};}
async function paidFixture(t:ReturnType<typeof setup>){
  const mock=join(t.root,'mock');await executeC2P({mode:'mock',prepared:t.prepared,output:mock});
  const ledger=join(t.root,'paid-synthetic.json'),synthetic=read(join(mock,'ledger-before.json'));write(ledger,synthetic);
  // Fake ledgers cannot carry the real 64-entry origin; pin the synthetic origin instead.
  (c2pAuthorization as any).originEntriesHash=createHash('sha256').update(JSON.stringify(synthetic.entries.slice(0,c2pAuthorization.originCalls))).digest('hex');
  config.text=`LOCAL_ONLY=false\nALLOW_PAID_PROVIDERS=true\nDEEPSEEK_API_KEY=synthetic-c2p-key\nDEEPSEEK_BUDGET_AUTHORIZATION=test only\nDEEPSEEK_BUDGET_PATH=${ledger}\nDEEPSEEK_BUDGET_USD=${t.b.spec.policy.totalUsd}\nDEEPSEEK_MAX_CALLS=${t.b.spec.policy.maxCalls}\n`;
  const rows=read(join(mock,'results.json'));let n=0;
  const fetch=vi.fn(async()=>{const r=rows[Math.floor(n/2)][n++%2?'appraisal':'outcome'];return reply(JSON.parse(r.response.content));});vi.stubGlobal('fetch',fetch);
  return {ledger,rows,fetch};
}
it.each(['dev','confirm'] as const)('%s prepares and rehearses 12/24 without secrets or real fetch, then replays',async split=>{
  const t=setup(split);vi.stubGlobal('fetch',vi.fn(()=>{throw Error('no_network');}));
  const out=join(t.root,'mock'),r=await executeC2P({mode:'mock',prepared:t.prepared,output:out});
  expect(r).toMatchObject({status:'C2P_REVIEW_REQUIRED',mode:'mock',realProviderCalls:0,comparison:{planned:12,calls:24,interpreted:12,rubricMatched:12,semanticQuality:'NOT_VERIFIED'}});
  expect((await inspectC2P(out)).rows).toHaveLength(12);await runC2P(['--replay','--recorded',out,'--output',join(t.root,'replay')]);
  expect(read(join(out,'review-template.json')).cases.every((c:any)=>c.accepted===null)).toBe(true);expect(config.reads).toBe(0);expect(globalThis.fetch).not.toHaveBeenCalled();
});
it.each(['approval','money','calls','source','confirm_gate'])('rejects %s before reading any key or ledger',async kind=>{
  const t=setup(kind==='confirm_gate'?'confirm':'dev'),o=liveArgs(t);
  if(kind==='approval')o.approvedHash='bad';if(kind==='money')o.approvedUsd=0.2 as any;if(kind==='calls')o.approvedCalls=c2pPolicy.dev.maxCalls-1 as any;
  if(kind==='source'){const m=read(join(t.prepared,'manifest.json'));m.spec.runnerHash='bad';write(join(t.prepared,'manifest.json'),m);}
  await expect(executeC2P(o)).rejects.toThrow();expect(config.reads).toBe(0);expect(existsSync(o.output)).toBe(false);
});
it('explicitly approved live branch is testable with fake credentials, ledger and fetch; history remains intact',async()=>{
  const t=setup(),f=await paidFixture(t),before=readFileSync(f.ledger,'utf8'),o=liveArgs(t);
  const r=await executeC2P(o);expect(f.fetch).toHaveBeenCalledTimes(24);expect(r).toMatchObject({mode:'live',realProviderCalls:24,comparison:{rubricMatched:12},summary:{attempts:c2pPolicy.dev.maxCalls}});
  expect(read(f.ledger).entries.slice(0,c2pPolicy.dev.priorCalls)).toEqual(JSON.parse(before).entries);expect(existsSync(f.ledger+'.o1-dev.lock')).toBe(false);await inspectC2P(o.output);
  const review=read(join(o.output,'review-template.json'));review.reviewer='synthetic test reviewer';review.cases.forEach((c:any)=>{c.accepted=true;c.reason='authored test response, not real quality';});const rp=join(t.root,'review.json');write(rp,review);
  expect((await requireC2PDevelopment(o.output,rp)).reviewer).toBe(review.reviewer);
  review.cases[0].accepted=null;write(rp,review);await expect(requireC2PDevelopment(o.output,rp)).rejects.toThrow();
  await expect(executeC2P({...o,output:join(t.root,'duplicate')})).rejects.toThrow();expect(f.fetch).toHaveBeenCalledTimes(24);
});
it.each(['missing','prior','unknown','budget','lock','config','key'])('live admission refuses %s and never calls fake fetch',async kind=>{
  const t=setup(),f=await paidFixture(t),ledger=read(f.ledger),o=liveArgs(t);
  if(kind==='missing')config.text=config.text.replace(f.ledger,join(t.root,'missing.json'));
  if(kind==='prior')ledger.entries.pop();if(kind==='unknown')ledger.entries[0].status='unknown';if(kind==='budget')ledger.entries[0].usd+=.1;
  if(kind==='lock')write(f.ledger+'.o1-dev.lock',{test:true});if(kind==='config')config.text=config.text.replace('LOCAL_ONLY=false','LOCAL_ONLY=true');if(kind==='key')config.text=config.text.replace('synthetic-c2p-key','');write(f.ledger,ledger);
  const original=readFileSync(f.ledger,'utf8');await expect(executeC2P(o)).rejects.toThrow();expect(f.fetch).not.toHaveBeenCalled();expect(readFileSync(f.ledger,'utf8')).toBe(original);
  expect(existsSync(f.ledger+'.o1-dev.lock')).toBe(kind==='lock');expect(existsSync(o.output)).toBe(false);
});
it.each(['outcome','appraisal'] as const)('failed %s records raw, stops the next stage/scene and replays without promotion',async stage=>{
  const t=setup(),out=join(t.root,'mock'),r=await executeC2P({mode:'mock',prepared:t.prepared,output:out},(_,s,__,raw)=>s===stage?Response.json({model:'deepseek-flash',choices:[{finish_reason:'stop',message:{role:'assistant',content:JSON.stringify(raw)}}]}):reply(raw));
  expect(r.status).toBe('C2P_STOPPED');expect(r.comparison).toMatchObject({planned:12,calls:stage==='outcome'?1:2,interpreted:0});
  const checked=await inspectC2P(out);expect(checked.rows[0]!.core).toBeNull();expect(checked.rows[0]![stage].response?.content).toBeTruthy();
});
it('a late valid physical response is drained and preserved without promoting a logical timeout',async()=>{
  const t=setup(),out=join(t.root,'mock'),timer=globalThis.setTimeout;
  vi.stubGlobal('setTimeout',((fn:any,ms:number,...args:any[])=>timer(fn,ms===60000?5:ms,...args)) as typeof setTimeout);
  const r=await executeC2P({mode:'mock',prepared:t.prepared,output:out},async(_,__,___,raw)=>{await new Promise(done=>timer(done,30));return reply(raw);});
  expect(r).toMatchObject({status:'C2P_STOPPED',comparison:{calls:1,interpreted:0}});
  const first=(await inspectC2P(out)).rows[0]!;expect(first.outcome.error).toBe('deepseek_deadline');expect(first.outcome.response?.content).toBeTruthy();expect(first.outcome.entry.status).toBe('completed');expect(first.core).toBeNull();
});
it.each(['unrelated','amount','usage','id','order'])('confirmation requires reviewed dev history, rejects %s ledger, and permits only a cap increase',async kind=>{
  const dev=setup(),df=await paidFixture(dev),d=liveArgs(dev);await executeC2P(d);expect(df.fetch).toHaveBeenCalledTimes(24);
  const review=read(join(d.output,'review-template.json'));review.reviewer='synthetic test reviewer';review.cases.forEach((c:any)=>{c.accepted=true;c.reason='synthetic fixture only';});const rp=join(dev.root,'review.json');write(rp,review);
  const confirm=setup('confirm'),cf=await paidFixture(confirm),o={...liveArgs(confirm),devRun:d.output,devReview:rp};
  review.runHash='wrong';write(rp,review);config.reads=0;await expect(executeC2P(o)).rejects.toThrow('c2p_review_run_changed');expect(config.reads).toBe(0);expect(cf.fetch).not.toHaveBeenCalled();
  review.runHash=read(join(d.output,'review-template.json')).runHash;write(rp,review);
  const continued=read(join(d.output,'ledger-after.json'));continued.limitUsd=confirm.b.spec.policy.totalUsd;
  if(kind!=='unrelated'){
    const changed=structuredClone(continued),entry=changed.entries[c2pPolicy.dev.priorCalls];
    if(kind==='amount')entry.usd=0;if(kind==='usage')entry.usage.prompt_tokens++;
    if(kind==='id')entry.id='different-dev-call';if(kind==='order')changed.entries.reverse();write(cf.ledger,changed);
  }
  const before=readFileSync(cf.ledger,'utf8');
  await expect(executeC2P(o)).rejects.toThrow('c2p_development_ledger_changed');
  expect(cf.fetch).not.toHaveBeenCalled();expect(readFileSync(cf.ledger,'utf8')).toBe(before);
  expect(existsSync(o.output)).toBe(false);expect(existsSync(cf.ledger+'.o1-dev.lock')).toBe(false);
  write(cf.ledger,continued);
  const r=await executeC2P(o);expect(r).toMatchObject({mode:'live',realProviderCalls:24,summary:{attempts:c2pPolicy.confirm.maxCalls},devGate:{reviewer:'synthetic test reviewer'}});expect(cf.fetch).toHaveBeenCalledTimes(24);await inspectC2P(o.output);
  expect(read(cf.ledger).entries.slice(0,c2pPolicy.confirm.priorCalls)).toEqual(continued.entries);
  if(kind==='unrelated'){
    const manifest=read(join(o.output,'manifest.json'));manifest.devGate.ledgerEntriesHash='changed';write(join(o.output,'manifest.json'),manifest);
    await expect(inspectC2P(o.output)).rejects.toThrow('c2p_development_ledger_changed');
    manifest.devGate=null;write(join(o.output,'manifest.json'),manifest);
    await expect(inspectC2P(o.output)).rejects.toThrow('c2p_development_ledger_changed');
  }
});
it('stops mid-run before the scene whose reservation would exceed the additional USD0.20 approval since the 64-entry origin',async()=>{
  const t=setup(),f=await paidFixture(t),ledger=read(f.ledger),o=liveArgs(t),n=c2pAuthorization.originCalls;
  // Same project total, but USD0.12 already used since the origin; large in-bound usage then exhausts the 0.20 approval.
  ledger.entries[0].usd-=.0523362;ledger.entries[n].usd+=.0523362;write(f.ledger,ledger);
  (c2pAuthorization as any).originEntriesHash=createHash('sha256').update(JSON.stringify(ledger.entries.slice(0,n))).digest('hex');
  let k=0;const fetch=vi.fn(async()=>{const stage=k%2?'appraisal':'outcome',r=f.rows[Math.floor(k/2)][stage];k++;
    return Response.json({model:'deepseek-flash',usage:{prompt_tokens:stage==='outcome'?3000:8000,completion_tokens:2000},choices:[{finish_reason:'stop',message:{role:'assistant',content:r.response.content}}]});});
  vi.stubGlobal('fetch',fetch);
  const r:any=await executeC2P(o);expect(r.status).toBe('C2P_STOPPED');expect(r.comparison.calls).toBeGreaterThan(0);expect(r.comparison.calls).toBeLessThan(24);expect(r.comparison.calls%2).toBe(0);
  expect(r.authorization.spentAfter).toBeLessThanOrEqual(c2pAuthorization.additionalUsd);
  expect(r.authorization.spentAfter+buildC2P('dev').current.requests[r.comparison.calls/2]!.reservationUsd).toBeGreaterThan(c2pAuthorization.additionalUsd);
  await inspectC2P(o.output);
});
it('valid semantic failure stays in the 12-scene denominator and blocks dev acceptance',async()=>{
  const t=setup(),out=join(t.root,'mock');const r=await executeC2P({mode:'mock',prepared:t.prepared,output:out},(id,s,_,raw:any)=>{if(id==='A01'&&s==='appraisal')raw.appraisals[0].congruence=-.7;return reply(raw);});
  expect(r.comparison).toMatchObject({calls:24,interpreted:12,rubricMatched:11});await inspectC2P(out);
  await expect(requireC2PDevelopment(out,join(out,'review-template.json'))).rejects.toThrow();
});
it.each(['body','raw','core','ledger','mode','status','denominator'])('replay rejects %s tampering',async kind=>{
  const t=setup(),out=join(t.root,'mock');await executeC2P({mode:'mock',prepared:t.prepared,output:out});const rows=read(join(out,'results.json')),m=read(join(out,'manifest.json'));
  if(kind==='body')rows[0].appraisal.body.messages[0].content='changed';if(kind==='raw')rows[0].appraisal.response.content='{}';if(kind==='core')rows[0].core.snapshot.levels.positive=0;
  if(kind==='ledger')rows[0].outcome.entry.usd=0;if(kind==='mode')m.mode='live';if(kind==='status')m.status='C2P_STOPPED';if(kind==='denominator')rows.pop();
  write(join(out,'results.json'),rows);write(join(out,'manifest.json'),m);await expect(inspectC2P(out)).rejects.toThrow();
});
it('refuses overwrite, outside paths, extra flags and unapproved CLI without key reads',async()=>{
  const t=setup();expect(()=>prepareC2P('dev',t.prepared)).toThrow('evidence_exists');expect(()=>prepareC2P('dev',join(process.cwd(),'not-created'))).toThrow('c2p_artifact_path');
  await expect(runC2P(['--live','--prepared',t.prepared,'--output',join(t.root,'bad')])).rejects.toThrow('c2p_explicit_approval_required');
  await expect(runC2P(['--rehearse','--prepared',t.prepared,'--output',join(t.root,'bad'),'--allow-paid-providers'])).rejects.toThrow();expect(config.reads).toBe(0);
  const baseline=read('evals/fixtures/affect-appraisal-repair-v1.json').source.firstStageBaseline;
  expect(affectHash(buildC2P('dev').current.requests.map(r=>({id:r.id,body:r.outcomeBody})))).toBe(baseline.aggregateHash);
});
