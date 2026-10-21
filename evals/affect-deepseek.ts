// Preparation is offline. Live modes require an approved scope and separate budget.
import assert from 'node:assert/strict';
import {mkdirSync,readFileSync,writeFileSync,appendFileSync,existsSync,openSync,closeSync,unlinkSync} from 'node:fs';
import {resolve,relative,sep} from 'node:path';
import {parseEnv} from 'node:util';
import {createHash} from 'node:crypto';
import {validateAffectSuites,materializeAffectCase,materializeContrast,checkAffectCandidate,affectHash,affectEvaluationVersion,affectEvaluationScope} from './affect-cases.ts';
import {materializeAffectDiagnostic} from './affect-diagnostic.ts';
import {buildEventInterpretationRequest} from '../packages/adapters/src/event-interpreter.ts';
import {buildAnnotatedDialogueRequest} from '../packages/adapters/src/recommendation-capture.ts';
import {DeepSeekEventInterpreter,DeepSeekDialogue,deepseekPayload} from '../packages/adapters/src/deepseek.ts';
import {DeepSeekBudget,deepseekCandidate,deepseekInputBound,deepseekReservationUsd} from '../packages/adapters/src/deepseek-budget.ts';
import {initialState,dialoguePlan} from '../packages/character-core/src/index.ts';
import {RuntimeError} from '../packages/contracts/src/domain.ts';
import {eventWireOption,assertUuidPreparedForLive,referenceInputs,referenceMetadata,referenceSourceFiles,verifyDeepSeekReferenceRequests} from './affect-reference-artifacts.ts';
import {authoredReferenceReply} from './affect-reference-fixture.ts';

