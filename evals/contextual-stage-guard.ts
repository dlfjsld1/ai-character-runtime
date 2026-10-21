// Evaluation-only accounting. No credentials, directories, providers or network.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,existsSync,openSync,closeSync,unlinkSync} from 'node:fs';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {DeepSeekBudget,deepseekCandidate,deepseekReservationUsd,type DeepSeekUsage} from '../packages/adapters/src/deepseek-budget.ts';

export const stageBudgetPolicy={newCalls:8,inputBound:32768,maxOutputTokens:256,reservationUsd:.0811008,
  additionalUsd:.20,originCalls:64,priorCalls:151,maxCalls:159,limitUsd:.25,mockLimitUsd:.20} as const;
type Entry={id:string;authorization:string;status:'reserved'|'completed'|'unknown';usd:number;inputBound:number;maxOutputTokens:number;usage?:DeepSeekUsage};
type Ledger={version:1;provider:'deepseek';model:'deepseek-flash';inputUsdPerMillion:.3;outputUsdPerMillion:1.2;limitUsd:number;entries:Entry[]};
export type StageBudgetOptions={mode:'mock'|'live';ledgerPath:string;authorization:string;requestHash:string;
  expectedLedgerHash?:string;expectedPriorCalls?:number;approvedMaxCalls?:number;authorizationOriginLedger?:string;approvedOriginHash?:string;approvedAdditionalUsd?:number};
const digest=(value:unknown)=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const fileHash=(path:string)=>createHash('sha256').update(readFileSync(path)).digest('hex');
const read=(path:string)=>JSON.parse(readFileSync(path,'utf8')) as Ledger;
const isHash=(value:unknown)=>typeof value==='string'&&/^[a-f0-9]{64}$/.test(value);
const spent=(ledger:Ledger)=>ledger.entries.reduce((sum,e)=>sum+e.usd,0);

