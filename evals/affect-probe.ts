// Offline only. Provider rehearsal injects HTTP responses; no keys or live mode.
import assert from 'node:assert/strict';
import {mkdirSync,readFileSync,writeFileSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {resolve,relative,sep} from 'node:path';
import {validateAffectSuites,materializeAffectCase,materializeContrast,affectHash,affectEvaluationVersion,affectEvaluationScope,type AffectCase,type AffectSuite} from './affect-cases.ts';
import {buildEventInterpretationRequest,StructuredEventInterpreter} from '../packages/adapters/src/event-interpreter.ts';
import {buildAnnotatedDialogueRequest,decodeAnnotatedDialogueOutput} from '../packages/adapters/src/recommendation-capture.ts';
import {eventAffectPolicy,appendEventAffect} from '../packages/character-core/src/public.ts';
import {initialState,dialoguePlan} from '../packages/character-core/src/index.ts';
import type {EventInterpretationRequest} from '../packages/contracts/src/affect-appraisal.ts';
import {DialogueBudget,OpenAIDialogue,OpenAIEventInterpreter,openaiCandidate,openaiAffectLimits,openaiReservationUsd} from '../packages/adapters/src/openai.ts';
import {rehearseReferenceDiagnostic} from './affect-reference-probe.ts';
import {referenceSourceFiles} from './affect-reference-artifacts.ts';

const args=process.argv.slice(2);
if(args[0]==='--rehearse-reference-diagnostic'){await rehearseReferenceDiagnostic(args);process.exit(0);}
assert(['--prepare','--rehearse-providers'].includes(args[0]??''));assert.equal(args[1],'--output');assert.equal(args.length,3);
const rehearseProviders=args[0]==='--rehearse-providers';
const allowed=resolve('J:/ai/ai-character-runtime'),root=resolve(args[2]!),within=relative(allowed,root);
assert(within&&within!=='..'&&!within.startsWith(`..${sep}`)&&!within.includes(':')&&!within.startsWith(sep),'output_must_be_inside_J_ai');
assert(!existsSync(root),'evidence_exists');
const read=(name:string)=>JSON.parse(readFileSync(new URL(`./fixtures/${name}.json`,import.meta.url),'utf8'));
const suites=validateAffectSuites(read('affect-dev-v3'),read('affect-confirm-v3'));
const annotations=read('affect-annotation-v2'),transfers=read('affect-transfer-v2');
assert.equal(annotations.syntheticOnly,true);assert.equal(annotations.cases.length,8);
assert.equal(transfers.syntheticOnly,true);assert.equal(transfers.cases.length,12);
const interpretationRows:{id:string;group:string;request:EventInterpretationRequest;rubric:unknown;productPath:string}[]=[];
for(const suite of Object.values(suites)){
  for(const item of suite.cases)interpretationRows.push({id:item.id,group:suite.split,request:materializeAffectCase(suite,item),rubric:item.expected,productPath:'planned_product_path'});
  for(const contrast of suite.contrasts){const {item,request}=materializeContrast(suite,contrast);interpretationRows.push({id:item.id,group:`${suite.split}_contrast`,request,rubric:contrast.expected,productPath:'planned_product_path'});}
}
for(const item of transfers.cases){
  // These authored priors are controlled model diagnostics, not captured actions.
  const suite:AffectSuite={version:'affect-v3-dev1',evaluationVersion:affectEvaluationVersion,evaluationScope:affectEvaluationScope,split:'dev',syntheticOnly:true,personas:{provided:item.persona},cases:[],contrasts:[]};
  // Transfer diagnostics are materialized only; this placeholder is not scored.
  const optional={presence:'optional' as const,polarity:['positive','negative','mixed','none'] as ('positive'|'negative'|'mixed'|'none')[]};
  const candidate:AffectCase={id:item.id,family:item.family,persona:'provided',route:item.prior?'outcome':'value',clarity:'clear',input:item.input,...(item.prior?{episodes:[item.prior]}:{}),expected:{status:['appraised','irrelevant','uncertain'],outcome:null,episode:optional,input:optional,notes:item.notes}};
  interpretationRows.push({id:item.id,group:'transfer_diagnostic',request:materializeAffectCase(suite,candidate),rubric:{notes:item.notes},productPath:item.path});
}
const model=openaiCandidate.model;
const annotationRows=annotations.cases.map((item:any)=>{
  const context={currentInput:{payload:{text:item.input}}},plan=dialoguePlan(initialState(1700000000000),'question','91000000-0000-4000-8000-000000000001');
  const built=buildAnnotatedDialogueRequest(plan,context,model,{promptVariant:'conversation-history-v1'});
  return {id:item.id,group:`annotation_${item.split}`,plan,context,built,rubric:{expected:item.expected,title:item.title,notes:item.notes}};
});
const prepared=interpretationRows.map(row=>({...row,prepared:buildEventInterpretationRequest(row.request)}));
assert.equal(prepared.length,64);
assert.equal(new Set(prepared.map(row=>affectHash(row.prepared.messages[0]))).size,1);
const mock=new StructuredEventInterpreter(async()=>({status:'uncertain',outcome:null,appraisals:[]}));
for(const row of prepared){
  const result=await mock.interpret(row.request);assert.equal(result.status,'interpreted');
  if(result.status==='interpreted')assert.deepEqual(appendEventAffect([],row.request,result.interpretation,row.request.eventId).snapshot.levels,{positive:0,negative:0,activation:0});
}
for(const row of annotationRows){
  const result=decodeAnnotatedDialogueOutput(row.built,JSON.stringify({content:'확인이 필요하다.',sentences:['지금은 더 확인해 볼게.'],recommendations:[]}),2);
  assert.equal(result.annotationStatus,'none');
}
mkdirSync(root,{recursive:true});
const httpRequests:{id:string;group:string;kind:'count'|'dialogue';body:any;reservationUsd:number}[]=[];
if(rehearseProviders){
  let active={id:'',group:''};
  const budget=new DialogueBudget(resolve(root,'synthetic-budget.json'),100,undefined,{authorization:'Offline injected HTTP only; no live permission.',maxDecisionCalls:0,maxDialogueCalls:72});
  const fetcher:typeof fetch=async(url,init)=>{
    const address=String(url);assert(['https://api.openai.com/v1/responses','https://api.openai.com/v1/responses/input_tokens'].includes(address));
    assert(active.id);const body=JSON.parse(String(init!.body)),kind=address.endsWith('input_tokens')?'count':'dialogue';
    const reservationUsd=openaiReservationUsd(kind,body);httpRequests.push({...active,kind,body,reservationUsd});
    const ledger=JSON.parse(readFileSync(budget.path,'utf8'));assert.equal(ledger.entries.at(-1).usd,reservationUsd);
    if(kind==='count')return Response.json({input_tokens:1000});
    const preceding=httpRequests.at(-2)!;assert.equal(preceding.id,active.id);assert.equal(preceding.kind,'count');
    const {model,input,reasoning,text}=body;assert.deepEqual(preceding.body,{model,input,reasoning,text});
    const output=active.group.startsWith('annotation_')?{content:'확인이 필요하다.',sentences:['지금은 더 확인해 볼게.'],recommendations:[]}:{status:'uncertain',outcome:null,appraisals:[]};
    return Response.json({model,status:'completed',usage:{input_tokens:1000,output_tokens:100},output:[{type:'message',role:'assistant',content:[{type:'output_text',text:JSON.stringify(output)}]}]});
  };
  const options={localOnly:false,allowPaidProviders:true,apiKey:'synthetic-no-network',budget,fetcher},event=new OpenAIEventInterpreter(options),dialogue=new OpenAIDialogue(options);
  for(const row of prepared){active={id:row.id,group:row.group};assert.equal((await event.interpret(row.request)).status,'interpreted');}
  for(const row of annotationRows){active={id:row.id,group:row.group};assert.equal((await dialogue.generateTurn(row.plan,row.context)).annotationStatus,'none');}
  assert.equal(httpRequests.length,144);assert.equal(budget.summary().unresolvedEntries,0);
}
const byPhase=Object.fromEntries(['dev','confirm','transfer'].map(phase=>{
  const rows=httpRequests.filter(r=>phase==='transfer'?r.group==='transfer_diagnostic':[phase,`${phase}_contrast`,`annotation_${phase}`].includes(r.group));
  return [phase,{countCalls:rows.filter(r=>r.kind==='count').length,generationCalls:rows.filter(r=>r.kind==='dialogue').length,reservationUsd:rows.reduce((sum,r)=>sum+r.reservationUsd,0)}];
}));
const sourceFiles=['evals/affect-probe.ts','evals/affect-live.ts','evals/affect-cases.ts','evals/fixtures/affect-dev-v3.json','evals/fixtures/affect-confirm-v3.json','evals/fixtures/affect-annotation-v2.json','evals/fixtures/affect-transfer-v2.json','packages/contracts/src/affect-appraisal.ts','packages/contracts/src/outcomes.ts','packages/contracts/src/ai-ports.ts','packages/contracts/src/domain.ts','packages/contracts/src/conversation.ts','packages/adapters/src/openai.ts','packages/adapters/src/event-interpreter.ts','packages/adapters/src/recommendation-capture.ts','packages/adapters/src/dialogue-request.ts','packages/character-core/src/event-affect.ts','packages/character-core/src/public.ts','packages/character-core/src/index.ts'];
sourceFiles.push(...referenceSourceFiles,'evals/affect-reference-probe.ts');
const sourceHashes=Object.fromEntries(sourceFiles.map(path=>[path,createHash('sha256').update(readFileSync(path)).digest('hex')]));
const groups=Object.fromEntries([...new Set(prepared.map(r=>r.group))].map(group=>[group,prepared.filter(r=>r.group===group).length]));
const manifest={status:rehearseProviders?'PROVIDER_REHEARSAL_PASS':'OFFLINE_PREPARED',syntheticOnly:true,evaluationVersion:affectEvaluationVersion,evaluationScope:affectEvaluationScope,liveEnabled:false,providerCalls:0,paidCalls:0,
  artifactHashes:{interpretation:affectHash(prepared),annotation:affectHash(annotationRows)},
  schemaHashes:Object.fromEntries(prepared.map(row=>[row.id,affectHash(row.prepared.schema)])),promptHash:affectHash(prepared[0]!.prepared.messages[0]),policy:eventAffectPolicy,sourceHashes,
  modelProposal:model,interpreterGroups:groups,annotationGroups:{dev:4,confirm:4},
  proposedGenerationCalls:{dev:30,confirm:30,transfer:12,total:72},
  mechanicalRehearsal:{interpreter:64,annotationDecoder:8,result:'PASS',transport:'constant synthetic abstention; no semantic oracle'},
  quality:{status:'NOT_RUN',independentAuthor:false,devGate:'must pass semantic review before confirm calls',confirmGate:'freeze prompt/schema/policy/model/fixtures before confirm; current hashes are a preparation snapshot, not a completed freeze'},
  stage:{flowsPlanned:10,requestsPrepared:false,calls:null},
  budget:rehearseProviders?{usd:httpRequests.reduce((sum,r)=>sum+r.reservationUsd,0),countCalls:72,generationCalls:72,byPhase,limits:openaiAffectLimits,requestHash:affectHash(httpRequests),pricing:{inputUsdPerMillion:openaiCandidate.inputUsdPerMillion,outputUsdPerMillion:openaiCandidate.outputUsdPerMillion},billingVerified:false,reason:'Conservative sum of all reservations, including unverified count billing. Real counts and model quality NOT_RUN. No existing ledger or approval changed.'}:{usd:null,countCalls:null,reason:'Run --rehearse-providers to capture exact HTTP payloads and conservative reservations.'},
  remaining:['paid scope/ledger authorization and live dev evaluation','dev semantic review and frozen confirm gate','O2 persistence/runtime/Stage coupling','O3 Stage and SDK storage-port checks']};
writeFileSync(resolve(root,'manifest.json'),JSON.stringify(manifest,null,2));
// Rubrics remain outside the provider messages. Offline artifacts may include both.
writeFileSync(resolve(root,'interpretation-inputs.json'),JSON.stringify(prepared,null,2));
writeFileSync(resolve(root,'annotation-inputs.json'),JSON.stringify(annotationRows,null,2));
if(rehearseProviders)writeFileSync(resolve(root,'http-requests.json'),JSON.stringify(httpRequests,null,2));
console.log(JSON.stringify({status:manifest.status,root,providerCalls:0,interpretationRequests:64,annotationRequests:8,quality:manifest.quality.status}));
