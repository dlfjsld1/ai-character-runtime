// Fixed synthetic S1B permission evaluation. No Store, prompt rewriting or retry.
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {randomUUID,createHash} from 'node:crypto';
import {loadLocalEnv} from '../scripts/env.ts';
import {JevAppraisalProvider,JEV_VERSION,JEV_QUESTIONS,JEV_ENDPOINT,type JevCall} from '../packages/adapters/src/jev.ts';
import {jevEvidenceVerifier} from '../packages/adapters/src/appraisal-evidence.ts';
import {socialAffect,socialEffect} from '../packages/character-core/src/index.ts';
import {summarizeJevCalls} from './jev-accounting.ts';
const arg=(key:string)=>{const i=process.argv.indexOf(key);return i<0?undefined:process.argv[i+1];};
const root=arg('--output-root'),budget=Number(arg('--max-cost-usd'));
if(!process.argv.includes('--synthetic-inputs')||!process.argv.includes('--allow-jev-api')||!root||!/^J:[\\/]ai[\\/]/i.test(resolve(root))||!(budget>0&&budget<=.005))throw new Error('explicit_bounded_synthetic_run_required');
const fixture=JSON.parse(await readFile('evals/fixtures/jev-s1-v1.json','utf8'));
type Case={id:string;text:string;target:string[];act:string[];gate:string;set:string};
const cases:Case[]=[...fixture.dev.map((c:Case)=>({...c,set:'exposed-dev'})),...fixture.confirmation.map((c:Case)=>({...c,set:'previously-uncalled-confirmation'})),
 {id:'N01',text:'네가 잘했다는 말은 아니야.',target:['character'],act:['criticism','other','decline'],gate:'protected',set:'new-negation'},
 {id:'N02',text:'민수는 잘했지만 너는 잘하지 못했어.',target:['character'],act:['criticism','other'],gate:'protected',set:'new-mixed'},
 {id:'N03',text:'‘너 잘했어’라는 문장을 영어로 번역해줘.',target:['character','quoted'],act:['question','other'],gate:'protected',set:'new-quoted-request'},
 {id:'N04',text:'너 설명은 잘했지만, 내가 칭찬하는 건 민수야.',target:['other','unknown'],act:['praise','other'],gate:'protected',set:'new-mixed'},
];
const directory=resolve(root,`probe-${new Date().toISOString().replace(/[:.]/g,'-')}`);await mkdir(directory,{recursive:true});
const paths=['evals/jev-s1b-probe.ts','evals/fixtures/jev-s1-v1.json','packages/adapters/src/jev.ts','packages/adapters/src/jev-schema.ts','packages/adapters/src/appraisal-evidence.ts','packages/character-core/src/index.ts'];
const hashes=async()=>Object.fromEntries(await Promise.all(paths.map(async p=>[p,createHash('sha256').update(await readFile(p)).digest('hex')])));
const sourceHashes=await hashes();
await writeFile(resolve(directory,'manifest.json'),JSON.stringify({version:'c2-s1b-v1',mappingVersion:JEV_VERSION,questions:JEV_QUESTIONS,sourceHashes,cases,syntheticInputs:true,personalDataUsed:false,budgetUsd:budget,priorKnownCostUsd:.010635282,priorUnknownUsageCalls:1,globalBudgetUsd:1,automaticRetries:0,
 rubric:'Report raw target/act accuracy separately; previous S1 dev 11/16 is unchanged. Praise: positive personal affect plus participation evidence, strict appraisal preserved; uncertain cases must have zero relationship effect. Protected: zero praise affect and no acknowledgePraise authority (criticism is not praise). Participation: verified target/act. Attack: positive existing direct_insult affect. All 28 permission criteria must pass. No threshold or prompt adjustment after outputs; classify mixed/negation failures explicitly.',
},null,2));
const calls:JevCall[]=[],rows:Record<string,any>[]=[];let active=-1,attempts=0,stopReason:string|null=null,status='RUNNING';
const save=()=>writeFileSync(resolve(directory,'results.json'),JSON.stringify({status,sourceHashes,calls,rows,actualHttpAttempts:attempts,stopReason,...summarizeJevCalls(calls)},null,2));
const fetcher:typeof fetch=async(url,options)=>{
 if(stopReason||String(url)!==JEV_ENDPOINT||active!==attempts||attempts>=cases.length)throw new Error('unregistered_request');
 if(summarizeJevCalls(calls).estimatedKnownCostUsd+.002688>budget)throw new Error('budget_reservation_unavailable');
 const body=String(options?.body);if(JSON.parse(body).state.utterance!==cases[active]!.text||Buffer.byteLength(body)>32000)throw new Error('unregistered_input');
 await writeFile(resolve(directory,`${cases[active]!.id}-request.json`),body);attempts++;
 const response=await fetch(url,options);if(!response.ok)return response;
 const reader=response.body!.getReader(),chunks:Uint8Array[]=[];let size=0;
 try{for(;;){const part=await reader.read();if(part.done)break;size+=part.value.length;if(size>65536)throw new Error('response_too_large');chunks.push(part.value);}}finally{await reader.cancel().catch(()=>{});}
 const raw=Buffer.concat(chunks).toString('utf8');await writeFile(resolve(directory,`${cases[active]!.id}-response.json`),raw);return new Response(raw,{status:response.status,headers:{'content-type':'application/json'}});
};
try{
 loadLocalEnv();const provider=new JevAppraisalProvider({localOnly:false,allowPaidProviders:true,apiKey:process.env.TYPESAFE_API_KEY??'',onCall:call=>{calls.push(call);if(call.errorCode||call.usageStatus==='unknown')stopReason=call.errorCode??'jev_usage_unknown';save();}},fetcher);
 if(provider.readiness().status==='blocked')throw new Error(provider.readiness().errorCode??'jev_blocked');
 for(active=0;active<cases.length;active++){
  if(stopReason)throw new Error(stopReason);const item=cases[active]!,event={id:randomUUID(),identityId:randomUUID(),revision:'1',text:item.text},binding={eventId:event.id,identityId:event.identityId,eventRevision:event.revision};
  const evaluation=await provider.evaluate(event,{activity:null}),affectEvidence=jevEvidenceVerifier.verifyAffect?.(evaluation.appraisal,evaluation.metadata,binding),participation=jevEvidenceVerifier.verify(evaluation.appraisal,evaluation.metadata,binding),effect=socialAffect(evaluation.appraisal,[],event.identityId,0,affectEvidence),relationship=socialEffect(evaluation.appraisal,[],event.identityId,0);
  const permissionPass=item.gate==='praise'?effect.category==='praise'&&effect.stimulus>0&&!!participation?.acknowledgePraise&&(!evaluation.appraisal.uncertain||relationship.stimulus===0):item.gate==='protected'?!(effect.category==='praise'&&effect.stimulus>0)&&!participation?.acknowledgePraise:item.gate==='attack'?effect.category==='direct_insult'&&effect.stimulus>0:!!participation;
  const row={id:item.id,set:item.set,permissionPass,rawClassificationPass:item.target.includes(evaluation.appraisal.target)&&item.act.includes(evaluation.appraisal.act),evaluation,affectEvidence:affectEvidence??null,participation:participation??null,effect,relationship};rows.push(row);save();console.log(JSON.stringify({id:item.id,permissionPass,rawClassificationPass:row.rawClassificationPass,appraisal:evaluation.appraisal,affectEvidence,stimulus:effect.stimulus}));
 }
 if(JSON.stringify(await hashes())!==JSON.stringify(sourceHashes))throw new Error('source_changed');status='COMPLETED';
}catch(error){stopReason??=error instanceof Error?error.message:'probe_failed';status='STOPPED';process.exitCode=1;}
finally{save();console.log(JSON.stringify({status,permissionPass:rows.filter(r=>r.permissionPass).length,total:cases.length,...summarizeJevCalls(calls),stopReason,evidence:directory}));}
