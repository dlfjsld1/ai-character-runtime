// Explicit dev-only runner. Preflight never reads a key, modifies a ledger or calls HTTP.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,appendFileSync,mkdirSync,existsSync} from 'node:fs';
import {resolve,relative,sep} from 'node:path';
import {parseEnv} from 'node:util';
import {createHash} from 'node:crypto';
import {DialogueBudget,OpenAIDialogue,OpenAIEventInterpreter,openaiReservationUsd} from '../packages/adapters/src/openai.ts';
import {validateAffectSuites,materializeAffectCase,materializeContrast,checkAffectCandidate,affectHash,affectDevRequestHash} from './affect-cases.ts';
import {RuntimeError} from '../packages/contracts/src/domain.ts';
import {eventWireOption,assertUuidPreparedForLive} from './affect-reference-artifacts.ts';

const {args}=eventWireOption(process.argv.slice(2),true),live=args[0]==='--live-dev';
assert(['--preflight','--live-dev'].includes(args[0]??''));assert.equal(args[1],'--prepared');
assert.equal(args.length,live?9:3);
if(live){assert.equal(args[3],'--approved-total-usd');assert.equal(args[5],'--output');assert.equal(args[7],'--allow-paid-providers');assert.equal(args[8],'--synthetic-inputs');}
const base=resolve('J:/ai/ai-character-runtime');
function inside(path:string){const absolute=resolve(path),part=relative(base,absolute);assert(part&&part!=='..'&&!part.startsWith(`..${sep}`)&&!part.startsWith(sep)&&!part.includes(':'),'path_must_be_inside_J_ai');return absolute;}
const prepared=inside(args[2]!),read=(path:string)=>JSON.parse(readFileSync(path,'utf8'));
const manifest=read(resolve(prepared,'manifest.json'));assertUuidPreparedForLive(manifest);
const http=read(resolve(prepared,'http-requests.json')) as {id:string;group:string;kind:'count'|'dialogue';body:object;reservationUsd:number}[];
assert.equal(manifest.status,'PROVIDER_REHEARSAL_PASS');assert.equal(manifest.syntheticOnly,true);assert.equal(manifest.budget.requestHash,affectHash(http));
for(const [path,digest] of Object.entries(manifest.sourceHashes))assert.equal(createHash('sha256').update(readFileSync(path)).digest('hex'),digest,`source_changed: ${path}`);
const suite=validateAffectSuites(read('evals/fixtures/affect-dev-v3.json'),read('evals/fixtures/affect-confirm-v3.json')).dev;
const events=[...suite.cases.map(item=>({item,request:materializeAffectCase(suite,item)})),...suite.contrasts.map(contrast=>materializeContrast(suite,contrast))];
const annotationInput=read(resolve(prepared,'annotation-inputs.json'));
assert.equal(affectHash(annotationInput),manifest.artifactHashes.annotation,'annotation_artifact_changed');
const annotation=annotationInput.filter((r:any)=>r.group==='annotation_dev');
assert.equal(events.length,26);assert.equal(annotation.length,4);
const rows=http.filter(r=>['dev','dev_contrast','annotation_dev'].includes(r.group));
assert.equal(rows.length,60);assert.equal(new Set([...events.map(r=>r.item.id),...annotation.map((r:any)=>r.id)]).size,30);
for(const row of rows)assert.equal(row.reservationUsd,openaiReservationUsd(row.kind,row.body));
const ledgerPath=resolve(base,'openai-generation-20261014/budget.json'),original=read(ledgerPath);
// Reuse only the explicitly acknowledged historical IDs; never infer permission
// to skip a new unknown reservation just because it appears in the ledger.
const profile=parseEnv(readFileSync(resolve(base,'text-mvp-20261015/app.env'),'utf8'));
const priorDialogue=original.entries.filter((e:any)=>e.kind==='dialogue').length,priorDecision=original.entries.filter((e:any)=>e.kind==='decision').length;
const devRequestHash=affectDevRequestHash(http);
const authorizationText=`O1 dev ${devRequestHash}: 26 event interpretations, 4 annotated generations, at most 30 count calls; no retry, confirm or transfer. Historical reservations retained.`;
assert(!original.entries.some((entry:any)=>entry.runtimeAuthorization?.authorization===authorizationText),'dev_attempt_already_recorded');
const authorization={authorization:authorizationText,maxDialogueCalls:priorDialogue+30,maxDecisionCalls:priorDecision,
  acknowledgedCountEntryId:profile.OPENAI_ACKNOWLEDGED_COUNT_ENTRY_ID,acknowledgedDialogueEntryId:profile.OPENAI_ACKNOWLEDGED_DIALOGUE_ENTRY_ID};