export function openStageBudget(o:StageBudgetOptions){
  assert(o.mode==='mock'||o.mode==='live','stage_budget_mode');
  assert(o.ledgerPath?.trim()&&o.authorization?.trim()&&isHash(o.requestHash),'stage_budget_request_required');
  const path=resolve(o.ledgerPath),lockPath=path+'.o1-dev.lock',authorization=o.authorization.trim()+' '+o.requestHash;
  const limit=o.mode==='live'?stageBudgetPolicy.limitUsd:stageBudgetPolicy.mockLimitUsd;
  const maxCalls=o.mode==='live'?stageBudgetPolicy.maxCalls:stageBudgetPolicy.newCalls;
  let origin:Ledger|undefined,originHash:string|null=null;
  if(o.mode==='live'){
    assert(isHash(o.expectedLedgerHash),'stage_ledger_hash_required');
    assert.equal(o.expectedPriorCalls,stageBudgetPolicy.priorCalls,'stage_prior_calls_required');
    assert.equal(o.approvedMaxCalls,stageBudgetPolicy.maxCalls,'stage_max_calls_required');
    assert.equal(o.approvedAdditionalUsd,stageBudgetPolicy.additionalUsd,'stage_additional_approval_required');
    assert(o.authorizationOriginLedger&&isHash(o.approvedOriginHash),'stage_origin_required');
    originHash=fileHash(o.authorizationOriginLedger);assert.equal(originHash,o.approvedOriginHash,'stage_origin_hash_changed');
    origin=read(o.authorizationOriginLedger);
    const checked=new DeepSeekBudget(o.authorizationOriginLedger,limit,stageBudgetPolicy.originCalls+1,'origin read only').summary();
    assert.equal(checked.attempts,stageBudgetPolicy.originCalls,'stage_origin_count');
    assert.equal(checked.unresolvedEntries,0,'stage_origin_unresolved');
    assert(existsSync(path),'stage_existing_ledger_required');
  }else{
    assert([o.expectedLedgerHash,o.expectedPriorCalls,o.approvedMaxCalls,o.authorizationOriginLedger,o.approvedOriginHash,o.approvedAdditionalUsd].every(v=>v===undefined),'stage_mock_live_flags');
    assert(!existsSync(path),'stage_mock_requires_new_ledger');
  }
  const lock=openSync(lockPath,'wx');let closed=false;
  const release=()=>{if(!closed){closeSync(lock);unlinkSync(lockPath);closed=true;}};
  try{
    if(o.mode==='mock')writeFileSync(path,JSON.stringify({version:1,provider:'deepseek',model:deepseekCandidate.model,inputUsdPerMillion:.3,outputUsdPerMillion:1.2,limitUsd:limit,entries:[]},null,2)+'\n',{flag:'wx'});
    else assert.equal(fileHash(path),o.expectedLedgerHash,'stage_ledger_hash_changed');
    const before=read(path),baseBudget=new DeepSeekBudget(path,limit,maxCalls,authorization),startSummary=baseBudget.summary();
    assert.equal(startSummary.attempts,o.mode==='live'?stageBudgetPolicy.priorCalls:0,'stage_prior_calls_changed');
    assert.equal(startSummary.unresolvedEntries,0,'stage_prior_unresolved');
    assert.equal(baseBudget.availability(),null,'stage_budget_unavailable');
    if(origin)assert.deepEqual(before.entries.slice(0,stageBudgetPolicy.originCalls),origin.entries,'stage_origin_prefix_changed');
    assert(!before.entries.some(e=>e.authorization.endsWith(o.requestHash)),'stage_attempt_already_recorded');
    const originSpentUsd=origin?spent(origin):0,authorizationSpentBefore=startSummary.enforcedTotalUsd-originSpentUsd;
    assert(authorizationSpentBefore+stageBudgetPolicy.reservationUsd<=stageBudgetPolicy.additionalUsd+1e-12,'stage_authorization_remaining');
    assert(startSummary.remainingGuardUsd+1e-12>=stageBudgetPolicy.reservationUsd,'stage_project_remaining');
    const prefix=structuredClone(before.entries);let owned:Entry[]=[];
    const current=()=>{
      const ledger=read(path);
      assert.equal(ledger.limitUsd,limit,'stage_cap_changed');
      assert.deepEqual(ledger.entries.slice(0,prefix.length),prefix,'stage_history_changed');
      assert.deepEqual(ledger.entries.slice(prefix.length),owned,'stage_unexpected_entries');
      return ledger;
    };
    class StageBudget extends DeepSeekBudget {
      override availability(){
        if(closed)return 'stage_budget_closed';
        try{current();return super.availability();}catch(e){return e instanceof Error?e.message:'stage_budget_invalid';}
      }
      override reserve(inputBound:number,maxOutputTokens:number){
        assert(!closed,'stage_budget_closed');assert.equal(maxOutputTokens,stageBudgetPolicy.maxOutputTokens,'stage_output_bound_changed');
        assert(inputBound<=stageBudgetPolicy.inputBound,'stage_input_bound_exceeded');
        const reservation=deepseekReservationUsd(inputBound,maxOutputTokens),ledger=current();
        assert(owned.length<stageBudgetPolicy.newCalls,'stage_new_call_limit');
        assert(spent(ledger)-originSpentUsd+reservation<=stageBudgetPolicy.additionalUsd+1e-12,'stage_authorization_exceeded');
        const id=super.reserve(inputBound,maxOutputTokens);owned=structuredClone(read(path).entries.slice(prefix.length));return id;
      }
      override finish(id:string,usage?:DeepSeekUsage){
        assert(!closed,'stage_budget_closed');current();assert(owned.some(e=>e.id===id),'stage_foreign_call');
        const ok=super.finish(id,usage);owned=structuredClone(read(path).entries.slice(prefix.length));return ok;
      }
    }
    const budget=new StageBudget(path,limit,maxCalls,authorization);
    const accounting=()=>{
      const after=current(),summary=budget.summary(),authorizationSpentAfter=summary.enforcedTotalUsd-originSpentUsd;
      return {beforeHash:digest(before),afterHash:digest(after),authorization,requestHash:o.requestHash,
        authorizationOrigin:{calls:origin?.entries.length??0,fileHash:originHash,entriesHash:digest(origin?.entries??[]),spentUsd:originSpentUsd},
        startSummary,summary,newCalls:after.entries.length-before.entries.length,newCostUsd:summary.enforcedTotalUsd-startSummary.enforcedTotalUsd,
        authorizationSpentBefore,authorizationSpentAfter,authorizationRemainingUsd:stageBudgetPolicy.additionalUsd-authorizationSpentAfter,
        withinAuthorization:authorizationSpentAfter<=stageBudgetPolicy.additionalUsd+1e-12,priorPrefixPreserved:true,after:structuredClone(after)};
    };
    return {budget,before:structuredClone(before),startSummary,accounting,
      // The owner must await the adapter's physical onCall callbacks before this.
      // An unknown settled charge may close; an outstanding reservation may not.
      close:(confirmation:{physicalDrained:true})=>{assert(confirmation?.physicalDrained===true,'stage_physical_drain_required');if(closed)return;assert(!read(path).entries.slice(prefix.length).some(e=>e.status==='reserved'),'stage_reserved_call_pending');release();}};
  }catch(error){release();throw error;}
}