const rawArgs=process.argv.slice(2),referenceLive=rawArgs[0]==='--live-reference-diagnostic',live=referenceLive||rawArgs[0]==='--live-dev'||rawArgs[0]==='--live-diagnostic';
// Only the dedicated diagnostic mode can opt in. Existing live modes retain
// the shared refs rejection; approval flags never change the default format.
const {args,wireFormat}=eventWireOption(rawArgs,live&&!referenceLive),diagnostic=referenceLive||args[0]==='--prepare-diagnostic'||args[0]==='--live-diagnostic';
let approvedRequestHash:string|undefined;
if(referenceLive){
  assert(rawArgs.includes('--wire-format')&&wireFormat==='refs-v1','reference_format_required');
  assert.equal(args.length,9,'reference_approval_required');assert.equal(args[5],'--approved-request-hash','reference_approval_required');
  approvedRequestHash=args[6];assert(/^[a-f0-9]{64}$/.test(approvedRequestHash??''),'reference_approval_required');args.splice(5,2);
}
assert(wireFormat==='uuid-v3'||diagnostic,'references_require_diagnostic_scope');
assert(['--prepare','--live-dev','--prepare-diagnostic','--live-diagnostic','--live-reference-diagnostic'].includes(args[0]??''));assert.equal(args[1],'--output');assert.equal(args.length,live?7:3);
const generationCalls=diagnostic?8:30,evaluationKind=diagnostic?'diagnostic-eight-v1':'development-thirty';
if(live){assert.equal(args[3],'--prepared');assert.equal(args[5],'--allow-paid-providers');assert.equal(args[6],'--synthetic-inputs');}
const base=resolve('J:/ai/ai-character-runtime');
function inside(path:string){const absolute=resolve(path),part=relative(base,absolute);assert(part&&part!=='..'&&!part.startsWith(`..${sep}`)&&!part.startsWith(sep)&&!part.includes(':'),'path_must_be_inside_J_ai');return absolute;}
const root=inside(args[2]!);assert(!existsSync(root),'evidence_exists');
const read=(path:string)=>JSON.parse(readFileSync(path,'utf8'));
const suite=validateAffectSuites(read('evals/fixtures/affect-dev-v3.json'),read('evals/fixtures/affect-confirm-v3.json')).dev;
const events=diagnostic?materializeAffectDiagnostic(suite,read('evals/fixtures/affect-diagnostic-v1.json')):[...suite.cases.map(item=>({item,request:materializeAffectCase(suite,item)})),...suite.contrasts.map(contrast=>materializeContrast(suite,contrast))];
const annotationFixture=read('evals/fixtures/affect-annotation-v2.json');assert.equal(annotationFixture.syntheticOnly,true);
const annotations=diagnostic?[]:annotationFixture.cases.filter((item:any)=>item.split==='dev').map((item:any)=>({item,context:{currentInput:{payload:{text:item.input}}},plan:dialoguePlan(initialState(1700000000000),'question','91000000-0000-4000-8000-000000000001')}));
assert.equal(events.length,diagnostic?8:26);assert.equal(annotations.length,diagnostic?0:4);
const rows=[...events.map(row=>({id:row.item.id,body:deepseekPayload(buildEventInterpretationRequest(row.request,wireFormat),2048)})),...annotations.map((row:any)=>({id:row.item.id,body:deepseekPayload(buildAnnotatedDialogueRequest(row.plan,row.context,deepseekCandidate.model,{promptVariant:'conversation-history-v1'}),512)}))];
assert.equal(new Set(rows.map(r=>r.id)).size,generationCalls);
const requestHash=affectHash(rows.map(r=>JSON.stringify(r.body)).sort());
if(referenceLive)assert.equal(approvedRequestHash,requestHash,'reference_approved_request_changed');
const sourceFiles=['evals/affect-deepseek.ts','evals/affect-cases.ts','evals/fixtures/affect-dev-v3.json','evals/fixtures/affect-annotation-v2.json','packages/adapters/src/deepseek.ts','packages/adapters/src/deepseek-budget.ts','packages/adapters/src/event-interpreter.ts','packages/adapters/src/dialogue-request.ts','packages/adapters/src/recommendation-capture.ts','packages/contracts/src/affect-appraisal.ts','packages/contracts/src/outcomes.ts','packages/contracts/src/conversation.ts','packages/contracts/src/domain.ts','packages/character-core/src/event-affect.ts','packages/character-core/src/index.ts'];
if(diagnostic)sourceFiles.push('evals/affect-diagnostic.ts','evals/fixtures/affect-diagnostic-v1.json');
sourceFiles.push(...referenceSourceFiles);
const sourceHashes=Object.fromEntries(sourceFiles.map(path=>[path,createHash('sha256').update(readFileSync(path)).digest('hex')]));
const reservationUsd=rows.reduce((sum,row)=>sum+deepseekReservationUsd(deepseekInputBound(row.body),row.body.max_tokens),0);
const eventInputs=wireFormat==='refs-v1'?referenceInputs(events.map(row=>({id:row.item.id,request:row.request}))):undefined;
const prepared={provider:'deepseek',model:deepseekCandidate.model,syntheticOnly:true,evaluationKind,evaluationVersion:affectEvaluationVersion,evaluationScope:diagnostic?'provider_candidate_diagnostic_not_product_gate':affectEvaluationScope,requestHash,sourceHashes,reservationUsd,generationCalls,countCalls:0,semanticQuality:'NOT_RUN',tokenMeasure:'conservative UTF-8 byte bound plus 1024; not exact tokenization',...(eventInputs?referenceMetadata(eventInputs):{})};
let key='synthetic-no-network',budget:DeepSeekBudget,original:any,lock:number|undefined,lockPath='';
if(live){
  const preparedRoot=inside(args[4]!),previous=read(resolve(preparedRoot,'manifest.json'));
  if(!referenceLive)assertUuidPreparedForLive(previous);
  assert.equal(previous.status,'MOCK_PASS');assert.deepEqual(previous.prepared,prepared,'preparation_changed');
  if(referenceLive){
    const savedRequests=read(resolve(preparedRoot,'requests.json'));
    const savedInputs=verifyDeepSeekReferenceRequests(previous.prepared,read(resolve(preparedRoot,'event-inputs.json')),savedRequests);
    assert.deepEqual(savedInputs,eventInputs,'reference_inputs_changed');assert.deepEqual(savedRequests,rows,'reference_request_order_changed');
  }
  const config=parseEnv(readFileSync('runtime-data/deepseek.env','utf8'));
  assert.equal(config.LOCAL_ONLY,'false');assert.equal(config.ALLOW_PAID_PROVIDERS,'true');
  assert(config.DEEPSEEK_API_KEY?.trim()&&config.DEEPSEEK_BUDGET_AUTHORIZATION?.trim(),'deepseek_key_and_new_authorization_required');
  const ledgerPath=inside(config.DEEPSEEK_BUDGET_PATH??''),limit=Number(config.DEEPSEEK_BUDGET_USD),maxCalls=Number(config.DEEPSEEK_MAX_CALLS);
  const attempt=`O1 DeepSeek ${diagnostic?'diagnostic':'dev'} ${requestHash}`;
  // The runner lock covers replay-check through final evidence. Per-call locks also
  // protect the same ledger from runtime callers. Never start two live evaluators.
  lockPath=ledgerPath+'.o1-dev.lock';lock=openSync(lockPath,'wx');
  try{
    original=existsSync(ledgerPath)?read(ledgerPath):null;
    assert(!original?.entries.some((entry:any)=>entry.authorization.endsWith(attempt)),'dev_attempt_already_recorded');
    budget=new DeepSeekBudget(ledgerPath,limit,maxCalls,config.DEEPSEEK_BUDGET_AUTHORIZATION+'; '+attempt);
    const summary=budget.summary();assert.equal(budget.availability(),null);assert(summary.remainingGuardUsd>=reservationUsd,'insufficient_budget');assert(maxCalls-summary.attempts>=generationCalls,'insufficient_call_allowance');key=config.DEEPSEEK_API_KEY!;
  }catch(error){closeSync(lock);unlinkSync(lockPath);throw error;}
}else budget=new DeepSeekBudget(resolve(root,'synthetic-budget.json'),1,generationCalls,'Offline mock only; not paid authorization');
let active='',calls=0,failure:string|null=null;const seen=new Set<string>(),results:unknown[]=[];
try{
  mkdirSync(root,{recursive:true});writeFileSync(resolve(root,'requests.json'),JSON.stringify(rows,null,2));
  if(eventInputs)writeFileSync(resolve(root,'event-inputs.json'),JSON.stringify(eventInputs,null,2));
  const log=(name:string,value:unknown)=>appendFileSync(resolve(root,name),JSON.stringify(value)+'\n');
  const fetcher:typeof fetch=async(url,init)=>{
    assert.equal(String(url),'https://api.deepseek.com/chat/completions');assert(!seen.has(active),'duplicate_request');
    assert.deepEqual(JSON.parse(String(init?.body)),rows.find(row=>row.id===active)?.body,'request_changed');assert(++calls<=generationCalls);seen.add(active);
    if(live)return fetch(url,init);
    const content=wireFormat==='refs-v1'?authoredReferenceReply(JSON.parse(rows.find(row=>row.id===active)!.body.messages.at(-1)!.content)):events.some(row=>row.item.id===active)?{status:'uncertain',outcome:null,appraisals:[]}:{content:'확인이 필요하다.',sentences:['지금은 더 확인해 볼게.'],recommendations:[]};
    return Response.json({model:deepseekCandidate.model,usage:{prompt_tokens:1000,completion_tokens:100},choices:[{finish_reason:'stop',message:{role:'assistant',content:JSON.stringify(content)}}]});
  };
  // Opt-in for this synthetic evaluation only. Never log headers, provider error
  // bodies, reasoning content or the key; normal runtime leaves these unset.
  const options={localOnly:false,allowPaidProviders:true,apiKey:key,budget,fetcher,onCall:(record:Record<string,unknown>)=>log('calls.jsonl',{caseId:active,...record}),
    onResponse:(record:import('../packages/adapters/src/deepseek.ts').DeepSeekResponseRecord)=>log('responses.jsonl',{caseId:active,...record}),
    onDiagnostic:(record:import('../packages/adapters/src/event-interpreter.ts').EventInterpretationDiagnostic)=>log('diagnostics.jsonl',{caseId:active,...record})};
  const event=new DeepSeekEventInterpreter(options,wireFormat),dialogue=new DeepSeekDialogue(options);
  for(const row of events){active=row.item.id;const result=await event.interpret(row.request);const record={id:active,result,...(live?{checks:checkAffectCandidate(row.item,row.request,result)}:{})};results.push(record);log('results.jsonl',record);if(result.status==='unavailable')throw new RuntimeError(`affect_${result.reason}`,503);if(!live&&wireFormat==='refs-v1')assert.deepEqual(result.interpretation,authoredReferenceReply(row.request));}
  for(const row of annotations){active=row.item.id;const result=await dialogue.generateTurn(row.plan,row.context);const match=result.annotationStatus===row.item.expected&&(row.item.title===null||result.recommendations[0]?.title===row.item.title);const record={id:active,result,...(live?{checks:{status:match?'REVIEW_REQUIRED':'FAIL',semanticReview:'pending'}}:{})};results.push(record);log('results.jsonl',record);}
  assert.equal(calls,generationCalls);
}catch(error){failure=error instanceof RuntimeError?error.code:'evaluation_stopped';process.exitCode=1;}
finally{
  try{
    if(original)assert.deepEqual(read(budget.path).entries.slice(0,original.entries.length),original.entries,'historical_entries_changed');
    const result={status:failure?'STOPPED':live?'SEMANTIC_REVIEW_REQUIRED':'MOCK_PASS',failure,prepared,realProviderCalls:live?calls:0,mockCalls:live?0:calls,results,summary:budget.summary()};
    if(existsSync(root))writeFileSync(resolve(root,'manifest.json'),JSON.stringify(result,null,2));
    console.log(JSON.stringify({status:result.status,root,realProviderCalls:result.realProviderCalls,mockCalls:result.mockCalls,reservationUsd}));
  }finally{if(lock!==undefined){closeSync(lock);unlinkSync(lockPath);}}
}
