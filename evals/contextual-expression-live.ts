// Controlled CX generation only. This runner does not appraise events or use Stage/DB.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync,existsSync,openSync,closeSync,unlinkSync} from 'node:fs';
import {resolve,relative,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {parseEnv} from 'node:util';
import {createHash} from 'node:crypto';
import {contextualFixtures} from './contextual-expression.ts';
import {initialState,apply,decay,speechStyle,dialoguePlan,continueRegister} from '../packages/character-core/src/index.ts';
import type {Plan} from '../packages/contracts/src/domain.ts';
import type {DialogueContext} from '../packages/contracts/src/ai-ports.ts';
import type {ConversationSnapshot} from '../packages/contracts/src/conversation.ts';
import {buildDialogueRequest} from '../packages/adapters/src/dialogue-request.ts';
import {DeepSeekDialogue,deepseekPayload,type DeepSeekResponseRecord} from '../packages/adapters/src/deepseek.ts';
import {DeepSeekBudget,deepseekCandidate,deepseekInputBound,deepseekReservationUsd} from '../packages/adapters/src/deepseek-budget.ts';

const read=(p:string)=>JSON.parse(readFileSync(p,'utf8'));
const hash=(v:unknown)=>createHash('sha256').update(JSON.stringify(v)).digest('hex');
const fileHash=(p:string)=>createHash('sha256').update(readFileSync(p)).digest('hex');
const write=(p:string,v:unknown)=>writeFileSync(p,JSON.stringify(v,null,2)+'\n');
const base=resolve('J:/ai/ai-character-runtime');
function inside(p:string){const absolute=resolve(p),part=relative(base,absolute);assert(part&&part!=='..'&&!part.startsWith(`..${sep}`)&&!part.startsWith(sep)&&!part.includes(':'),'cx_artifact_path');return absolute;}
const uid=(n:number)=>`91000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const actor=(id:'A'|'B')=>uid(id==='A'?1:2);
export const cxLivePolicy={version:'cx-generation-v1',flows:8,variants:16,turns:48,newCalls:46,additionalUsd:.20,authorizationOriginCalls:64,maxOutputTokens:256} as const;
export type ContextualScope='full'|'repair14'|'mixed22';
const scopePolicy=(scope:ContextualScope)=>{
  assert(scope==='full'||scope==='repair14'||scope==='mixed22','cx_scope_invalid');
  return scope==='full'?cxLivePolicy:scope==='repair14'?{...cxLivePolicy,flows:3,variants:6,turns:14,newCalls:14}:{...cxLivePolicy,flows:3,variants:8,turns:24,newCalls:22};
};
const turnsIn=(scope:ContextualScope,flowId:string)=>scope==='repair14'&&flowId==='CX-S03'?1:3;
type Variant=ReturnType<typeof contextualFixtures>['flows'][number]['variants'][number]&{controlledInitialRegister?:'formal'};
function scopeFixture(scope:ContextualScope){
  const all=contextualFixtures(),flows=all.flows.filter(f=>scope==='full'||(scope==='repair14'?['CX-S03','CX-S06','CX-S07']:['CX-S02','CX-S06','CX-S07']).includes(f.id));
  return {...all,flows:flows.map(flow=>({ ...flow,variants:scope==='mixed22'&&flow.id==='CX-S07'
    ?[...flow.variants,...flow.variants.map(v=>({...v,id:v.id+'-formal',register:'formal' as const,controlledInitialRegister:'formal' as const}))]
    :flow.variants as Variant[]}))};
}
// Extra controls get separate synthetic identities without changing old case IDs.
const controlIndex=(flowId:string,variantIndex:number)=>variantIndex<2?(Number(flowId.slice(-2))-1)*2+variantIndex:100+variantIndex;
type Cursor={state:ReturnType<typeof initialState>;previous:Plan|null;turns:ConversationSnapshot['turns']};
function start(v:Variant,index:number):Cursor{
  let state=initialState(1000);
  if(v.frustration>0)state=apply(state,{eventId:uid(100+index),targetId:v.causeTarget===null?null:actor('A'),now:1000,stimuli:{frustration:v.frustration}});
  if(v.joy>0)state=apply(state,{eventId:uid(200+index),targetId:actor('A'),now:1000,stimuli:{joy:v.joy}});
  return {state,previous:null,turns:[]};
}
function next(v:Variant,index:number,turn:number,c:Cursor){
  c.state=decay(c.state,1000+turn*100);if(v.recoverAtSecond&&turn===1)c.state.affect.frustration.value=0;
  const mask=v.mask?{joy:'mask' as const,discomfort:'mask' as const,embarrassment:'mask' as const}:v.maskDiscomfort?{discomfort:'mask' as const}:{};
  let plan:Plan={...dialoguePlan(c.state,turn===1&&v.silentFirst?'reengage':'question',actor(v.recipient)),speechStyle:speechStyle(c.state,actor(v.recipient),{discomfortTone:v.tone,...mask}),participation:{mode:'speak'}};
  if(turn===0&&v.silentFirst)plan={...plan,action:'listen',participation:{mode:'silent',reason:'withholding'}};
  if(turn===1&&v.silentFirst)plan.reengagement={silenceEventId:uid(1000+index*3),disclosure:'deflect'};
  // Only the first delivery receives the explicit controlled register. Later
  // turns must preserve it through the same continueRegister path as runtime.
  if(turn===0&&v.controlledInitialRegister)plan={...plan,speechStyle:{...plan.speechStyle!,register:v.controlledInitialRegister}};
  plan=continueRegister(c.state,plan,c.previous);
  const input=turn===0?v.text:turn===1&&v.silentFirst?'왜 말 안 해?':turn===1?'모임은 오후 3시야. 몇 시야?':'다른 얘기 하자. 상자는 파란색이야. 무슨 색이지?';
  const eventId=uid(1000+index*3+turn);
  const sources:NonNullable<DialogueContext['sources']>=[
    ...(v.frustration>0&&v.causeTarget!==null?[{id:uid(100+index),revision:'1',identity_id:actor('A'),payload:{text:'너는 쓸모없는 쓰레기야. 꺼져.'}}]:[]),
    ...(v.joy>0?[{id:uid(200+index),revision:'1',identity_id:actor('A'),payload:{text:'네 설명 덕분에 해결했어. 고마워.'}}]:[]),
  ];
  const context:DialogueContext={currentInput:{id:eventId,revision:'1',identity_id:actor(v.recipient),payload:{text:input}},sources,memories:[],
    identities:[{id:actor('A'),displayName:'합성 A'},{id:actor('B'),displayName:'합성 B'}],
    conversation:{version:1,sessionId:uid(300+index),identityId:actor(v.recipient),cutoffEventId:eventId,truncated:false,turns:structuredClone(c.turns)},
    ...(v.silentFirst?{silence:{eventId:uid(1000+index*3),eventRevision:'1',stateVersion:'1',identityId:actor(v.recipient),at:1000,reason:'withholding' as const,sourceRefs:[{kind:'event' as const,id:uid(100+index),version:'1'}],affect:{frustration:v.frustration,joy:v.joy,embarrassment:0,surprise:0,pleasantness:c.state.mood.pleasantness}}}:{})};
  return {plan,context,input,eventId,control:{persona:v.persona??null,personaInterpretation:'NOT_VERIFIED',syntheticCause:true,initialRegisterOverride:turn===0?v.controlledInitialRegister??null:null,state:structuredClone(c.state),intent:v.tone,mask}};
}
function remember(c:Cursor,row:ReturnType<typeof next>,turn:number,output:string[]){
  c.turns.push({role:'user',text:row.input,source:{kind:'event',id:row.eventId,revision:'1'},order:String(turn+1)});
  if(output.length){c.turns.push({role:'assistant',text:output.join(' '),source:{kind:'response',id:uid(10000+Number(row.eventId.slice(-12))),generationEpoch:'1'},order:String(turn+1)});c.previous=row.plan;}
}
const request=(plan:Plan,context:DialogueContext)=>deepseekPayload(buildDialogueRequest(plan,context,deepseekCandidate.model,{promptVariant:'conversation-history-v1'}),256);
export function buildContextualLivePreparation(scope:ContextualScope='full'){
  const policy=scopePolicy(scope),fixture=scopeFixture(scope),bounds:{id:string;inputBound:number;reservationUsd:number}[]=[];
  for(const flow of fixture.flows)for(const [variantIndex,v] of flow.variants.entries()){const index=controlIndex(flow.id,variantIndex),c=start(v,index);for(let turn=0;turn<turnsIn(scope,flow.id);turn++){
    const row=next(v,index,turn,c),spoken=row.plan.participation?.mode==='speak';
    if(spoken){const inputBound=deepseekInputBound(request(row.plan,row.context));bounds.push({id:`${flow.id}/${v.id}/${turn}`,inputBound,reservationUsd:deepseekReservationUsd(inputBound,256)});}
    // Upper bound only: never sent in the real evaluation. A decoded answer has
    // at most 120 characters; all permitted characters need <=3 UTF-8 bytes.
    remember(c,row,turn,spoken?['가'.repeat(120)]:[]);
  }}
  assert.equal(bounds.length,policy.newCalls);
  const sources=['evals/contextual-expression-live.ts','evals/contextual-expression.ts','evals/fixtures/contextual-expression-v1.json','packages/contracts/src/domain.ts','packages/contracts/src/conversation.ts','packages/character-core/src/index.ts','packages/adapters/src/dialogue-request.ts','packages/adapters/src/deepseek.ts','packages/adapters/src/deepseek-budget.ts'];
  const spec={...policy,scope,model:deepseekCandidate.model,fixture,bounds,reservationUsd:bounds.reduce((s,b)=>s+b.reservationUsd,0),sourceHashes:Object.fromEntries(sources.map(p=>[p,fileHash(p)])),claims:{naturalAppraisal:'NOT_VERIFIED',database:'NOT_EXECUTED',browserStage:'NOT_EXECUTED',quality:'REVIEW_REQUIRED',fullSuite:scope==='full'?'REVIEW_REQUIRED':'NOT_EVALUATED'}};
  assert(spec.reservationUsd<=cxLivePolicy.additionalUsd,'cx_full_suite_exceeds_additional_budget');return {spec,requestHash:hash(spec)};
}
export function prepareContextualLive(output:string,scope:ContextualScope='full'){const root=inside(output);assert(!existsSync(root),'evidence_exists');const b=buildContextualLivePreparation(scope);mkdirSync(root);write(resolve(root,'manifest.json'),{status:'CX_PREPARED',...b,paidAuthorization:false,providerCalls:0});return b;}
type Options={mode:'mock'|'live';prepared:string;output:string;scope?:ContextualScope;config?:string;approvedHash?:string;approvedAdditionalUsd?:number;expectedLedgerHash?:string;expectedPriorCalls?:number;approvedMaxCalls?:number;authorizationOriginLedger?:string;approvedOriginHash?:string};
export type ContextualTestTransport=(id:string,body:ReturnType<typeof deepseekPayload>,answer:string)=>Promise<Response>|Response;
export async function executeContextualLive(o:Options,testTransport?:ContextualTestTransport){
  assert(o.mode==='mock'||o.mode==='live');assert(!testTransport||o.mode==='mock','cx_mock_transport_only');
  const scope=o.scope??'full',root=inside(o.output),prepared=inside(o.prepared);assert(!existsSync(root),'evidence_exists');const b=buildContextualLivePreparation(scope),saved=read(resolve(prepared,'manifest.json'));
  assert.equal(saved.status,'CX_PREPARED');assert.deepEqual({spec:saved.spec,requestHash:saved.requestHash},b,'cx_preparation_changed');
  let origin:any={entries:[],limitUsd:.2};let originFileHash:string|null=null;
  if(o.mode==='live'){
    assert.equal(o.approvedHash,b.requestHash,'cx_explicit_request_approval_required');assert.equal(o.approvedAdditionalUsd,.2,'cx_additional_budget_approval_required');assert(/^[a-f0-9]{64}$/.test(o.expectedLedgerHash??''),'cx_ledger_hash_required');assert(Number.isSafeInteger(o.expectedPriorCalls)&&o.expectedPriorCalls!>=64,'cx_prior_calls_required');assert.equal(o.approvedMaxCalls,o.expectedPriorCalls!+b.spec.newCalls,'cx_cumulative_calls_required');assert(o.config,'cx_config_required');
    assert(o.authorizationOriginLedger&&/^[a-f0-9]{64}$/.test(o.approvedOriginHash??''),'cx_approval_origin_required');
    const path=inside(o.authorizationOriginLedger);originFileHash=fileHash(path);assert.equal(originFileHash,o.approvedOriginHash,'cx_approval_origin_changed');origin=read(path);
    assert.equal(origin.entries?.length,cxLivePolicy.authorizationOriginCalls,'cx_approval_origin_count');
    assert(origin.entries.every((e:any)=>e.status==='completed'),'cx_approval_origin_unresolved');
  }
  let key='synthetic-cx-key',ledgerPath=resolve(root,'synthetic-budget.json'),cap=.2,maxCalls=b.spec.newCalls,configHash:string,lock:number|undefined,lockPath='',before:any;
  if(o.mode==='live'){
    const config=parseEnv(readFileSync(o.config!,'utf8'));assert.equal(config.LOCAL_ONLY,'false');assert.equal(config.ALLOW_PAID_PROVIDERS,'true');assert(config.DEEPSEEK_API_KEY?.trim(),'cx_key_required');
    ledgerPath=inside(config.DEEPSEEK_BUDGET_PATH??'');cap=Number(config.DEEPSEEK_BUDGET_USD);maxCalls=Number(config.DEEPSEEK_MAX_CALLS);assert.equal(maxCalls,o.approvedMaxCalls,'cx_config_calls_changed');assert(existsSync(ledgerPath),'cx_existing_ledger_required');
    configHash=hash({provider:'deepseek',model:deepseekCandidate.model,ledgerPath,cap,maxCalls,localOnly:false,allowPaidProviders:true});key=config.DEEPSEEK_API_KEY!;
    lockPath=ledgerPath+'.o1-dev.lock';lock=openSync(lockPath,'wx');
  }else {configHash=hash({mode:'mock',cap,maxCalls});mkdirSync(root);before={version:1,provider:'deepseek',model:deepseekCandidate.model,inputUsdPerMillion:.3,outputUsdPerMillion:1.2,limitUsd:cap,entries:[]};write(ledgerPath,before);}
  try{
    if(o.mode==='live'){
      assert.equal(fileHash(ledgerPath),o.expectedLedgerHash,'cx_ledger_changed');before=read(ledgerPath);assert.equal(before.entries.length,o.expectedPriorCalls,'cx_prior_calls_changed');
      assert.equal(before.limitUsd,origin.limitUsd,'cx_existing_cap_changed');
      assert.deepEqual(before.entries.slice(0,64),origin.entries,'cx_approval_origin_prefix_changed');
    }
    const attempt='CX '+b.requestHash;assert(!before.entries.some((e:any)=>e.authorization===attempt),'cx_attempt_already_recorded');
    const budget=new DeepSeekBudget(ledgerPath,cap,maxCalls,attempt);assert.equal(budget.availability(),null);const startSummary=budget.summary();assert(startSummary.remainingGuardUsd>=b.spec.reservationUsd,'cx_full_suite_budget_required');
    const originSpentUsd=origin.entries.reduce((sum:number,e:any)=>sum+e.usd,0),authorizationSpentBefore=startSummary.enforcedTotalUsd-originSpentUsd;
    assert(authorizationSpentBefore+b.spec.reservationUsd<=.2+1e-12,'cx_authorization_remaining_budget');
    const authorizationOrigin={calls:origin.entries.length,fileHash:originFileHash,entriesHash:hash(origin.entries),spentUsd:originSpentUsd};
    if(o.mode==='live')mkdirSync(root);write(resolve(root,'ledger-before.json'),before);
    const rows:any[]=[],callIds:string[]=[];let stopped:string|null=null;
    const save=()=>write(resolve(root,'results.json'),rows);
    for(const flow of b.spec.fixture.flows){for(const [variantIndex,v] of flow.variants.entries()){const index=controlIndex(flow.id,variantIndex),c=start(v,index);for(let turn=0;turn<turnsIn(scope,flow.id);turn++){
      const control=next(v,index,turn,c),id=`${flow.id}/${v.id}/${turn}`,record:any={id,...control,output:[],request:null,requestHash:null,response:null,call:null,entry:null,execution:'NOT_SENT',quality:'NOT_VERIFIED',stageCaptionMs:null,stageAck:'NOT_EXECUTED'};rows.push(record);save();
      if(stopped)continue;
      if(control.plan.participation?.mode==='silent'){record.execution='SILENT';remember(c,control,turn,[]);save();continue;}
      let drain:Promise<void>|undefined,attempted=false;const started=performance.now();
      try{
        const current=read(ledgerPath);assert.deepEqual(current.entries.slice(0,before.entries.length),before.entries,'cx_history_changed');assert.deepEqual(current.entries.slice(before.entries.length).map((e:any)=>e.id),callIds,'cx_concurrent_ledger_changed');
        let finish=()=>{};drain=new Promise<void>(done=>{finish=done;});
        const provider=new DeepSeekDialogue({localOnly:false,allowPaidProviders:true,apiKey:key,budget,fetcher:async(url,init)=>{
          assert.equal(String(url),'https://api.deepseek.com/chat/completions');assert(!attempted,'cx_duplicate_call');assert.deepEqual(JSON.parse(String(init?.body)),record.request,'cx_request_changed');attempted=true;record.execution='SENT';save();
          if(o.mode==='live')return fetch(url,init);
          const answer=control.plan.speechStyle?.register==='formal'?'확인했습니다.':'확인했어.';
          return testTransport?testTransport(id,record.request,answer):Response.json({model:deepseekCandidate.model,usage:{prompt_tokens:1000,completion_tokens:100},choices:[{finish_reason:'stop',message:{role:'assistant',content:JSON.stringify({...(!control.plan.reengagement?{content:answer}:{}),sentences:[answer]})}}]});
        },onResponse:(response:DeepSeekResponseRecord)=>{record.response=response;save();},onCall:call=>{try{record.call=call;callIds.push(String(call.id));record.entry=read(ledgerPath).entries.find((e:any)=>e.id===call.id);save();}finally{finish();}}});
        const fitted=await provider.fitConversation(control.plan,control.context);record.context={...control.context,conversation:fitted.conversation};record.request=request(control.plan,record.context);record.requestHash=hash(record.request);
        const bound=b.spec.bounds.find(row=>row.id===id)!;assert(deepseekInputBound(record.request)<=bound.inputBound,'cx_prepared_bound_exceeded');
        const authorizationUsed=budget.summary().enforcedTotalUsd-originSpentUsd;assert(authorizationUsed+deepseekReservationUsd(deepseekInputBound(record.request),256)<=.2+1e-12,'cx_additional_budget_exceeded');save();
        record.output=await provider.dialogue(control.plan,record.context);record.execution='DECODED';remember(c,control,turn,record.output);
      }catch(e){record.execution='ERROR';record.error=typeof (e as any)?.code==='string'?(e as any).code:e instanceof Error?e.message:'cx_failed';stopped=record.error;}
      finally{if(attempted&&drain)await drain;record.completionMs=performance.now()-started;save();}
    }}}
    const after=read(ledgerPath);assert.deepEqual(after.entries.slice(0,before.entries.length),before.entries,'cx_history_changed');assert.deepEqual(after.entries.slice(before.entries.length).map((e:any)=>e.id),callIds,'cx_ledger_calls_changed');write(resolve(root,'ledger-after.json'),after);
    const summary=budget.summary(),newCostUsd=summary.enforcedTotalUsd-startSummary.enforcedTotalUsd,authorizationSpentAfter=summary.enforcedTotalUsd-originSpentUsd;assert(authorizationSpentAfter<=.2+1e-12,'cx_additional_budget_exceeded');
    const result={status:stopped?'CX_STOPPED':o.mode==='mock'?'CX_MOCK_PASS':'CX_REVIEW_REQUIRED',mode:o.mode,...b,configHash,ledgerBeforeHash:hash(before),ledgerAfterHash:hash(after),authorizationOrigin,authorizationSpentBefore,authorizationSpentAfter,authorizationRemainingUsd:.2-authorizationSpentAfter,startSummary,summary,newCostUsd,additionalLimitUsd:.2,maxNewCalls:b.spec.newCalls,maxCumulativeCalls:maxCalls,completed:rows.filter(r=>r.execution==='DECODED').length,silent:rows.filter(r=>r.execution==='SILENT').length,attempted:callIds.length,realProviderCalls:o.mode==='live'?callIds.length:0,mockCalls:o.mode==='mock'?callIds.length:0,failure:stopped};
    write(resolve(root,'manifest.json'),result);write(resolve(root,'review-template.json'),{requestHash:b.requestHash,runHash:hash({result,rows}),reviewer:'',flows:b.spec.fixture.flows.map(f=>({id:f.id,status:'NOT_REVIEWED',reason:''}))});return result;
  }finally{if(lock!==undefined){closeSync(lock);unlinkSync(lockPath);}}
}
export async function runContextualLive(rawArgs:string[]){
  const args=[...rawArgs],scopeIndex=args.indexOf('--scope');let scope:ContextualScope='full';
  if(scopeIndex!==-1){assert.equal(args.lastIndexOf('--scope'),scopeIndex,'cx_duplicate_scope');scope=args[scopeIndex+1] as ContextualScope;scopePolicy(scope);args.splice(scopeIndex,2);}
  const mode=args[0];if(mode==='--prepare'){assert.equal(args.length,3);assert.equal(args[1],'--output');return prepareContextualLive(args[2]!,scope);}
  assert(mode==='--rehearse'||mode==='--live');assert.equal(args[1],'--prepared');assert.equal(args[3],'--output');
  if(mode==='--rehearse'){assert.equal(args.length,5);return executeContextualLive({mode:'mock',prepared:args[2]!,output:args[4]!,scope});}
  assert.equal(args.length,23,'cx_live_approval_flags_required');assert.deepEqual(args.filter((_,i)=>i>=5&&i%2===1),['--config','--approved-request-hash','--approved-additional-usd','--expected-ledger-hash','--expected-prior-calls','--approved-max-calls','--authorization-origin-ledger','--approved-origin-hash','--allow-paid-synthetic']);assert.equal(args[22],'true');
  return executeContextualLive({mode:'live',prepared:args[2]!,output:args[4]!,scope,config:args[6],approvedHash:args[8],approvedAdditionalUsd:Number(args[10]),expectedLedgerHash:args[12],expectedPriorCalls:Number(args[14]),approvedMaxCalls:Number(args[16]),authorizationOriginLedger:args[18],approvedOriginHash:args[20]});
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))console.log(JSON.stringify(await runContextualLive(process.argv.slice(2))));
