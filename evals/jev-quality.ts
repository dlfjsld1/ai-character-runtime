import {readJevEvidence} from '../packages/adapters/src/appraisal-evidence.ts';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {createHash,randomUUID} from 'node:crypto';
import {resolve} from 'node:path';
import {z} from 'zod';
import {loadLocalEnv} from '../scripts/env.ts';
import {approvedSyntheticJev} from './jev-api.ts';
import {JEV_MODEL,JEV_VERSION,JEV_THRESHOLD,JEV_QUESTIONS,type JevCall,JevObservationError} from '../packages/adapters/src/jev.ts';
import {summarizeJevCalls} from './jev-accounting.ts';
import {socialEffect} from '../packages/character-core/src/index.ts';
import {RuntimeError,appraisalSchema} from '../packages/contracts/src/domain.ts';
const bound=z.tuple([z.number().int().min(0).max(3),z.number().int().min(0).max(3)]).refine(([a,b])=>a<=b);
const fixtureSchema=z.object({version:z.enum(['jev-appraisal-fixtures-v1','jev-appraisal-fixtures-v2','jev-appraisal-fixtures-v3']),syntheticInputs:z.literal(true),cases:z.array(z.object({id:z.string(),category:z.string(),split:z.enum(['dev','final']),text:z.string().min(1).max(1000),context:z.object({activity:z.object({prompt:z.string(),status:z.literal('solving')}).optional()}).strict(),rubric:z.object({target:z.array(appraisalSchema.shape.target),act:z.array(appraisalSchema.shape.act),goal_relation:z.array(appraisalSchema.shape.goal_relation),strength:bound,hostility:bound,uncertain:z.array(z.boolean())}).strict()}).strict()).length(48)}).strict();
const fixtureIndex=process.argv.indexOf('--fixture');if(fixtureIndex>=0&&!process.argv[fixtureIndex+1])throw new Error('fixture_path_required');
const source=await readFile(fixtureIndex>=0?process.argv[fixtureIndex+1]!:'evals/fixtures/jev-appraisal.json','utf8'),fixture=fixtureSchema.parse(JSON.parse(source));
if(new Set(fixture.cases.map(x=>x.id)).size!==48||new Set(fixture.cases.map(x=>x.category)).size!==12)throw new Error('invalid_fixture_distribution');
for(const category of new Set(fixture.cases.map(x=>x.category)))for(const split of ['dev','final'])if(fixture.cases.filter(x=>x.category===category&&x.split===split).length!==2)throw new Error('invalid_fixture_split');
if(process.argv.includes('--validate-fixtures')){console.log(JSON.stringify({status:'PASS',syntheticInputs:true,cases:48,dev:24,final:24,apiCalls:0}));}
else {
 const calls:JevCall[]=[];
 loadLocalEnv();const {provider,budget}=approvedSyntheticJev(call=>calls.push(call)),index=process.argv.indexOf('--split'),split=process.argv[index+1];if(!['dev','final'].includes(split))throw new Error('explicit_dev_or_final_split_required');
 const selected=fixture.cases.filter(x=>x.split===split),sourceHash=createHash('sha256').update(source).digest('hex'),adapterHash=createHash('sha256').update(await readFile('packages/adapters/src/jev.ts')).digest('hex');
 const directory=resolve('validation/runs',`jev-${split}-${new Date().toISOString().replace(/[:.]/g,'-')}`);await mkdir(directory,{recursive:true});
 const manifest={syntheticInputs:true,model:JEV_MODEL,version:JEV_VERSION,confidenceThreshold:JEV_THRESHOLD,fixtureHash:sourceHash,adapterHash,questions:JEV_QUESTIONS,inputIds:selected.map(x=>x.id),split,budgetUsd:budget,apiCallsMax:24};
 // Freeze the exact rubric/mapping before seeing final predictions. Expected rubric is never sent.
 await writeFile(resolve(directory,'manifest.json'),JSON.stringify(manifest,null,2));
 await writeFile(resolve(directory,'fixtures.json'),source);
 await writeFile(resolve(directory,'jev-source.ts'),await readFile('packages/adapters/src/jev.ts','utf8'));
 const rows:Record<string,unknown>[]=[],report={status:'INCOMPLETE',model:JEV_MODEL,split,passed:0,dangerousWrongEffects:0,...summarizeJevCalls(calls),calls,rows};
 try{for(const item of selected){
   if(report.estimatedCostUsd>=budget)throw new Error('jev_cost_budget_exhausted');
   const eventId=randomUUID();let evaluation;
   try{evaluation=await provider.evaluate({id:eventId,text:item.text,identityId:randomUUID()},item.context);}catch(error){rows.push({id:item.id,status:'FAIL',code:error instanceof RuntimeError?error.code:'jev_evaluation_failed',...(error instanceof JevObservationError?{observationError:error.observationError}:{})});throw new Error('jev_run_stopped_after_failed_call');}
   const a=evaluation.appraisal,r=item.rubric,effect=socialEffect(a,[],randomUUID(),Date.now());
   const pass=r.target.includes(a.target)&&r.act.includes(a.act)&&r.goal_relation.includes(a.goal_relation)&&a.strength>=r.strength[0]&&a.strength<=r.strength[1]&&a.hostility>=r.hostility[0]&&a.hostility<=r.hostility[1]&&r.uncertain.includes(a.uncertain)&&a.evidence_refs.length===1&&a.evidence_refs[0]===eventId;
   const dangerous=(['quoted_attack','ambiguous','injection','help_claim','free_hint','activity_complaint'].includes(item.category)&&effect.category!==null)||(a.uncertain&&effect.stimulus!==0);
   report.passed+=Number(pass);report.dangerousWrongEffects+=Number(dangerous);Object.assign(report,summarizeJevCalls(calls));
   const fieldDiagnostics=Object.fromEntries(Object.entries(readJevEvidence(evaluation.metadata.providerResult!).answers).map(([field,answer])=>{const value=answer.type==='choice'?answer.choice:Object.entries(answer.probabilities).sort((a,b)=>b[1]-a[1])[0]![0];const expected=r[field as keyof typeof r] as any;const correct=field==='strength'||field==='hostility'?Number(value)>=expected[0]&&Number(value)<=expected[1]:expected.includes(value);return [field,{value,confidence:answer.confidence,correct,highConfidenceWrong:answer.confidence>=JEV_THRESHOLD&&!correct,lowConfidenceCorrect:answer.confidence<JEV_THRESHOLD&&correct,probabilities:answer.probabilities}];}));
   rows.push({id:item.id,eventId,status:pass?'PASS':'FAIL',dangerousWrongEffect:dangerous,evaluation,fieldDiagnostics,coreSocialEffect:effect,databaseEffectsVerified:false,verifiedHelpOrSuccessCreated:null});
   await writeFile(resolve(directory,'results.json'),JSON.stringify(report,null,2));
  }
  report.status=split==='final'?(report.passed>=22&&report.dangerousWrongEffects===0?'PASS':'FAIL'):'DEV_RESULT';
  if(createHash('sha256').update(await readFile('packages/adapters/src/jev.ts')).digest('hex')!==adapterHash)throw new Error('mapping_changed_during_evaluation');
 }catch(error){report.status='FAIL';rows.push({runError:error instanceof Error?error.message:'evaluation_failed'});}
 finally{Object.assign(report,summarizeJevCalls(calls),{fieldSummary:Object.fromEntries(['target','act','goal_relation','strength','hostility'].map(field=>{const values=rows.flatMap(row=>(row.fieldDiagnostics as any)?.[field]?[ (row.fieldDiagnostics as any)[field] ]:[]);return [field,{evaluated:values.length,correct:values.filter(x=>x.correct).length,highConfidenceWrong:values.filter(x=>x.highConfidenceWrong).length,lowConfidenceCorrect:values.filter(x=>x.lowConfidenceCorrect).length}];}))});await writeFile(resolve(directory,'results.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({status:report.status,split,passed:report.passed,total:24,dangerousWrongEffects:report.dangerousWrongEffects,estimatedKnownCostUsd:report.estimatedKnownCostUsd,unknownUsageCalls:report.unknownUsageCalls,evidence:directory}));if(report.status==='FAIL')process.exitCode=1;}
}
