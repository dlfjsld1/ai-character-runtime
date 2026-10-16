// One frozen candidate, dev before confirmation; no runtime promotion or retries.
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import type {AppraisalEvaluation} from '../packages/contracts/src/appraisal.ts';
import type {EvidenceEvent} from '../packages/contracts/src/ai-ports.ts';
import {randomUUID,createHash} from 'node:crypto';
import {loadLocalEnv} from '../scripts/env.ts';
import {JevRepetitionCandidate,JevRepetitionV8Candidate,JevRepetitionV9Candidate,JEV_REPETITION_VERSION,JEV_REPETITION_V8_VERSION,JEV_REPETITION_V9_VERSION,repetitionQuestions,repetitionV8Questions,repetitionV8Relation,repetitionV9Relation,JEV_ENDPOINT,type JevCall} from '../packages/adapters/src/jev.ts';
import {jevEvidenceVerifier,readJevEvidence} from '../packages/adapters/src/appraisal-evidence.ts';
import {selectPraiseGroup,socialAffect} from '../packages/character-core/src/index.ts';
import {summarizeJevCalls} from './jev-accounting.ts';
export type RepetitionCase={id:string;set:string;previous:string[];groups:string[];utterance:string;expected:string[];concrete:boolean;selection:string;expectedGroupId?:string;policy?:{scope:'eligible'|'group-protected'|'praise-protected';target:string[];act:string[]}};
export function scoreRepetition(item:RepetitionCase,evaluation:AppraisalEvaluation,binding:EvidenceEvent){
 const evidence=jevEvidenceVerifier.verifyRepetition?.(evaluation.appraisal,evaluation.metadata,binding),affect=jevEvidenceVerifier.verifyAffect?.(evaluation.appraisal,evaluation.metadata,binding),raw=readJevEvidence(evaluation.metadata.providerResult!);
 const confident=(a:{confidence:number;probabilities:Record<string,number>})=>a.confidence>=.8&&Object.values(a.probabilities).filter(p=>p===Math.max(...Object.values(a.probabilities))).length===1;
 const repetition=raw.repetitionV9??raw.repetitionV8??raw.repetition;
 const qualified=raw.repetitionV9?raw.repetitionV9.comparisons.map(repetitionV9Relation):raw.repetitionV8?raw.repetitionV8.comparisons.map(repetitionV8Relation):raw.repetition?.comparisons.map(a=>confident(a)?a.choice:'unknown');
 const concrete=!!repetition&&confident(repetition.concrete)&&repetition.concrete.choice==='yes';
 const eligible=evaluation.appraisal.target==='character'&&evaluation.appraisal.act==='praise'&&(evaluation.appraisal.uncertain?!!affect:evaluation.appraisal.strength>0);
 const selection=selectPraiseGroup(binding.recentPraise!.items.map((s,i)=>({eventId:s.eventId,revision:s.revision,groupId:item.groups[i]!})),eligible?evidence:undefined,true);
 const expectedGroupId=item.expectedGroupId??item.groups[item.expected.indexOf('same')];
 const semanticPass=JSON.stringify(qualified)===JSON.stringify(item.expected),concretePass=concrete===item.concrete,authorityPass=selection.kind===item.selection&&(selection.kind!=='existing'||selection.groupId===expectedGroupId);
 const legacy={id:item.id,set:item.set,pass:semanticPass&&concretePass&&authorityPass,semanticPass,concretePass,authorityPass,falseNovelty:selection.kind==='new'&&item.selection!=='new',expected:item.expected,expectedGroupId,qualified,rawLabels:raw.repetition?.comparisons.map(a=>a.choice),rawPredicates:(raw.repetitionV9??raw.repetitionV8)?.comparisons,rawConcrete:repetition?.concrete,concrete,evidence:evidence??null,selection,evaluation};
 if(raw.mappingVersion!==JEV_REPETITION_V9_VERSION)return legacy;
 if(!item.policy||!raw.repetitionV9)throw new Error('v9_preregistered_policy_required');
 const policy=item.policy,protectedInput=policy.scope!=='eligible';
 const classificationPass=policy.target.includes(evaluation.appraisal.target)&&policy.act.includes(evaluation.appraisal.act);
 const effect=socialAffect(evaluation.appraisal,[],binding.identityId,0,affect),participation=jevEvidenceVerifier.verify(evaluation.appraisal,evaluation.metadata,binding);
 const praiseAuthority=effect.category==='praise'&&effect.stimulus>0||!!participation?.acknowledgePraise;
 const protectionPass=protectedInput?selection.kind==='fallback'&&(policy.scope!=='praise-protected'||!praiseAuthority):null;
 const policySemanticPass=protectedInput?null:semanticPass&&eligible;
 const rawLabels=raw.repetitionV9.comparisons.map(p=>p.sameEvent.choice==='yes'&&p.separateEvent.choice==='no'?'same':p.sameEvent.choice==='no'&&p.separateEvent.choice==='yes'?'distinct':'unknown');
 const historicalQualified=raw.repetitionV9.comparisons.map(repetitionV8Relation);
 const historicalEvidence=evidence?{...evidence,comparisons:evidence.comparisons.map((c,i)=>({...c,relation:historicalQualified[i]!}))}:undefined;
 const historicalSelection=selectPraiseGroup(binding.recentPraise!.items.map((s,i)=>({eventId:s.eventId,revision:s.revision,groupId:item.groups[i]!})),eligible?historicalEvidence:undefined,true);
 const historicalPass=JSON.stringify(historicalQualified)===JSON.stringify(item.expected)&&concretePass&&historicalSelection.kind===item.selection&&(historicalSelection.kind!=='existing'||historicalSelection.groupId===expectedGroupId);
 return {...legacy,pass:classificationPass&&concretePass&&authorityPass&&(protectedInput?protectionPass:policySemanticPass)===true,scope:policy.scope,rawSemanticPass:JSON.stringify(rawLabels)===JSON.stringify(item.expected),policySemanticPass,protectionPass,classificationPass,praiseAuthority,falseExisting:selection.kind==='existing'&&(item.selection!=='existing'||selection.groupId!==expectedGroupId),historicalPass,historicalQualified,historicalSelection};
}
export function summarizeRepetitionRows(rows:ReturnType<typeof scoreRepetition>[]){
 const count=(values:boolean[])=>({pass:values.filter(Boolean).length,total:values.length});
 const v9=rows.filter(r=>'scope' in r);
 return {all:count(rows.map(r=>r.pass)),rawSemantic:count(v9.map(r=>r.rawSemanticPass)),policySemantic:count(v9.flatMap(r=>r.policySemanticPass===null?[]:[r.policySemanticPass])),protection:count(v9.flatMap(r=>r.protectionPass===null?[]:[r.protectionPass])),classification:count(v9.map(r=>r.classificationPass)),authority:count(rows.map(r=>r.authorityPass)),falseNew:rows.filter(r=>r.falseNovelty).length,falseExisting:v9.filter(r=>r.falseExisting).length};
}
const reservationPerCallUsd=.002688;
export async function runGatedRepetitionCases<T,R extends {pass:boolean}>(dev:readonly T[],confirmation:readonly T[],evaluate:(item:T)=>Promise<R>,budget?:{calls:readonly JevCall[];limitUsd:number}){
 const rows:R[]=[];
 const run=async(item:T)=>{
  // Local refusal must precede provider.evaluate, which records a call before transport.
  if(budget){
   if(!Number.isFinite(budget.limitUsd)||budget.limitUsd<=0||budget.limitUsd>.005)throw new Error('invalid_probe_budget');
   const usage=summarizeJevCalls(budget.calls);
   if(usage.unknownUsageCalls)throw new Error('jev_usage_unknown');
   if(usage.estimatedKnownCostUsd+reservationPerCallUsd>budget.limitUsd)throw new Error('budget_reservation_unavailable');
  }
  rows.push(await evaluate(item));
 };
 for(const item of dev)await run(item);
 if(rows.some(r=>!r.pass))return {rows,blockedAt:'dev' as const};
 for(const item of confirmation)await run(item);
 return {rows,blockedAt:rows.some(r=>!r.pass)?'confirmation' as const:null};
}
async function runProbe(){
const arg=(key:string)=>{const i=process.argv.indexOf(key);return i<0?undefined:process.argv[i+1];};
const root=arg('--output-root'),budget=Number(arg('--max-cost-usd'));
if(!process.argv.includes('--synthetic-inputs')||!process.argv.includes('--allow-jev-api')||!root||!/^J:[\\/]ai[\\/]/i.test(resolve(root))||!(budget>0&&budget<=.005))throw new Error('explicit_bounded_synthetic_run_required');
const candidate=arg('--candidate')??'v7',fixturePath=arg('--fixture')??'evals/fixtures/jev-repetition-v2.json';
if(!['v7','v8','v9'].includes(candidate))throw new Error('unknown_candidate');
const Candidate=candidate==='v9'?JevRepetitionV9Candidate:candidate==='v8'?JevRepetitionV8Candidate:JevRepetitionCandidate,mappingVersion=candidate==='v9'?JEV_REPETITION_V9_VERSION:candidate==='v8'?JEV_REPETITION_V8_VERSION:JEV_REPETITION_VERSION,questions=candidate==='v7'?repetitionQuestions:repetitionV8Questions;
const fixture:Record<'dev'|'confirmation',RepetitionCase[]>=JSON.parse(await readFile(fixturePath,'utf8'));
if(candidate==='v9'&&[...fixture.dev,...fixture.confirmation].some(c=>!c.policy||!['eligible','group-protected','praise-protected'].includes(c.policy.scope)||!c.policy.target.length||!c.policy.act.length||(c.policy.scope==='eligible'?c.selection==='fallback'||!c.concrete:c.selection!=='fallback'||c.concrete)))throw new Error('v9_preregistered_policy_required');
const cases=[...fixture.dev,...fixture.confirmation].map(item=>({...item,event:{id:randomUUID(),identityId:randomUUID(),revision:'1',text:item.utterance},recentPraise:{asOf:Date.now(),complete:true,items:item.previous.map(text=>({eventId:randomUUID(),revision:'1',text}))}}));
const directory=resolve(root,`probe-${new Date().toISOString().replace(/[:.]/g,'-')}`);await mkdir(directory,{recursive:true});
const paths=['evals/jev-repetition-probe.ts',fixturePath,'packages/adapters/src/jev.ts','packages/adapters/src/jev-schema.ts','packages/adapters/src/appraisal-evidence.ts','packages/contracts/src/appraisal.ts','packages/character-core/src/index.ts'];
const hashes=async()=>Object.fromEntries(await Promise.all(paths.map(async p=>[p,createHash('sha256').update(await readFile(p)).digest('hex')])));
const sourceHashes=await hashes();
await writeFile(resolve(directory,'manifest.json'),JSON.stringify({version:candidate==='v9'?'c2-s2-policy-fixed-v1':'c2-s2-repair-fixed-v1',candidate,mappingVersion,questionsByCount:Object.fromEntries([0,1,2,3,8].map(n=>[n,questions(n)])),sourceHashes,cases,syntheticInputs:true,personalDataUsed:false,budgetUsd:budget,priorKnownCostUsd:.016874592,priorUnknownUsageCalls:1,globalBudgetUsd:1,reservationPerCallUsd:.002688,automaticRetries:0,
 policyRubric:candidate==='v9'?'Preregistered eligible cases require classification, concrete, qualified semantics AND exact authority. Protected cases require classification, concrete and fallback; praise-protected also requires no praise effect or acknowledgement. Generic direct praise is group-protected, not denied S1B affect. Raw semantics and v8-policy scores stay separate diagnostics; model rejection never changes the denominator. False existing/new authority rejects adoption. Questions unchanged from v8; same >=.8 + unique separate=no, strict distinct unchanged.':'legacy',
 rubric:candidate==='v9'?'Adoption uses policyRubric; legacy all-semantics score remains diagnostic. Complete dev then confirmation only on full policy pass. Stop errors, unknown usage or budget exhaustion without retry. Runtime remains v6 until candidate S1B and Stage also pass.':'All dev cases must pass semantic labels AND concrete AND expected group selection AND exact existing group label before confirmation. same/distinct requires confidence >=.8 and unique mode; unknown never counts as requested same/distinct. Protected inputs must fallback. Raw labels or v8 predicate answers, confidence-qualified relations, concrete and effective group authority reported separately. Group authority also requires current eligible praise. Any false novelty fails adoption. Complete the fixed dev set to preserve diagnostics; no retries or prompt revision after outputs. Previously evaluated cases remain exposed; synthetic comparison sets here are adapter evaluations, not claims that ungrouped legacy history is sent by Store. Runtime remains v6 on failure. Stage only after confirmation and S1B regression pass.'},null,2));
const calls:JevCall[]=[],rows:ReturnType<typeof scoreRepetition>[]=[];let active=-1,attempts=0,stopReason:string|null=null,status='RUNNING';
const save=()=>writeFileSync(resolve(directory,'results.json'),JSON.stringify({status,sourceHashes,calls,rows,summary:summarizeRepetitionRows(rows),actualHttpAttempts:attempts,stopReason,...summarizeJevCalls(calls)},null,2));
const fetcher:typeof fetch=async(url,options)=>{
 if(stopReason||String(url)!==JEV_ENDPOINT||active!==attempts||attempts>=cases.length)throw new Error('unregistered_request');
 const body=String(options?.body),request=JSON.parse(body),item=cases[active]!;
 if(request.state.utterance!==item.utterance||JSON.stringify(request.state.previous)!==JSON.stringify(item.previous)||Buffer.byteLength(body)>32000)throw new Error('unregistered_input');
 await writeFile(resolve(directory,`${item.id}-request.json`),body);attempts++;
 const response=await fetch(url,options);if(!response.ok)return response;
 const reader=response.body!.getReader(),chunks:Uint8Array[]=[];let size=0;
 try{for(;;){const part=await reader.read();if(part.done)break;size+=part.value.length;if(size>65536)throw new Error('response_too_large');chunks.push(part.value);}}finally{await reader.cancel().catch(()=>{});}
 const raw=Buffer.concat(chunks).toString('utf8');await writeFile(resolve(directory,`${item.id}-response.json`),raw);return new Response(raw,{status:response.status,headers:{'content-type':'application/json'}});
};
try{
 loadLocalEnv();const provider=new Candidate({localOnly:false,allowPaidProviders:true,apiKey:process.env.TYPESAFE_API_KEY??'',onCall:call=>{calls.push(call);if(call.errorCode||call.usageStatus==='unknown')stopReason=call.errorCode??'jev_usage_unknown';save();}},fetcher);
 if(provider.readiness().status==='blocked')throw new Error(provider.readiness().errorCode??'jev_blocked');
 const gate=await runGatedRepetitionCases(cases.slice(0,fixture.dev.length),cases.slice(fixture.dev.length),async item=>{
  active++;if(stopReason)throw new Error(stopReason);
  const binding={eventId:item.event.id,identityId:item.event.identityId,eventRevision:'1',recentPraise:item.recentPraise};
  const evaluation=await provider.evaluate(item.event,{activity:null,recentPraise:item.recentPraise}),row=scoreRepetition(item,evaluation,binding);
  rows.push(row);save();console.log(JSON.stringify({id:row.id,pass:row.pass,semanticPass:row.semanticPass,concretePass:row.concretePass,authorityPass:row.authorityPass,qualified:row.qualified,selection:row.selection}));return row;
 },{calls,limitUsd:budget});
 if(gate.blockedAt){status='CANDIDATE_REJECTED';stopReason=gate.blockedAt+'_gate_not_reached';}
 if(JSON.stringify(await hashes())!==JSON.stringify(sourceHashes))throw new Error('source_changed');
 if(status==='RUNNING')status=rows.every(row=>row.pass)?'CANDIDATE_PASSED':'CANDIDATE_REJECTED';
}catch(error){stopReason??=error instanceof Error?error.message:'probe_failed';status='STOPPED';process.exitCode=1;}
finally{save();console.log(JSON.stringify({status,pass:rows.filter(r=>r.pass).length,evaluated:rows.length,registered:cases.length,...summarizeJevCalls(calls),stopReason,evidence:directory}));}

}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))await runProbe();