const budget=new DialogueBudget(ledgerPath,original.limitUsd,undefined,authorization),summary=budget.summary();
assert.equal(budget.availability('count').errorCode,null,'existing_ledger_not_ready');
const reserveUsd=rows.reduce((sum,r)=>sum+r.reservationUsd,0),requiredTotalUsd=Math.ceil((summary.enforcedTotalUsd+reserveUsd)*100)/100;
const preflight={status:'DEV_PREPARED_NOT_AUTHORIZED',model:manifest.modelProposal,counts:{interpretation:26,annotation:4,count:30,generation:30},reservationUsd:reserveUsd,billingVerified:false,currentLedger:summary,requiredTotalUsd,devRequestHash,requestHash:manifest.budget.requestHash,sourceHashes:manifest.sourceHashes,scope:'dev only; no confirm, transfer, Stage, H2-A, retries or automatic ledger changes'};
if(!live){console.log(JSON.stringify(preflight,null,2));process.exit(0);}
const approved=Number(args[4]);assert(Number.isFinite(approved)&&approved>0);assert.equal(original.limitUsd,approved,'approved_ledger_limit_must_be_applied_separately');
assert(approved>=requiredTotalUsd,'insufficient_total_guard');
const root=inside(args[6]!);assert(!existsSync(root),'evidence_exists');
const key=parseEnv(readFileSync('runtime-data/dialogue-api.env','utf8')).DIALOGUE_API_KEY;assert(typeof key==='string'&&key.trim(),'dialogue_key_missing');
mkdirSync(root,{recursive:true});writeFileSync(resolve(root,'manifest.json'),JSON.stringify(preflight,null,2));
let active='',countCalls=0,generationCalls=0;
const seen=new Set<string>(),results:unknown[]=[];
const log=(name:string,value:unknown)=>appendFileSync(resolve(root,name),JSON.stringify(value)+'\n');
const fetcher:typeof fetch=async(url,init)=>{
  const address=String(url);assert(['https://api.openai.com/v1/responses','https://api.openai.com/v1/responses/input_tokens'].includes(address));
  const kind=address.endsWith('input_tokens')?'count':'dialogue',signature=`${active}:${kind}`;
  const expected=rows.find(row=>row.id===active&&row.kind===kind);assert(expected&&!seen.has(signature),'unexpected_or_repeated_request');
  assert.deepEqual(JSON.parse(String(init!.body)),expected.body,'prepared_payload_changed');
  if(kind==='dialogue')assert(seen.has(`${active}:count`),'count_required');
  if(kind==='count')assert(++countCalls<=30);else assert(++generationCalls<=30);
  seen.add(signature);log('requests.jsonl',{id:active,kind,body:expected.body});
  return fetch(url,init);
};
const options={localOnly:false,allowPaidProviders:true,apiKey:key,budget,fetcher,
  onCall:(record:Record<string,unknown>)=>log('calls.jsonl',{caseId:active,...record}),onContent:(text:string)=>log('responses.jsonl',{caseId:active,text})};
const event=new OpenAIEventInterpreter(options),dialogue=new OpenAIDialogue(options);
let failure:string|null=null;
try{
  for(const row of events){
    active=row.item.id;const result=await event.interpret(row.request);
    const record={id:active,result,checks:checkAffectCandidate(row.item,row.request,result)};results.push(record);log('results.jsonl',record);
    if(result.status==='unavailable')throw new RuntimeError(`affect_${result.reason}`,503);
  }
  for(const row of annotation){
    active=row.id;const result=await dialogue.generateTurn(row.plan,row.context);
    const expected=row.rubric,match=result.annotationStatus===expected.expected&&(expected.title===null||result.recommendations[0]?.title===expected.title);
    const record={id:active,result,checks:{status:match?'REVIEW_REQUIRED':'FAIL',semanticReview:'pending'}};results.push(record);log('results.jsonl',record);
  }
}catch(error){failure=error instanceof RuntimeError?error.code:'evaluation_stopped';process.exitCode=1;}
finally{
  const after=read(ledgerPath);assert.deepEqual(after.entries.slice(0,original.entries.length),original.entries,'historical_ledger_changed');
  const result={status:failure?'STOPPED':'SEMANTIC_REVIEW_REQUIRED',failure,countCalls,generationCalls,results,summary:budget.summary(),requestHash:manifest.budget.requestHash};
  writeFileSync(resolve(root,'result.json'),JSON.stringify(result,null,2));console.log(JSON.stringify({status:result.status,failure,root,countCalls,generationCalls}));
}
