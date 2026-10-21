import {readJevEvidence} from '../packages/adapters/src/appraisal-evidence.ts';
// Diagnostic comparison of already-paid responses. No provider, DB or Core writes.
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve,dirname} from 'node:path';
import {pathToFileURL} from 'node:url';
import {z} from 'zod';
import {appraisalSchema} from '../packages/contracts/src/domain.ts';
import {appraisalEvaluationSchema,type AppraisalEvaluation} from '../packages/contracts/src/appraisal.ts';
import {initialState,chooseSocial,socialEffect} from '../packages/character-core/src/index.ts';
import {mapJevResponse,JEV_THRESHOLD} from '../packages/adapters/src/jev.ts';

const versions=['jev-appraisal-v1','jev-appraisal-v2','jev-appraisal-v3','jev-appraisal-v4','jev-appraisal-v5'] as const;
const bounds=z.tuple([z.number().int().min(0).max(3),z.number().int().min(0).max(3)]).refine(([a,b])=>a<=b);
const rubricSchema=z.object({target:z.array(appraisalSchema.shape.target),act:z.array(appraisalSchema.shape.act),goal_relation:z.array(appraisalSchema.shape.goal_relation),strength:bounds,hostility:bounds,uncertain:z.array(z.boolean())}).strict();
type Rubric=z.infer<typeof rubricSchema>;
const manifestSchema=z.object({syntheticInputs:z.literal(true),split:z.enum(['dev','final']),version:z.enum(versions),fixtureHash:z.string().regex(/^[a-f0-9]{64}$/),inputIds:z.array(z.string()).length(24)});
const fixtureSchema=z.object({syntheticInputs:z.literal(true),version:z.enum(['jev-appraisal-fixtures-v1','jev-appraisal-fixtures-v2','jev-appraisal-fixtures-v3']),cases:z.array(z.object({id:z.string(),category:z.string(),split:z.enum(['dev','final']),rubric:rubricSchema})).length(48)});
const identityId='20000000-0000-4000-8000-000000000001';
const hash=(text:string)=>createHash('sha256').update(text).digest('hex');

export function compareDialoguePolicy(evaluation:AppraisalEvaluation,rubric:Rubric){
 const a=evaluation.appraisal,answers=readJevEvidence(evaluation.metadata.providerResult!).answers;
 const effect=socialEffect(a,[],identityId,0);
 const currentPlan=chooseSocial(initialState(0),a,effect,identityId,0);
 // Q08 is a record against the policy of its time, when uncertain Jev meaning
 // deferred non-question replies. Since 2026-10-21 uncertainty withholds affect only.
 const historicalDefer=(a.uncertain||a.target==='unknown')&&a.act!=='question';
 const currentDialogueEligible=!historicalDefer&&!['listen','ignore'].includes(currentPlan.action);
 const reasons:string[]=[];
 if(a.target!=='character'||!['greeting','question'].includes(a.act))reasons.push('unsupported_target_or_act');
 for(const field of ['target','act'] as const){
  const answer=answers[field],max=Math.max(...Object.values(answer.probabilities));
  if(answer.confidence<JEV_THRESHOLD)reasons.push(`${field}_low_confidence`);
  if(Object.values(answer.probabilities).filter(p=>p===max).length!==1)reasons.push(`${field}_tied`);
  if(answer.choice==='unknown')reasons.push(`${field}_unknown`);
 }
 const proposedDialogueEligible=currentDialogueEligible||reasons.length===0;
 const addedDialogue=proposedDialogueEligible&&!currentDialogueEligible;
 // The candidate changes speech eligibility only. A rubric requiring uncertainty
 // cannot count an automatic greeting/answer as a correct additional action.
 const addedCorrect=addedDialogue?rubric.target.includes(a.target)&&rubric.act.includes(a.act)&&rubric.uncertain.includes(false):null;
 const modalFieldsCorrect=Object.entries(answers).every(([field,answer])=>{
  const value=answer.type==='choice'?answer.choice:Number(Object.entries(answer.probabilities).sort((a,b)=>b[1]-a[1])[0]![0]);
  const expected=rubric[field as keyof Rubric];
  return typeof value==='number'?value>=(expected as [number,number])[0]&&value<=(expected as [number,number])[1]:(expected as string[]).includes(value);
 });
 return {currentDialogueEligible,proposedDialogueEligible,addedDialogue,addedCorrect,reasons,modalFieldsCorrect,
  currentSocialEffect:effect,proposedSocialEffect:effect,socialEffectChanged:false,productionUncertain:a.uncertain};
}

