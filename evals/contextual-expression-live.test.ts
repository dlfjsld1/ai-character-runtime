import {it,expect,vi,afterEach} from 'vitest';
import {readFileSync,writeFileSync,mkdtempSync,rmSync,existsSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve,dirname} from 'node:path';
import {createHash} from 'node:crypto';
import {buildContextualLivePreparation,prepareContextualLive,executeContextualLive,runContextualLive,type ContextualScope} from './contextual-expression-live.ts';

const config=vi.hoisted(()=>({text:'',reads:0}));
vi.mock('node:fs',async original=>{const real=await original<typeof import('node:fs')>();return {...real,readFileSync:(p:any,...rest:any[])=>{if(String(p)==='synthetic-cx-config'){config.reads++;if(!config.text)throw Error('unexpected_secret_read');return config.text;}return (real.readFileSync as any)(p,...rest);}};});
const dirs:string[]=[];const read=(p:string)=>JSON.parse(readFileSync(p,'utf8'));const write=(p:string,v:unknown)=>writeFileSync(p,JSON.stringify(v,null,2));
afterEach(()=>{for(const p of dirs.splice(0)){expect(dirname(resolve(p))).toBe(resolve(tmpdir()));rmSync(p,{recursive:true,force:true});}config.text='';config.reads=0;vi.unstubAllGlobals();});
function setup(scope:ContextualScope='full'){const root=mkdtempSync(join(tmpdir(),'cx-live-'));dirs.push(root);const prepared=join(root,'prepared');const b=prepareContextualLive(prepared,scope);return {root,prepared,b};}
const reply=(text='확인했어.',body?:any)=>{const contentFirst=!body||JSON.parse(body.messages[0].content.split('\n').slice(1).join('\n')).required.includes('content');return Response.json({model:'deepseek-flash',usage:{prompt_tokens:1000,completion_tokens:100},choices:[{finish_reason:'stop',message:{role:'assistant',content:JSON.stringify({...contentFirst?{content:text}:{},sentences:[text]})}}]});};
function paid(t:ReturnType<typeof setup>,priorCalls=64){
  const maxCalls=priorCalls+t.b.spec.newCalls,ledger=join(t.root,'paid-synthetic.json');const before={version:1,provider:'deepseek',model:'deepseek-flash',inputUsdPerMillion:.3,outputUsdPerMillion:1.2,limitUsd:.21,entries:Array.from({length:priorCalls},(_,i)=>({id:`old-${i}`,authorization:'previous test',status:'completed',usd:i===0?.01:0,inputBound:1000,maxOutputTokens:256}))};write(ledger,before);
  config.text=`LOCAL_ONLY=false\nALLOW_PAID_PROVIDERS=true\nDEEPSEEK_API_KEY=synthetic-cx-key\nDEEPSEEK_BUDGET_PATH=${ledger}\nDEEPSEEK_BUDGET_USD=.21\nDEEPSEEK_MAX_CALLS=${maxCalls}\n`;
  const origin=join(t.root,'authorization-origin.json');write(origin,{...before,entries:before.entries.slice(0,64)});
  const o={mode:'live' as const,prepared:t.prepared,output:join(t.root,'live'),scope:t.b.spec.scope,config:'synthetic-cx-config',approvedHash:t.b.requestHash,approvedAdditionalUsd:.2,expectedLedgerHash:createHash('sha256').update(readFileSync(ledger)).digest('hex'),expectedPriorCalls:priorCalls,approvedMaxCalls:maxCalls,authorizationOriginLedger:origin,approvedOriginHash:createHash('sha256').update(readFileSync(origin)).digest('hex')};
  return {ledger,before,origin,o};
}
it('prepares the full fixed denominator below the newly authorized .20 without config or network',()=>{
  const b=buildContextualLivePreparation();expect(b.spec).toMatchObject({flows:8,variants:16,turns:48,newCalls:46,additionalUsd:.2});expect(b.spec.bounds).toHaveLength(46);expect(b.spec.reservationUsd).toBeLessThan(.2);expect(config.reads).toBe(0);
});
it('rehearses 46 generations plus 2 silences, carrying actual previous output and attributed sources',async()=>{
  const t=setup(),output=join(t.root,'mock'),fetch=vi.fn(()=>{throw Error('no_external_network');});vi.stubGlobal('fetch',fetch);
  const result=await executeContextualLive({mode:'mock',prepared:t.prepared,output},(_,body,answer)=>reply(answer,body));
  expect(result).toMatchObject({status:'CX_MOCK_PASS',attempted:46,completed:46,silent:2,realProviderCalls:0,mockCalls:46});expect(fetch).not.toHaveBeenCalled();expect(config.reads).toBe(0);
  const rows=read(join(output,'results.json'));expect(rows).toHaveLength(48);
  const first=rows[0],second=rows[1];expect(second.context.conversation.turns[1].text).toBe(first.output.join(' '));expect(second.context.conversation.turns[0].text).toBe(first.input);
  expect(first.context.sources[0].payload.text).toContain('쓰레기');expect(rows.find((r:any)=>r.id==='CX-S03/other/0').context.sources[0].identity_id).not.toBe(rows.find((r:any)=>r.id==='CX-S03/other/0').context.currentInput.identity_id);
  for(const id of ['CX-S06/positive/0','CX-S07/show-both/0','CX-S07/mask-negative/0']){
    const row=rows.find((r:any)=>r.id===id),joy=row.control.state.affect.joy.causes[0];
    expect(row.context.sources.find((s:any)=>s.id===joy.eventId).payload.text).toContain('고마워');
    for(const cause of row.control.state.affect.frustration.causes)expect(row.context.sources.find((s:any)=>s.id===cause.eventId).payload.text).toContain('쓰레기');
  }
  expect(rows.every((r:any)=>r.quality==='NOT_VERIFIED'&&r.stageAck==='NOT_EXECUTED')).toBe(true);expect(rows.find((r:any)=>r.id==='CX-S08/value-conflict/0').control.personaInterpretation).toBe('NOT_VERIFIED');
});
it.each(['hash','money','calls','source','no_ledger_hash'])('rejects %s before config/key access',async kind=>{
  const t=setup(),p=paid(t),o=p.o;if(kind==='hash')o.approvedHash='wrong';if(kind==='money')o.approvedAdditionalUsd=.3;if(kind==='calls')o.approvedMaxCalls=48;if(kind==='no_ledger_hash')o.expectedLedgerHash='';
  if(kind==='source'){const m=read(join(t.prepared,'manifest.json'));m.spec.sourceHashes={};write(join(t.prepared,'manifest.json'),m);}
  await expect(executeContextualLive(o)).rejects.toThrow();expect(config.reads).toBe(0);expect(existsSync(o.output)).toBe(false);
});
it('the live branch is exercised only with fake fetch and synthetic credentials/ledger, preserving history',async()=>{
  const t=setup(),p=paid(t),fetch=vi.fn(async(_url,init)=>reply('확인했어.',JSON.parse(String(init.body))));vi.stubGlobal('fetch',fetch);
  const result=await executeContextualLive(p.o);expect(result).toMatchObject({status:'CX_REVIEW_REQUIRED',completed:46,silent:2,maxNewCalls:46,maxCumulativeCalls:110,realProviderCalls:46});expect(fetch).toHaveBeenCalledTimes(46);
  expect(read(p.ledger).entries.slice(0,64)).toEqual(p.before.entries);expect(result.newCostUsd).toBeLessThan(.2);expect(existsSync(p.ledger+'.o1-dev.lock')).toBe(false);
  await expect(executeContextualLive({...p.o,output:join(t.root,'repeat')})).rejects.toThrow('cx_ledger_changed');expect(fetch).toHaveBeenCalledTimes(46);
});
it.each(['ledger_hash','unresolved','remaining','calls_config','run_lock'])('refuses %s before any network and leaves historical bytes alone',async kind=>{
  const t=setup(),p=paid(t),fetch=vi.fn(async()=>reply());vi.stubGlobal('fetch',fetch);
  if(kind==='ledger_hash')p.o.expectedLedgerHash='0'.repeat(64);if(kind==='unresolved')(p.before.entries[0] as any).status='unknown';if(kind==='remaining')p.before.entries[0]!.usd=.2;
  if(kind==='calls_config')config.text=config.text.replace('110','111');if(kind==='run_lock')write(p.ledger+'.o1-dev.lock',{test:true});write(p.ledger,p.before);
  if(kind!=='ledger_hash')p.o.expectedLedgerHash=createHash('sha256').update(readFileSync(p.ledger)).digest('hex');const before=readFileSync(p.ledger,'utf8');
  await expect(executeContextualLive(p.o)).rejects.toThrow();expect(fetch).not.toHaveBeenCalled();expect(readFileSync(p.ledger,'utf8')).toBe(before);expect(existsSync(p.o.output)).toBe(false);expect(existsSync(p.ledger+'.o1-dev.lock')).toBe(kind==='run_lock');
});
it.each(['invalid','usage','http'])('stops on %s without retry, preserves all 48 denominator rows',async kind=>{
  const t=setup(),output=join(t.root,'mock');const result=await executeContextualLive({mode:'mock',prepared:t.prepared,output},()=>kind==='http'?Response.json({error:'synthetic'},{status:503}):kind==='usage'?Response.json({model:'deepseek-flash',choices:[{finish_reason:'stop',message:{role:'assistant',content:'{}'}}]}):reply(''));
  expect(result.status).toBe('CX_STOPPED');expect(result.attempted).toBe(1);expect(result.completed).toBe(0);const rows=read(join(output,'results.json'));expect(rows).toHaveLength(48);expect(rows.slice(1).every((r:any)=>r.execution==='NOT_SENT')).toBe(true);
});
it('drains a late physical response before releasing the run lock and never promotes timeout',async()=>{
  const t=setup(),p=paid(t),timer=globalThis.setTimeout;let observed=false;
  vi.stubGlobal('setTimeout',((fn:any,ms:number,...args:any[])=>timer(fn,ms===60000?5:ms,...args)) as typeof setTimeout);
  vi.stubGlobal('fetch',vi.fn(async()=>{await new Promise(done=>timer(done,30));observed=existsSync(p.ledger+'.o1-dev.lock');return reply();}));
  const result=await executeContextualLive(p.o);expect(result).toMatchObject({status:'CX_STOPPED',attempted:1,completed:0,failure:'deepseek_deadline'});expect(observed).toBe(true);expect(existsSync(p.ledger+'.o1-dev.lock')).toBe(false);expect(read(p.ledger).entries[64].status).toBe('completed');
});
it('CLI rejects omitted paid flags and output reuse without credential reads',async()=>{
  const t=setup();expect(()=>prepareContextualLive(t.prepared)).toThrow('evidence_exists');await expect(runContextualLive(['--live','--prepared',t.prepared,'--output',join(t.root,'bad')])).rejects.toThrow();expect(config.reads).toBe(0);
});
const repairIds=['CX-S03/same/0','CX-S03/other/0',...['CX-S06/positive','CX-S06/neutral','CX-S07/show-both','CX-S07/mask-negative'].flatMap(id=>[0,1,2].map(turn=>`${id}/${turn}`))];
it('repair14 fixes two S03 first turns plus twelve S06/S07 turns without shrinking the full suite',()=>{
  const full=buildContextualLivePreparation(),repair=buildContextualLivePreparation('repair14');
  expect(full.spec).toMatchObject({scope:'full',flows:8,variants:16,turns:48,newCalls:46});
  expect(repair.spec).toMatchObject({scope:'repair14',flows:3,variants:6,turns:14,newCalls:14,claims:{fullSuite:'NOT_EVALUATED'}});
  expect(repair.spec.bounds.map(b=>b.id)).toEqual(repairIds);expect(repair.spec.bounds).toEqual(full.spec.bounds.filter(b=>repairIds.includes(b.id)));
  expect(repair.spec.reservationUsd).toBeLessThan(.2);expect(repair.requestHash).not.toBe(full.requestHash);expect(config.reads).toBe(0);
});
it('repair14 CLI rehearsal records only the fourteen fixed rows and never promotes a full result',async()=>{
  const t=setup('repair14'),output=join(t.root,'mock'),fetch=vi.fn(()=>{throw Error('no_external_network');});vi.stubGlobal('fetch',fetch);
  const result:any=await runContextualLive(['--rehearse','--scope','repair14','--prepared',t.prepared,'--output',output]);
  expect(result).toMatchObject({status:'CX_MOCK_PASS',completed:14,attempted:14,silent:0,realProviderCalls:0,maxNewCalls:14,spec:{scope:'repair14',claims:{fullSuite:'NOT_EVALUATED'}}});
  const rows=read(join(output,'results.json'));expect(rows.map((r:any)=>r.id)).toEqual(repairIds);expect(read(join(output,'review-template.json')).flows.map((f:any)=>f.id)).toEqual(['CX-S03','CX-S06','CX-S07']);expect(fetch).not.toHaveBeenCalled();expect(config.reads).toBe(0);
  const positive=rows.find((r:any)=>r.id==='CX-S06/positive/0');expect(positive.control.state.affect.joy.causes[0].eventId).toBe('91000000-0000-4000-8000-000000000210');
});
it('repair14 live admission binds prior 93 to maximum 107, with fourteen fake calls and old entries preserved',async()=>{
  const t=setup('repair14'),p=paid(t,93),fetch=vi.fn(async(_url,init)=>reply('확인했어.',JSON.parse(String(init.body))));vi.stubGlobal('fetch',fetch);
  const r=await executeContextualLive(p.o);expect(r).toMatchObject({status:'CX_REVIEW_REQUIRED',completed:14,attempted:14,maxNewCalls:14,maxCumulativeCalls:107,summary:{attempts:107},spec:{scope:'repair14',claims:{fullSuite:'NOT_EVALUATED'}}});expect(fetch).toHaveBeenCalledTimes(14);expect(read(p.ledger).entries.slice(0,93)).toEqual(p.before.entries);
});
it.each(['omitted_scope','wrong_scope','wrong_calls','unknown_scope','duplicate_scope'])('repair14 rejects %s before config/key access',async kind=>{
  const t=setup('repair14'),p=paid(t,93);
  if(kind==='unknown_scope'||kind==='duplicate_scope')await expect(runContextualLive(['--prepare','--scope',kind==='unknown_scope'?'positive-mixed':'repair14',...(kind==='duplicate_scope'?['--scope','full']:[]),'--output',join(t.root,'bad')])).rejects.toThrow();
  else {const o={...p.o};if(kind==='omitted_scope')delete (o as any).scope;if(kind==='wrong_scope')o.scope='full';if(kind==='wrong_calls')o.approvedMaxCalls=139;await expect(executeContextualLive(o)).rejects.toThrow();}
  expect(config.reads).toBe(0);expect(existsSync(p.o.output)).toBe(false);
});
it('repair14 format failure stops after one call and retains its fourteen-row denominator',async()=>{
  const t=setup('repair14'),output=join(t.root,'mock');const r=await executeContextualLive({mode:'mock',scope:'repair14',prepared:t.prepared,output},()=>reply(''));
  expect(r).toMatchObject({status:'CX_STOPPED',attempted:1,completed:0,spec:{scope:'repair14',turns:14}});const rows=read(join(output,'results.json'));expect(rows.map((r:any)=>r.id)).toEqual(repairIds);expect(rows.slice(1).every((r:any)=>r.execution==='NOT_SENT')).toBe(true);
});
const mixedVariants=['CX-S02/hide','CX-S02/private-reason','CX-S06/positive','CX-S06/neutral','CX-S07/show-both','CX-S07/mask-negative','CX-S07/show-both-formal','CX-S07/mask-negative-formal'];
const mixedIds=mixedVariants.flatMap(id=>[0,1,2].map(turn=>`${id}/${turn}`));
it('mixed22 fixes 24 turns and 22 generations without changing the historical full/repair14 fixtures',()=>{
  const full=buildContextualLivePreparation(),repair=buildContextualLivePreparation('repair14'),mixed=buildContextualLivePreparation('mixed22');
  expect(full.spec.fixture.flows.find(f=>f.id==='CX-S07')!.variants.map(v=>v.id)).toEqual(['show-both','mask-negative']);expect(repair.spec.bounds.map(b=>b.id)).toEqual(repairIds);
  expect(mixed.spec).toMatchObject({scope:'mixed22',flows:3,variants:8,turns:24,newCalls:22,authorizationOriginCalls:64,claims:{fullSuite:'NOT_EVALUATED'}});
  expect(mixed.spec.bounds.map(b=>b.id)).toEqual(mixedIds.filter(id=>!['CX-S02/hide/0','CX-S02/private-reason/0'].includes(id)));expect(mixed.spec.reservationUsd).toBeLessThan(.2);
});
it('mixed22 actually carries formal public/partial mask across history while casual controls and reengagement remain distinct',async()=>{
  const t=setup('mixed22'),output=join(t.root,'mock'),r=await executeContextualLive({mode:'mock',scope:'mixed22',prepared:t.prepared,output});
  expect(r).toMatchObject({status:'CX_MOCK_PASS',attempted:22,completed:22,silent:2});const rows=read(join(output,'results.json'));expect(rows.map((r:any)=>r.id)).toEqual(mixedIds);
  for(const variant of ['show-both','mask-negative','show-both-formal','mask-negative-formal']){
    const group=rows.filter((r:any)=>r.id.startsWith(`CX-S07/${variant}/`)),formal=variant.endsWith('-formal'),masked=variant.startsWith('mask-negative');expect(group).toHaveLength(3);
    expect(group.map((r:any)=>r.plan.speechStyle.register)).toEqual(Array(3).fill(formal?'formal':'casual'));
    expect(group.map((r:any)=>r.plan.speechStyle.discomfortTone)).toEqual(Array(3).fill(masked?'masked':'sharp'));
    expect(group.map((r:any)=>r.control.initialRegisterOverride)).toEqual(formal?['formal',null,null]:[null,null,null]);
    expect(group[1].context.conversation.turns[1].text).toEqual(group[0].output.join(' '));expect(group[2].context.conversation.turns.at(-1).text).toEqual(group[1].output.join(' '));
    expect(group.every((r:any)=>r.control.state.affect.joy.value===.7&&r.control.state.affect.frustration.value===.7)).toBe(true);
  }
  expect(rows.find((r:any)=>r.id==='CX-S02/hide/1').plan.reengagement.disclosure).toBe('deflect');
});
it.each(['omitted','hash','count','prefix','cap','unresolved'])('live admission rejects changed or missing approval origin: %s',async kind=>{
  const t=setup('mixed22'),p=paid(t,107),fetch=vi.fn(async()=>reply());vi.stubGlobal('fetch',fetch);
  if(kind==='omitted')delete (p.o as any).authorizationOriginLedger;
  else if(kind==='hash')p.o.approvedOriginHash='0'.repeat(64);
  else {const origin=read(p.origin);if(kind==='count')origin.entries.push({...origin.entries[0],id:'reset-at-later-run'});if(kind==='prefix')origin.entries[0].usd=.011;if(kind==='cap')origin.limitUsd=.3;if(kind==='unresolved')origin.entries[0].status='unknown';write(p.origin,origin);p.o.approvedOriginHash=createHash('sha256').update(readFileSync(p.origin)).digest('hex');}
  const before=readFileSync(p.ledger,'utf8');await expect(executeContextualLive(p.o)).rejects.toThrow();expect(fetch).not.toHaveBeenCalled();expect(readFileSync(p.ledger,'utf8')).toBe(before);expect(existsSync(p.o.output)).toBe(false);expect(existsSync(p.ledger+'.o1-dev.lock')).toBe(false);
  if(['omitted','hash','count','unresolved'].includes(kind))expect(config.reads).toBe(0);
});
it('mixed22 spends from the original 64-call grant, not a fresh per-run .20, and binds 107 to 129',async()=>{
  const t=setup('mixed22'),p=paid(t,107);p.before.entries[64]!.usd=.021462;write(p.ledger,p.before);p.o.expectedLedgerHash=createHash('sha256').update(readFileSync(p.ledger)).digest('hex');
  vi.stubGlobal('fetch',vi.fn(async(_url,init)=>reply('확인했어.',JSON.parse(String(init.body)))));
  const r=await executeContextualLive(p.o);expect(r).toMatchObject({status:'CX_REVIEW_REQUIRED',attempted:22,completed:22,silent:2,maxCumulativeCalls:129,authorizationOrigin:{calls:64,spentUsd:.01}});expect(r.authorizationSpentBefore).toBeCloseTo(.021462,10);expect(r.authorizationSpentAfter).toBeCloseTo(.021462+r.newCostUsd,10);expect(r.authorizationRemainingUsd).toBeCloseTo(.2-.021462-r.newCostUsd,10);expect(read(p.ledger).entries.slice(0,107)).toEqual(p.before.entries);
});
it('prior grant spending rejects a batch even when the project ledger has room for its reservation',async()=>{
  const t=setup('mixed22'),p=paid(t,107),origin=read(p.origin);origin.limitUsd=.5;p.before.limitUsd=.5;p.before.entries[64]!.usd=.18;write(p.origin,origin);write(p.ledger,p.before);config.text=config.text.replace('DEEPSEEK_BUDGET_USD=.21','DEEPSEEK_BUDGET_USD=.5');p.o.approvedOriginHash=createHash('sha256').update(readFileSync(p.origin)).digest('hex');p.o.expectedLedgerHash=createHash('sha256').update(readFileSync(p.ledger)).digest('hex');
  const fetch=vi.fn(async()=>reply());vi.stubGlobal('fetch',fetch);await expect(executeContextualLive(p.o)).rejects.toThrow('cx_authorization_remaining_budget');expect(fetch).not.toHaveBeenCalled();expect(existsSync(p.o.output)).toBe(false);
});
it('live CLI requires explicit origin flags as well as existing hash, money, count and synthetic approval',async()=>{
  const t=setup('mixed22'),p=paid(t,107),args=['--live','--scope','mixed22','--prepared',t.prepared,'--output',p.o.output,'--config',p.o.config,'--approved-request-hash',p.o.approvedHash,'--approved-additional-usd','.2','--expected-ledger-hash',p.o.expectedLedgerHash,'--expected-prior-calls','107','--approved-max-calls','129'];
  await expect(runContextualLive([...args,'--allow-paid-synthetic','true'])).rejects.toThrow('cx_live_approval_flags_required');expect(config.reads).toBe(0);
  vi.stubGlobal('fetch',vi.fn(async(_url,init)=>reply('확인했어.',JSON.parse(String(init.body)))));
  const r:any=await runContextualLive([...args,'--authorization-origin-ledger',p.origin,'--approved-origin-hash',p.o.approvedOriginHash,'--allow-paid-synthetic','true']);expect(r.attempted).toBe(22);expect(r.authorizationOrigin.fileHash).toBe(p.o.approvedOriginHash);
});
