// C2-P preparation, explicit live admission, and offline rehearsal/replay.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync,existsSync,openSync,closeSync,unlinkSync} from 'node:fs';
import {resolve,relative,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {parseEnv} from 'node:util';
import {createHash} from 'node:crypto';
import {z} from 'zod';
import {buildReconnectPreparation,checkReconnectCandidate,ensureReconnectSceneBudget} from './affect-reconnect.ts';
import {prepareOutcomeProbe} from '../packages/adapters/src/outcome-probe.ts';
import {prepareAppraisalProbe} from '../packages/adapters/src/appraisal-probe.ts';
import {DeepSeekOutcomeProbe,DeepSeekAppraisalProbe,deepseekPayload,type DeepSeekResponseRecord} from '../packages/adapters/src/deepseek.ts';
import {DeepSeekBudget,deepseekCandidate,deepseekInputBound} from '../packages/adapters/src/deepseek-budget.ts';
import {SplitEventInterpreter} from '../packages/adapters/src/split-event-interpreter.ts';
import {appendEventAffect} from '../packages/character-core/src/event-affect.ts';
import {authoredProbeOutcome} from './affect-outcome-probe.ts';
import type {EventInterpretation} from '../packages/contracts/src/affect-appraisal.ts';

type Split='dev'|'confirm';type Stage='outcome'|'appraisal';
const base=resolve('J:/ai/ai-character-runtime');
const read=(p:string)=>JSON.parse(readFileSync(p,'utf8'));
const hash=(v:unknown)=>createHash('sha256').update(JSON.stringify(v)).digest('hex');
const write=(p:string,v:unknown)=>writeFileSync(p,JSON.stringify(v,null,2));
function inside(p:string){assert(p,'c2p_path_required');const absolute=resolve(p),part=relative(base,absolute);assert(part&&part!=='..'&&!part.startsWith(`..${sep}`)&&!part.startsWith(sep)&&!part.includes(':'),'c2p_artifact_path');return absolute;}
// Starts from the 2026-10-18 ledger (159 completed entries, USD0.1161756); cap raised to 0.35 by user approval 2026-10-21.
export const c2pPolicy={dev:{totalUsd:.35,priorCalls:159,maxCalls:183},confirm:{totalUsd:.35,priorCalls:183,maxCalls:207}} as const;
export function buildC2P(split:Split){
  const current=buildReconnectPreparation(split),runnerHash=createHash('sha256').update(readFileSync(fileURLToPath(import.meta.url))).digest('hex');
  const spec={version:'c2p-v1',prepared:current.prepared,runnerHash,policy:c2pPolicy[split],newCalls:24,model:deepseekCandidate.model};
  return {current,spec,requestHash:hash(spec)};
}
function preparedAt(p:string){const stored=read(resolve(p,'manifest.json')),built=buildC2P(stored.spec?.prepared?.split);
  assert.equal(stored.status,'C2P_PREPARED');assert.deepEqual(stored.spec,built.spec,'c2p_sources_changed');assert.equal(stored.requestHash,built.requestHash,'c2p_request_changed');
  assert.deepEqual(read(resolve(p,'requests.json')),built.current.requests);assert.deepEqual(read(resolve(p,'original-inputs.json')),built.current.originals);return built;}
export function prepareC2P(split:Split,output:string){const root=inside(output);assert(!existsSync(root),'evidence_exists');const b=buildC2P(split);mkdirSync(root);
  write(resolve(root,'manifest.json'),{status:'C2P_PREPARED',...b, current:undefined,paidAuthorization:false,realProviderCalls:0});
  write(resolve(root,'requests.json'),b.current.requests);write(resolve(root,'original-inputs.json'),b.current.originals);return {requestHash:b.requestHash,spec:b.spec};}
type RecordStage={execution:'NOT_SENT'|'ERROR'|'DECODED';attempted:boolean;body:ReturnType<typeof deepseekPayload>|null;response:DeepSeekResponseRecord|null;rawHash:string|null;call:any;entry:any;error:string|null};
const empty=():RecordStage=>({execution:'NOT_SENT',attempted:false,body:null,response:null,rawHash:null,call:null,entry:null,error:null});
type Row={id:string;outcome:RecordStage;appraisal:RecordStage;result:any;checks:any;core:any};
const counts=(rows:Row[])=>({planned:12,attempted:rows.filter(r=>r.outcome.attempted).length,calls:rows.reduce((n,r)=>n+Number(r.outcome.attempted)+Number(r.appraisal.attempted),0),interpreted:rows.filter(r=>r.result?.status==='interpreted').length,rubricMatched:rows.filter(r=>r.checks?.status==='REVIEW_REQUIRED').length,semanticQuality:'NOT_VERIFIED'});
export type C2PTestTransport=(id:string,stage:Stage,body:ReturnType<typeof deepseekPayload>,authored:unknown)=>Promise<Response>|Response;
const reviewSchema=z.object({version:z.literal('c2p-review-v1'),runHash:z.string(),requestHash:z.string(),reviewer:z.string().min(1),
  cases:z.array(z.object({id:z.string(),accepted:z.literal(true),reason:z.string().min(1)}).strict()).length(12)}).strict();
export async function requireC2PDevelopment(run:string,review:string){
  const checked=await inspectC2P(inside(run)),r=reviewSchema.parse(read(inside(review)));
  assert.equal(checked.manifest.mode,'live','c2p_live_development_required');assert.equal(checked.manifest.spec.prepared.split,'dev');
  assert.equal(checked.manifest.status,'C2P_REVIEW_REQUIRED');assert.deepEqual(checked.manifest.comparison,{planned:12,attempted:12,calls:24,interpreted:12,rubricMatched:12,semanticQuality:'NOT_VERIFIED'});
  assert.equal(r.runHash,hash({manifest:checked.manifest,rows:checked.rows}),'c2p_review_run_changed');assert.equal(r.requestHash,checked.manifest.requestHash);
  assert.deepEqual(r.cases.map(c=>c.id),checked.rows.map(r=>r.id));return {runHash:r.runHash,reviewHash:hash(r),reviewer:r.reviewer,ledgerEntriesHash:checked.ledgerEntriesHash};
}
function syntheticAnswer(b:ReturnType<typeof buildC2P>,i:number,stage:Stage,body:ReturnType<typeof deepseekPayload>){
  const item=b.current.suite.cases[i]!,view=JSON.parse(body.messages.at(-1)!.content);
  if(stage==='outcome'){const e=item.expected.outcome;return authoredProbeOutcome(view,e===null?null:{...e,result:e.result[0]!});}
  const input=view.input,current=input.sources.find((s:any)=>s.id===input.eventId),persona=input.sources.find((s:any)=>s.kind==='persona');
  const quote=(s:any,text=s.text)=>({sourceId:s.id,revision:s.revision,quote:text});
  const actor=(value:string|null)=>value===null?null:value==='speaker'?input.speakerId:value==='character'?input.scope.characterId:input.actors[2].id;
  return {status:item.authored.status,appraisals:item.authored.observations.map(o=>{const episode=o.scope==='episode'?input.sources.find((s:any)=>s.id===view.fixedOutcome?.episodeId):null,prior=o.expectation?input.sources.find((s:any)=>s.kind==='expectation'):null;
    return {episodeId:episode?.id??null,concern:{source:quote(persona)},evidence:[quote(current,o.quote),...(episode?[quote(episode)]:[])],actorId:actor(o.actor),targetId:actor(o.target),stance:o.stance,agency:o.agency,relevance:1,importance:.8,congruence:o.congruence,certainty:.8,controllability:null,expectedness:prior ? .2 : null,expectation:prior?quote(prior):null};})};
}
type RunOptions={mode:'mock'|'live';prepared:string;output:string;approvedHash?:string;approvedUsd?:number;approvedCalls?:number;devRun?:string;devReview?:string};
export async function executeC2P(o:RunOptions,testTransport?:C2PTestTransport){
  assert(o.mode==='mock'||o.mode==='live');assert(!testTransport||o.mode==='mock','c2p_mock_transport_only');
  const root=inside(o.output),prepared=inside(o.prepared);assert(!existsSync(root),'evidence_exists');const b=preparedAt(prepared),policy=b.spec.policy;
  let devGate:Awaited<ReturnType<typeof requireC2PDevelopment>>|null=null;
  // No secret or real ledger I/O until all request/split/approval gates pass.
  if(o.mode==='live'){
    assert.equal(o.approvedHash,b.requestHash,'c2p_explicit_request_approval_required');assert.equal(o.approvedUsd,policy.totalUsd,'c2p_approved_cap');assert.equal(o.approvedCalls,policy.maxCalls,'c2p_approved_calls');
    if(b.spec.prepared.split==='confirm'){assert(o.devRun&&o.devReview,'c2p_development_review_required');devGate=await requireC2PDevelopment(o.devRun,o.devReview);}
    else assert(!o.devRun&&!o.devReview,'c2p_unexpected_review');
  }
  let key='synthetic-c2p-key',ledgerPath=resolve(root,'synthetic-budget.json'),lock:number|undefined,lockPath='',before:any,budget:DeepSeekBudget,owned=false;
  const attempt='C2P '+b.spec.prepared.split+' '+b.requestHash;
  if(o.mode==='live'){
    const config=parseEnv(readFileSync('runtime-data/deepseek.env','utf8'));
    assert.equal(config.LOCAL_ONLY,'false');assert.equal(config.ALLOW_PAID_PROVIDERS,'true');assert(config.DEEPSEEK_API_KEY?.trim()&&config.DEEPSEEK_BUDGET_AUTHORIZATION?.trim(),'c2p_config_required');
    assert.equal(Number(config.DEEPSEEK_BUDGET_USD),policy.totalUsd);assert.equal(Number(config.DEEPSEEK_MAX_CALLS),policy.maxCalls);
    ledgerPath=inside(config.DEEPSEEK_BUDGET_PATH??'');assert(existsSync(ledgerPath),'c2p_existing_ledger_required');key=config.DEEPSEEK_API_KEY!;
    lockPath=ledgerPath+'.o1-dev.lock';lock=openSync(lockPath,'wx');
  }
  try{
    if(o.mode==='mock'){
      mkdirSync(root);owned=true;before={version:1,provider:'deepseek',model:deepseekCandidate.model,inputUsdPerMillion:.3,outputUsdPerMillion:1.2,limitUsd:policy.totalUsd,
        entries:Array.from({length:policy.priorCalls},(_,i)=>({id:'synthetic-prior-'+i,authorization:'synthetic historical placeholder',status:'completed',usd:i===0?.1161756:0,inputBound:1000,maxOutputTokens:2048}))};write(ledgerPath,before);
    }else before=read(ledgerPath);
    assert.equal(before.entries.length,policy.priorCalls,'c2p_prior_calls_changed');assert(!before.entries.some((e:any)=>e.authorization.endsWith(attempt)),'c2p_attempt_already_recorded');
    // Bind confirmation to the reviewed development history while holding the run lock.
    // Hash entries only: the separately approved total limit can increase.
    if(devGate)assert.equal(hash(before.entries),devGate.ledgerEntriesHash,'c2p_development_ledger_changed');
    budget=new DeepSeekBudget(ledgerPath,policy.totalUsd,policy.maxCalls,attempt);
    assert.equal(budget.availability(),null);assert(budget.summary().remainingGuardUsd>=b.spec.prepared.reservationUsd,'c2p_full_split_budget_required');
    if(!owned){mkdirSync(root);owned=true;}
    write(resolve(root,'ledger-before.json'),before);
    const rows:Row[]=b.current.originals.map(r=>({id:r.id,outcome:empty(),appraisal:empty(),result:null,checks:null,core:null}));
    const save=()=>write(resolve(root,'results.json'),rows);save();
    for(const [i,row] of rows.entries()){
      const input=b.current.originals[i]!.request;
      function probe(stage:'outcome'):Promise<EventInterpretation['outcome']>;
      function probe(stage:'appraisal',fixed:EventInterpretation['outcome']):Promise<EventInterpretation>;
      async function probe(stage:Stage,fixed:EventInterpretation['outcome']=null){
        const rec=row[stage];let settled:Promise<void>|undefined;
        try{
          if(stage==='outcome')ensureReconnectSceneBudget(budget,b.current.requests[i]!.reservationUsd);
          rec.body=deepseekPayload(stage==='outcome'?prepareOutcomeProbe(input).request:prepareAppraisalProbe(input,fixed).request,2048);
          assert(deepseekInputBound(rec.body)<=deepseekCandidate.inputBound,'c2p_context_limit');save();
          let finish:()=>void=()=>{};settled=new Promise<void>(done=>{finish=done;});
          const options={localOnly:false,allowPaidProviders:true,apiKey:key,budget,fetcher:async(url:Parameters<typeof fetch>[0],init?:Parameters<typeof fetch>[1])=>{
            assert.equal(String(url),'https://api.deepseek.com/chat/completions');assert(!rec.attempted,'c2p_duplicate_call');assert.deepEqual(JSON.parse(String(init?.body)),rec.body);rec.attempted=true;save();
            if(o.mode==='live')return fetch(url,init);
            const authored=syntheticAnswer(b,i,stage,rec.body!);return testTransport?testTransport(row.id,stage,rec.body!,authored):Response.json({model:deepseekCandidate.model,usage:{prompt_tokens:1000,completion_tokens:100},choices:[{finish_reason:'stop',message:{role:'assistant',content:JSON.stringify(authored)}}]});
          },onResponse:(response:DeepSeekResponseRecord)=>{rec.response=response;rec.rawHash=hash(response);save();if(response.truncated)throw Error('c2p_raw_truncated');},
          onCall:(call:Record<string,unknown>)=>{try{rec.call=call;rec.entry=read(ledgerPath).entries.find((e:any)=>e.id===call.id);save();}finally{finish();}}};
          const result=stage==='outcome'?(await new DeepSeekOutcomeProbe(options).probe(input)).outcome:await new DeepSeekAppraisalProbe(options).probe(input,fixed);
          rec.execution='DECODED';return result;
        }catch(e){rec.execution='ERROR';rec.error=typeof (e as any)?.code==='string'?(e as any).code:'c2p_stage_failed';throw e;}
        finally{
          // A logical timeout is still a failed stage. Drain its physical callback
          // before freezing evidence or releasing the shared run lock.
          if(rec.attempted&&settled)await settled;save();
        }
      }
      row.result=await new SplitEventInterpreter(()=>probe('outcome'),(_,fixed)=>probe('appraisal',fixed)).interpret(input);
      row.checks=checkReconnectCandidate(b.current.suite.cases[i]!,input,row.result);
      if(row.result.status==='interpreted')row.core=appendEventAffect([],input,row.result.interpretation,input.eventId);save();
      if(row.result.status==='unavailable')break;
    }
    const after=read(ledgerPath);assert.deepEqual(after.entries.slice(0,before.entries.length),before.entries,'c2p_history_changed');write(resolve(root,'ledger-after.json'),after);
    const manifest={status:rows.some(r=>r.result?.status==='unavailable')?'C2P_STOPPED':'C2P_REVIEW_REQUIRED',mode:o.mode,spec:b.spec,requestHash:b.requestHash,devGate,
      realProviderCalls:o.mode==='live'?counts(rows).calls:0,comparison:counts(rows),summary:budget.summary()};write(resolve(root,'manifest.json'),manifest);
    write(resolve(root,'review-template.json'),{version:'c2p-review-v1',runHash:hash({manifest,rows}),requestHash:b.requestHash,reviewer:'',cases:rows.map(r=>({id:r.id,accepted:null,reason:''}))});return manifest;
  }finally{if(lock!==undefined){closeSync(lock);unlinkSync(lockPath);}}
}

export async function inspectC2P(recorded:string){
  const root=inside(recorded),manifest=read(resolve(root,'manifest.json')),b=buildC2P(manifest.spec?.prepared?.split);
  assert.deepEqual(manifest.spec,b.spec,'c2p_sources_changed');assert.equal(manifest.requestHash,b.requestHash);assert(['mock','live'].includes(manifest.mode));
  const rows:Row[]=read(resolve(root,'results.json'));assert.deepEqual(rows.map(r=>r.id),b.current.originals.map(r=>r.id));assert.deepEqual(manifest.comparison,counts(rows));
  assert.equal(manifest.realProviderCalls,manifest.mode==='live'?counts(rows).calls:0);
  const before=read(resolve(root,'ledger-before.json')),after=read(resolve(root,'ledger-after.json'));
  assert.equal(before.entries.length,b.spec.policy.priorCalls);assert.deepEqual(after.entries.slice(0,before.entries.length),before.entries);
  if(manifest.mode==='live'&&b.spec.prepared.split==='confirm')assert.equal(manifest.devGate?.ledgerEntriesHash,hash(before.entries),'c2p_development_ledger_changed');
  assert.deepEqual(after.entries.slice(before.entries.length),rows.flatMap(r=>[r.outcome.entry,r.appraisal.entry].filter(Boolean)),'c2p_ledger_changed');
  const budget=new DeepSeekBudget(resolve(root,'ledger-after.json'),b.spec.policy.totalUsd,b.spec.policy.maxCalls,'offline replay');assert.deepEqual(manifest.summary,budget.summary());
  let stopped=false;
  for(const [i,row] of rows.entries()){
    if(stopped){assert.deepEqual(row,{id:row.id,outcome:empty(),appraisal:empty(),result:null,checks:null,core:null});continue;}
    const input=b.current.originals[i]!.request;let failure:unknown;
    const decode=(rec:RecordStage,body:ReturnType<typeof deepseekPayload>,fn:(s:string)=>any)=>{
      try{
        assert(['ERROR','DECODED'].includes(rec.execution));if(rec.body)assert.deepEqual(rec.body,body);
        assert.equal(rec.rawHash,rec.response?hash(rec.response):null);
        if(rec.attempted){assert(rec.body&&rec.call&&rec.entry);assert.equal(rec.call.id,rec.entry.id);assert.equal(rec.entry.authorization,'C2P '+b.spec.prepared.split+' '+b.requestHash);}
        else assert(!rec.call&&!rec.entry&&!rec.response);
        if(rec.execution==='ERROR'){assert(rec.error);return null;}
        assert(!rec.error&&rec.attempted&&rec.response&&rec.body&&rec.entry.status==='completed');
        assert(!rec.response.truncated&&rec.response.model===deepseekCandidate.model&&rec.response.finishReason==='stop'&&rec.response.content!==null);
        return fn(rec.response.content);
      }catch(e){failure=e;throw e;}
    };
    const result=await new SplitEventInterpreter(async()=>{const p=prepareOutcomeProbe(input),r=decode(row.outcome,deepseekPayload(p.request,2048),s=>p.decode(s).outcome);if(row.outcome.execution==='ERROR')throw Error('recorded_failure');return r;},async(_,fixed)=>{
      const p=prepareAppraisalProbe(input,fixed),r=decode(row.appraisal,deepseekPayload(p.request,2048),s=>p.decode(s));if(row.appraisal.execution==='ERROR')throw Error('recorded_failure');return r;
    }).interpret(input);
    if(failure)throw failure;assert.deepEqual(result,row.result);assert.deepEqual(checkReconnectCandidate(b.current.suite.cases[i]!,input,result),row.checks);
    if(result.status==='unavailable'){assert.equal(row.core,null);if(row.outcome.execution==='ERROR')assert.deepEqual(row.appraisal,empty());stopped=true;}
    else assert.deepEqual(appendEventAffect([],input,result.interpretation,input.eventId),row.core);
  }
  assert.equal(manifest.status,stopped?'C2P_STOPPED':'C2P_REVIEW_REQUIRED');return {manifest,rows,ledgerEntriesHash:hash(after.entries)};
}
export async function runC2P(args:string[]){
  const mode=args[0];assert(['--prepare','--rehearse','--replay','--live'].includes(mode!),'c2p_mode_required');
  if(mode==='--prepare'){assert.equal(args.length,5);assert.equal(args[1],'--split');assert.equal(args[3],'--output');return prepareC2P(args[2] as Split,args[4]!);}
  if(mode==='--replay'){assert.equal(args.length,5);assert.equal(args[1],'--recorded');assert.equal(args[3],'--output');const output=inside(args[4]!);assert(!existsSync(output),'evidence_exists');const r=await inspectC2P(args[2]!);mkdirSync(output);write(resolve(output,'replay.json'),{status:'C2P_REPLAYED',mode:r.manifest.mode,providerCalls:0,semanticQuality:'NOT_VERIFIED',comparison:r.manifest.comparison});return r.manifest.comparison;}
  assert.equal(args[1],'--prepared');assert.equal(args[3],'--output');
  if(mode==='--rehearse'){assert.equal(args.length,5);return executeC2P({mode:'mock',prepared:args[2]!,output:args[4]!});}
  assert(args.length===13||args.length===17,'c2p_explicit_approval_required');
  assert.equal(args[5],'--approved-request-hash');assert.equal(args[7],'--approved-total-usd');assert.equal(args[9],'--approved-max-calls');assert.deepEqual(args.slice(11,13),['--synthetic-inputs','--allow-paid-providers']);
  if(args.length===17){assert.equal(args[13],'--dev-run');assert.equal(args[15],'--dev-review');}
  return executeC2P({mode:'live',prepared:args[2]!,output:args[4]!,approvedHash:args[6],approvedUsd:Number(args[8]),approvedCalls:Number(args[10]),devRun:args[14],devReview:args[16]});
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))console.log(JSON.stringify(await runC2P(process.argv.slice(2))));