export function analyzeStoredPolicy(sourceReport:unknown,sourceManifest:unknown,fixtureText:string){
 const manifest=manifestSchema.parse(sourceManifest);
 if(hash(fixtureText)!==manifest.fixtureHash)throw new Error('policy_fixture_hash_mismatch');
 const fixture=fixtureSchema.parse(JSON.parse(fixtureText));
 if(new Set(fixture.cases.map(c=>c.id)).size!==48||new Set(fixture.cases.map(c=>c.category)).size!==12)throw new Error('policy_fixture_distribution');
 for(const category of new Set(fixture.cases.map(c=>c.category)))for(const split of ['dev','final'])if(fixture.cases.filter(c=>c.category===category&&c.split===split).length!==2)throw new Error('policy_fixture_distribution');
 const selected=fixture.cases.filter(c=>c.split===manifest.split);
 if(JSON.stringify(manifest.inputIds)!==JSON.stringify(selected.map(c=>c.id)))throw new Error('policy_split_or_ids_mismatch');
 const source=z.object({split:z.enum(['dev','final']),rows:z.array(z.object({id:z.string().optional(),evaluation:z.unknown().optional(),code:z.string().optional()}))}).parse(sourceReport);
 if(source.split!==manifest.split)throw new Error('policy_split_mismatch');
 const seen=new Set<string>();
 const rows=source.rows.filter(row=>row.id!==undefined).map(row=>{
  const item=selected.find(c=>c.id===row.id);if(!item||seen.has(item.id))throw new Error('policy_duplicate_or_unknown_case');seen.add(item.id);
  if(!row.evaluation)return {id:item.id,status:'INVALID' as const,code:row.code??'evaluation_missing'};
  const parsed=appraisalEvaluationSchema.safeParse(row.evaluation);
  if(!parsed.success)return {id:item.id,status:'INVALID' as const,code:'invalid_stored_evaluation'};
  const e=parsed.data;
  if(e.metadata.promptVersion!==manifest.version||(e.metadata.providerResult?readJevEvidence(e.metadata.providerResult).mappingVersion:undefined)!==manifest.version)throw new Error('policy_version_mismatch');
  try{
   const mapped=mapJevResponse({model:e.metadata.model,answers:readJevEvidence(e.metadata.providerResult!).answers,usage:e.metadata.usage},e.appraisal.evidence_refs[0]!);
   if(JSON.stringify(mapped.appraisal)!==JSON.stringify(e.appraisal))throw new Error('stored_mapping_mismatch');
  }catch{return {id:item.id,status:'INVALID' as const,code:'invalid_stored_mapping'};}
  const policy=compareDialoguePolicy(e,item.rubric);
  const mustBeNeutral=e.appraisal.uncertain||['quoted_attack','ambiguous','injection','help_claim','free_hint','activity_complaint'].includes(item.category);
  return {id:item.id,status:'COMPARED' as const,...policy,dangerousSocialEffect:mustBeNeutral&&policy.proposedSocialEffect.category!==null};
 });
 const compared=rows.filter(r=>r.status==='COMPARED');
 const added=compared.filter(r=>r.addedDialogue),wrong=added.filter(r=>!r.addedCorrect).length;
 const dangerous=compared.filter(r=>r.dangerousSocialEffect).length;
 return {status:wrong||dangerous?'FAIL':added.length?'DIAGNOSTIC_BENEFIT':'NO_ADOPTION_EVIDENCE',apiCalls:0,databaseWrites:0,productionPolicyChanged:false,
  mappingVersion:manifest.version,fixtureVersion:fixture.version,fixtureHash:manifest.fixtureHash,split:manifest.split,
  scope:manifest.split==='final'?'historical exposed final diagnostic; not acceptance':'stored dev diagnostic; not new model accuracy',expected:24,observed:rows.length,validEvaluations:compared.length,invalidEvaluations:rows.length-compared.length,missing:24-rows.length,complete:compared.length===24,
  modalFiveFieldsWithinRubric:compared.filter(r=>r.modalFieldsCorrect).length,currentDialogueEligible:compared.filter(r=>r.currentDialogueEligible).length,proposedDialogueEligible:compared.filter(r=>r.proposedDialogueEligible).length,
  addedDialogue:added.length,addedCorrect:added.length-wrong,addedWrong:wrong,dangerousSocialEffects:dangerous,rows};
}

if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
 const index=process.argv.indexOf('--results');if(index<0||!process.argv[index+1])throw new Error('policy_results_required');
 const path=resolve(process.argv[index+1]),source=await readFile(path,'utf8'),manifest=await readFile(resolve(dirname(path),'manifest.json'),'utf8'),fixtures=await readFile(resolve(dirname(path),'fixtures.json'),'utf8');
 const report={...analyzeStoredPolicy(JSON.parse(source),JSON.parse(manifest),fixtures),source:path,sourceHash:hash(source),manifestHash:hash(manifest)};
 const directory=resolve('validation/runs',`jev-policy-${new Date().toISOString().replace(/[:.]/g,'-')}`);await mkdir(directory,{recursive:true});
 await writeFile(resolve(directory,'results.json'),JSON.stringify(report,null,2));
 console.log(JSON.stringify({...report,rows:undefined,evidence:directory}));if(report.status==='FAIL')process.exitCode=1;
}
