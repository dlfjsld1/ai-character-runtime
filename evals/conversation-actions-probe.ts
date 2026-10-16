// One frozen candidate, bounded synthetic Jev dev24 -> confirmation12 gate.
import {readFileSync,writeFileSync,mkdirSync,existsSync} from 'node:fs';
import {createHash,randomUUID} from 'node:crypto';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {JevConversationCandidate,JEV_CONVERSATION_VERSION,JEV_ENDPOINT,type JevCall} from '../packages/adapters/src/jev.ts';
import {jevEvidenceVerifier,readJevEvidence} from '../packages/adapters/src/appraisal-evidence.ts';
import {initialState,apply,applyRepair,chooseSocial,socialAffect} from '../packages/character-core/src/index.ts';
import type {ConversationContext} from '../packages/contracts/src/conversation.ts';
import type {AppraisalEvidenceVerifier} from '../packages/contracts/src/ai-ports.ts';
import {summarizeJevCalls} from './jev-accounting.ts';
type Case={id:string;text:string;context:string;allowedActs:string[];policy:string};
export function control(scene:Case){
 const now=1700000000000,identityId=randomUUID(),sessionId=randomUUID(),id=randomUUID(),causeId=randomUUID();
 const history={version:1 as const,sessionId,identityId,cutoffEventId:id,truncated:false,turns:[]};
 const withholding=['W','used'].includes(scene.context),listening=scene.context==='L';
 const silence=withholding||listening?{eventId:causeId,eventRevision:'1',stateVersion:'1',identityId,at:now-1000,reason:withholding?'withholding' as const:'listening' as const,sourceRefs:[{kind:'event' as const,id:causeId,version:'1'}],affect:{joy:0,frustration:withholding?.35:0,surprise:0,embarrassment:0,pleasantness:.565}}:null;
 const context:ConversationContext={version:1,sessionId,identityId,asOf:now,history,silence,repairCandidate:withholding?{eventId:causeId,revision:'1',identityId,sessionId,at:now-1000,text:'너는 쓸모없는 쓰레기야. 꺼져.',used:scene.context==='used'}:null};
 const state=apply(initialState(now),{eventId:causeId,targetId:scene.context==='other'?randomUUID():identityId,now,stimuli:{frustration:withholding||scene.context==='other'?.35:0}});
 return {now,event:{id,identityId,revision:'1',text:scene.text},context,state};
}
type AssessmentProvider={verifier:AppraisalEvidenceVerifier;readConversation:(raw:Record<string,unknown>)=>NonNullable<ReturnType<typeof readJevEvidence>['conversation']>};
export function assessConversation(scene:Case,value:Awaited<ReturnType<JevConversationCandidate['evaluate']>>,input:ReturnType<typeof control>,provider:AssessmentProvider={verifier:jevEvidenceVerifier,readConversation:raw=>readJevEvidence(raw).conversation!}){
 const binding={eventId:input.event.id,identityId:input.event.identityId,eventRevision:'1',conversationContext:input.context};
 // Historical v1 evaluator. v2 uses its own multi-act, outcome-aware scorer.
 const qualified=provider.verifier.verifyConversation!(value.appraisal,value.metadata,binding) as import('../packages/contracts/src/conversation.ts').LegacyConversationEvidence|undefined;
 const raw=provider.readConversation(value.metadata.providerResult!),rawPass=scene.allowedActs.includes(raw.conversation_act.choice);
 const affect=provider.verifier.verifyAffect!(value.appraisal,value.metadata,binding),participation=provider.verifier.verify(value.appraisal,value.metadata,binding);
 const effect=socialAffect(value.appraisal,[],input.event.identityId,input.now,affect);
 const after=apply(input.state,{eventId:input.event.id,targetId:input.event.identityId,now:input.now,stimuli:effect.category==='praise'?{joy:effect.stimulus}:effect.category==='direct_insult'?{frustration:effect.stimulus}:{}});
 const eligible=qualified?.repairTarget==='candidate'&&['apology','clarify_target'].includes(qualified.act)&&!!input.context.repairCandidate&&!input.context.repairCandidate.used&&effect.category!=='direct_insult';
 const repair=applyRepair(after,input.now,eligible),plan=chooseSocial(repair.state,value.appraisal,effect,input.event.identityId,input.now,{text:scene.text,previousSilence:input.context.silence,participationEvidence:participation,conversationEvidence:qualified});
 const noSpecial=plan.purpose!=='reengage'&&(scene.policy==='attempt'||plan.purpose!=='acknowledge_repair')&&plan.participation?.mode!=='silent'&&repair.amount===0;
 const functionalPass=scene.policy==='reason'?qualified?.act==='ask_silence_reason'&&plan.purpose==='reengage'
   :scene.policy==='listen'?qualified?.act==='listen_request'&&plan.participation?.mode==='silent'&&plan.participation.reason==='listening'
   :scene.policy==='repair'?qualified?.act===scene.allowedActs[0]&&qualified.repairTarget==='candidate'&&plan.purpose==='acknowledge_repair'&&repair.amount>0&&effect.stimulus===0
   :scene.policy==='used'?qualified?.act==='apology'&&qualified.repairTarget==='candidate'&&plan.purpose==='acknowledge_repair'&&repair.amount===0&&effect.stimulus===0
   :scene.policy==='praise'?effect.category==='praise'&&effect.stimulus>0&&plan.participation?.mode==='speak'
   :scene.policy==='attack'?effect.category==='direct_insult'&&effect.stimulus>0&&plan.participation?.mode==='silent'&&plan.participation.reason==='withholding'
   :noSpecial&&effect.stimulus===0;
 return {id:scene.id,rawPass,functionalPass:!!functionalPass,pass:!!functionalPass,rawConversation:raw,qualified:qualified??null,appraisal:value.appraisal,metadata:value.metadata,effect,repairAmount:repair.amount,plan,control:input,expectation:scene};
}
async function main(){
 const args=process.argv.slice(2);
 if(!args.includes('--synthetic-inputs')||!args.includes('--allow-jev-api'))throw new Error('explicit_synthetic_jev_required');
 const root=resolve('J:/ai/ai-character-runtime/goal2-conversation-20261014'),dir=resolve(root,'provider');
 if(existsSync(dir))throw new Error('conversation_candidate_already_attempted');
 const fixturePath='evals/fixtures/conversation-actions-v1.json',fixture=JSON.parse(readFileSync(fixturePath,'utf8')) as {dev:Case[];confirmation:Case[]};
 if(fixture.dev.length!==24||fixture.confirmation.length!==12)throw new Error('frozen_case_count_required');
 const sources=[fixturePath,'evals/conversation-actions-probe.ts','evals/jev-accounting.ts','packages/adapters/src/jev.ts','packages/adapters/src/jev-schema.ts','packages/adapters/src/appraisal-evidence.ts','packages/contracts/src/conversation.ts','packages/contracts/src/appraisal.ts','packages/contracts/src/ai-ports.ts','packages/character-core/src/index.ts','packages/database/src/store.ts','apps/runtime/src/coordinator/index.ts'];
 const hashes=()=>Object.fromEntries(sources.map(p=>[p,createHash('sha256').update(readFileSync(p)).digest('hex')]));
 const sourceHashes=hashes(),budgetUsd=.01,reservationPerCallUsd=.002688,cases=[...fixture.dev,...fixture.confirmation].map(scene=>({scene,control:control(scene)}));
 mkdirSync(dir,{recursive:true});
 const manifest={candidate:JEV_CONVERSATION_VERSION,sourceHashes,syntheticInputs:true,budgetUsd,existingJevBudgetUsd:1,priorKnownJevUsd:.01923705,priorUnknownReservedUsd:.002688,openaiBudgetSeparate:true,maxCalls:36,automaticRetries:0,contextOrigin:'injected_controls; real Store path separately tested with mock provider',stateOrigin:'injected_controls',cases,rule:'all dev functional criteria required; raw errors separately retained; first provider/usage/budget error stops; no prompt revision; confirmation only once after dev gate',priceSource:'https://typesafe.ai/',inputUsdPerMillion:.042};
 writeFileSync(resolve(dir,'manifest.json'),JSON.stringify(manifest,null,2));
 process.loadEnvFile('runtime-data/jev.env');
 const calls:JevCall[]=[],rows:ReturnType<typeof assessConversation>[]=[],attempts:any[]=[];let status='RUNNING',active=-1,stopReason:string|null=null;
 const save=()=>writeFileSync(resolve(dir,'results.json'),JSON.stringify({status,rows,calls,attempts,stopReason,sourceHashes,...summarizeJevCalls(calls)},null,2));save();
 const provider=new JevConversationCandidate({localOnly:false,allowPaidProviders:true,apiKey:process.env.TYPESAFE_API_KEY??'',onCall:call=>{calls.push(call);if(call.errorCode||call.usageStatus==='unknown')stopReason=call.errorCode??'jev_usage_unknown';save();}},async(url,init)=>{
   if(stopReason||String(url)!==JEV_ENDPOINT||active!==attempts.length||attempts.length>=36)throw new Error('unregistered_request');
   if(summarizeJevCalls(calls).estimatedKnownCostUsd+reservationPerCallUsd>budgetUsd||manifest.priorKnownJevUsd+manifest.priorUnknownReservedUsd+budgetUsd>1)throw new Error('budget_reservation_unavailable');
   const body=JSON.parse(String(init?.body));if(body.state.utterance!==cases[active]!.scene.text)throw new Error('request_mismatch');
   attempts.push({id:cases[active]!.scene.id,reservedUsd:reservationPerCallUsd});save();writeFileSync(resolve(dir,cases[active]!.scene.id+'-request.json'),JSON.stringify(body,null,2));
   const response=await fetch(url,init);if(!response.ok)return response;
   const text=await response.text();if(Buffer.byteLength(text)>65536)throw new Error('response_too_large');writeFileSync(resolve(dir,cases[active]!.scene.id+'-response.json'),text);return new Response(text,{status:response.status,headers:{'content-type':'application/json'}});
 });
 try{
   if(provider.readiness().status==='blocked')throw new Error(provider.readiness().errorCode??'jev_blocked');
   for(const phase of ['dev','confirmation'] as const){
     if(phase==='confirmation'&&rows.some(r=>!r.pass)){status='CANDIDATE_REJECTED';stopReason='dev_gate_not_reached';break;}
     if(phase==='confirmation')writeFileSync(resolve(dir,'confirmation-gate.json'),JSON.stringify({devRows:rows.length,allFunctionalPass:rows.every(r=>r.pass),sourceHashes},null,2));
     for(const scene of fixture[phase]){
       active++;const item=cases[active]!;
       const value=await provider.evaluate(item.control.event,{activity:null,conversation:item.control.context.history,conversationContext:item.control.context});
       rows.push(assessConversation(scene,value,item.control));save();console.log(scene.id+' '+(rows.at(-1)!.pass?'PASS':'FAIL')+' '+JSON.stringify(rows.at(-1)!.qualified));if(stopReason)throw new Error(stopReason);
     }
   }
   if(JSON.stringify(hashes())!==JSON.stringify(sourceHashes))throw new Error('source_changed');
   if(status==='RUNNING')status=rows.every(r=>r.pass)?'CANDIDATE_PASSED':'CANDIDATE_REJECTED';
 }catch(e){status='STOPPED';stopReason=e instanceof Error?e.message:'probe_failed';}finally{save();}
 console.log(JSON.stringify({status,evaluated:rows.length,pass:rows.filter(r=>r.pass).length,confirmationCalls:attempts.filter(a=>a.id.startsWith('HA')).length,...summarizeJevCalls(calls),stopReason,dir}));
 if(status==='STOPPED')process.exitCode=1;
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))await main();
