import {it,expect,afterEach,vi} from 'vitest';
import {readFileSync,writeFileSync,mkdtempSync,rmSync,existsSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,dirname,resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {openStageBudget,stageBudgetPolicy,type StageBudgetOptions} from './contextual-stage-guard.ts';
import {deepseekReservationUsd} from '../packages/adapters/src/deepseek-budget.ts';
const dirs:string[]=[],read=(p:string)=>JSON.parse(readFileSync(p,'utf8')),write=(p:string,v:unknown)=>writeFileSync(p,JSON.stringify(v,null,2)+'\n');
const hash=(p:string)=>createHash('sha256').update(readFileSync(p)).digest('hex');
afterEach(()=>{for(const p of dirs.splice(0)){expect(dirname(resolve(p))).toBe(resolve(tmpdir()));rmSync(p,{recursive:true,force:true});}vi.unstubAllGlobals();});
function setup(live=false){
  const root=mkdtempSync(join(tmpdir(),'cx-stage-guard-'));dirs.push(root);
  const o:StageBudgetOptions={mode:live?'live':'mock',ledgerPath:join(root,'synthetic-ledger.json'),authorization:'CX Stage synthetic test',requestHash:'a'.repeat(64)};
  if(live){
    const entries=Array.from({length:151},(_,i)=>({id:`synthetic-${i}`,authorization:'prior synthetic',status:'completed',usd:i===0?.0630888:i===64?.0479277:0,inputBound:32768,maxOutputTokens:256}));
    const ledger={version:1,provider:'deepseek',model:'deepseek-flash',inputUsdPerMillion:.3,outputUsdPerMillion:1.2,limitUsd:.25,entries};
    write(o.ledgerPath,ledger);const origin=join(root,'synthetic-origin.json');write(origin,{...ledger,entries:entries.slice(0,64)});
    Object.assign(o,{expectedLedgerHash:hash(o.ledgerPath),expectedPriorCalls:151,approvedMaxCalls:159,authorizationOriginLedger:origin,approvedOriginHash:hash(origin),approvedAdditionalUsd:.2});
  }return {root,o};
}
it('fixes eight maximum-size calls below both current limits without provider access',()=>{
  expect(stageBudgetPolicy).toMatchObject({newCalls:8,priorCalls:151,maxCalls:159,originCalls:64,limitUsd:.25,additionalUsd:.2});
  expect(8*deepseekReservationUsd(32768,256)).toBeCloseTo(.0811008,12);expect(stageBudgetPolicy.reservationUsd).toBe(.0811008);
  const network=vi.fn(()=>{throw Error('no network');});vi.stubGlobal('fetch',network);const {o}=setup(),g=openStageBudget(o);expect(g.startSummary.attempts).toBe(0);g.close({physicalDrained:true});expect(network).not.toHaveBeenCalled();
});
it('creates only a fresh synthetic ledger in mock mode and refuses an existing one',()=>{
  const {o}=setup(),g=openStageBudget(o),bytes=readFileSync(o.ledgerPath,'utf8');g.close({physicalDrained:true});
  expect(()=>openStageBudget(o)).toThrow('stage_mock_requires_new_ledger');expect(readFileSync(o.ledgerPath,'utf8')).toBe(bytes);expect(existsSync(o.ledgerPath+'.o1-dev.lock')).toBe(false);
});
it('never creates a missing output directory',()=>{const {root,o}=setup();o.ledgerPath=join(root,'not-created','budget.json');expect(()=>openStageBudget(o)).toThrow();expect(existsSync(join(root,'not-created'))).toBe(false);});
it('preserves 151 entries, charges against original64, allows exactly8 calls and retains historical cap',()=>{
  const {o}=setup(true),before=read(o.ledgerPath),g=openStageBudget(o);expect(g.accounting().authorizationSpentBefore).toBeCloseTo(.0479277,12);
  for(let i=0;i<8;i++){const id=g.budget.reserve(32768,256);expect(g.budget.finish(id,{prompt_tokens:1000,completion_tokens:100})).toBe(true);}
  const final=g.accounting();expect(final.newCalls).toBe(8);expect(final.summary).toMatchObject({attempts:159,limitUsd:.25,unresolvedEntries:0});expect(final.authorizationSpentAfter).toBeCloseTo(.0479277+8*.00042,12);expect(final.after.entries.slice(0,151)).toEqual(before.entries);
  const bytes=readFileSync(o.ledgerPath,'utf8');expect(()=>g.budget.reserve(1024,256)).toThrow('stage_new_call_limit');expect(readFileSync(o.ledgerPath,'utf8')).toBe(bytes);g.close({physicalDrained:true});expect(existsSync(o.ledgerPath+'.o1-dev.lock')).toBe(false);expect(()=>g.budget.reserve(1024,256)).toThrow('stage_budget_closed');
});
it.each(['expectedLedgerHash','expectedPriorCalls','approvedMaxCalls','authorizationOriginLedger','approvedOriginHash','approvedAdditionalUsd'] as const)('requires explicit live %s without ledger changes',field=>{
  const {o}=setup(true),bytes=readFileSync(o.ledgerPath,'utf8');delete o[field];expect(()=>openStageBudget(o)).toThrow();expect(readFileSync(o.ledgerPath,'utf8')).toBe(bytes);expect(existsSync(o.ledgerPath+'.o1-dev.lock')).toBe(false);
});
it.each(['ledger_hash','origin_hash','origin_count','origin_prefix','origin_unresolved','origin_cap','current_cap','current_unresolved','current_count','call_limit','budget_approval','duplicate_attempt','project_remaining','grant_remaining','run_lock'])('rejects invalid %s without changing existing ledger bytes',kind=>{
  const {o}=setup(true),ledger=read(o.ledgerPath),origin=read(o.authorizationOriginLedger!);
  if(kind==='origin_count')origin.entries.pop();if(kind==='origin_prefix')origin.entries[0].usd=.02;if(kind==='origin_unresolved')origin.entries[0].status='unknown';if(kind==='origin_cap')origin.limitUsd=.2;
  if(kind==='current_cap')ledger.limitUsd=.3;if(kind==='current_unresolved')ledger.entries[150].status='reserved';if(kind==='current_count')ledger.entries.pop();if(kind==='duplicate_attempt')ledger.entries[150].authorization='previous label '+o.requestHash;
  if(kind==='project_remaining')ledger.entries[64].usd=.11;
  if(kind==='grant_remaining'){ledger.entries[0].usd=0;origin.entries[0].usd=0;ledger.entries[64].usd=.15;}
  write(o.authorizationOriginLedger!,origin);write(o.ledgerPath,ledger);o.expectedLedgerHash=hash(o.ledgerPath);o.approvedOriginHash=hash(o.authorizationOriginLedger!);
  if(kind==='ledger_hash')o.expectedLedgerHash='0'.repeat(64);if(kind==='origin_hash')o.approvedOriginHash='0'.repeat(64);if(kind==='call_limit')o.approvedMaxCalls=160;if(kind==='budget_approval')o.approvedAdditionalUsd=.21;if(kind==='run_lock')write(o.ledgerPath+'.o1-dev.lock',{otherOwner:true});
  const bytes=readFileSync(o.ledgerPath,'utf8');expect(()=>openStageBudget(o)).toThrow(kind==='grant_remaining'?'stage_authorization_remaining':undefined);expect(readFileSync(o.ledgerPath,'utf8')).toBe(bytes);expect(existsSync(o.ledgerPath+'.o1-dev.lock')).toBe(kind==='run_lock');
});
it.each(['history','foreign_entry','owned_entry','cap'])('refuses unexpected %s mutation before another reservation',kind=>{
  const {o}=setup(true),g=openStageBudget(o);const id=g.budget.reserve(1024,256);g.budget.finish(id,{prompt_tokens:1000,completion_tokens:100});const ledger=read(o.ledgerPath);
  if(kind==='history')ledger.entries[0].usd+=.001;if(kind==='foreign_entry')ledger.entries.push({...ledger.entries[0],id:'foreign'});if(kind==='owned_entry')ledger.entries[151].usd=0;if(kind==='cap')ledger.limitUsd=.3;write(o.ledgerPath,ledger);
  const bytes=readFileSync(o.ledgerPath,'utf8');expect(()=>g.budget.reserve(1024,256)).toThrow();expect(()=>g.accounting()).toThrow();expect(readFileSync(o.ledgerPath,'utf8')).toBe(bytes);g.close({physicalDrained:true});
});
it.each([[32769,256],[32768,512],[0,256]])('rejects request bound %s/%s before reservation', (input,output)=>{const {o}=setup(),g=openStageBudget(o),bytes=readFileSync(o.ledgerPath,'utf8');expect(()=>g.budget.reserve(input,output)).toThrow();expect(readFileSync(o.ledgerPath,'utf8')).toBe(bytes);g.close({physicalDrained:true});});
it('keeps the run lock until explicit physical drain and settlement, then records unknown usage without retry',()=>{
  const {o}=setup(),g=openStageBudget(o),id=g.budget.reserve(1024,256);
  expect(()=>(g.close as any)()).toThrow('stage_physical_drain_required');expect(()=>g.close({physicalDrained:true})).toThrow('stage_reserved_call_pending');expect(existsSync(o.ledgerPath+'.o1-dev.lock')).toBe(true);
  expect(g.budget.finish(id)).toBe(false);expect(g.accounting().summary.unresolvedEntries).toBe(1);expect(()=>g.budget.reserve(1024,256)).toThrow('deepseek_usage_unconfirmed');g.close({physicalDrained:true});expect(existsSync(o.ledgerPath+'.o1-dev.lock')).toBe(false);
});
it('cannot settle a historical call or mutate mock mode into live admission',()=>{
  const {o}=setup(true),g=openStageBudget(o),bytes=readFileSync(o.ledgerPath,'utf8');expect(()=>g.budget.finish('synthetic-0',{prompt_tokens:0,completion_tokens:0})).toThrow('stage_foreign_call');expect(readFileSync(o.ledgerPath,'utf8')).toBe(bytes);g.close({physicalDrained:true});
  const mock=setup();mock.o.authorizationOriginLedger=o.authorizationOriginLedger;expect(()=>openStageBudget(mock.o)).toThrow('stage_mock_live_flags');expect(existsSync(mock.o.ledgerPath)).toBe(false);
});
