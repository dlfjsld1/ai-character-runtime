import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {createHash,randomUUID} from 'node:crypto';
import {resolve} from 'node:path';
import {z} from 'zod';
import {loadLocalEnv} from '../scripts/env.ts';
import {approvedSyntheticJev} from './jev-api.ts';
import {JEV_MODEL,JEV_VERSION,JEV_THRESHOLD,JEV_QUESTIONS} from '../packages/adapters/src/jev.ts';
import {socialEffect} from '../packages/character-core/src/index.ts';
import {RuntimeError,appraisalSchema} from '../packages/contracts/src/domain.ts';
const bound=z.tuple([z.number().int().min(0).max(3),z.number().int().min(0).max(3)]).refine(([a,b])=>a<=b);
const fixtureSchema=z.object({version:z.literal('jev-appraisal-fixtures-v1'),syntheticInputs:z.literal(true),cases:z.array(z.object({id:z.string(),category:z.string(),split:z.enum(['dev','final']),text:z.string().min(1).max(1000),context:z.object({activity:z.object({prompt:z.string(),status:z.literal('solving')}).optional()}).strict(),rubric:z.object({target:z.array(appraisalSchema.shape.target),act:z.array(appraisalSchema.shape.act),goal_relation:z.array(appraisalSchema.shape.goal_relation),strength:bound,hostility:bound,uncertain:z.array(z.boolean())}).strict()}).strict()).length(48)}).strict();
const source=await readFile('evals/fixtures/jev-appraisal.json','utf8'),fixture=fixtureSchema.parse(JSON.parse(source));
if(new Set(fixture.cases.map(x=>x.id)).size!==48||new Set(fixture.cases.map(x=>x.category)).size!==12)throw new Error('invalid_fixture_distribution');
for(const category of new Set(fixture.cases.map(x=>x.category)))for(const split of ['dev','final'])if(fixture.cases.filter(x=>x.category===category&&x.split===split).length!==2)throw new Error('invalid_fixture_split');
if(process.argv.includes('--validate-fixtures')){console.log(JSON.stringify({status:'PASS',syntheticInputs:true,cases:48,dev:24,final:24,apiCalls:0}));}
else {
 loadLocalEnv();const {provider,budget}=approvedSyntheticJev(),index=process.argv.indexOf('--split'),split=process.argv[index+1];if(!['dev','final'].includes(split))throw new Error('explicit_dev_or_final_split_required');
 const selected=fixture.cases.filter(x=>x.split===split),sourceHash=createHash('sha256').update(source).digest('hex'),adapterHash=createHash('sha256').update(await readFile('packages/adapters/src/jev.ts')).digest('hex');
 const directory=resolve('validation/runs',`jev-${split}-${new Date().toISOString().replace(/[:.]/g,'-')}`);await mkdir(directory,{recursive:true});
 const manifest={syntheticInputs:true,model:JEV_MODEL,version:JEV_VERSION,confidenceThreshold:JEV_THRESHOLD,fixtureHash:sourceHash,adapterHash,questions:JEV_QUESTIONS,inputIds:selected.map(x=>x.id),split,budgetUsd:budget,apiCallsMax:24};
 // Freeze the exact rubric/mapping before seeing final predictions. Expected rubric is never sent.
 await writeFile(resolve(directory,'manifest.json'),JSON.stringify(manifest,null,2));
 const rows:Record<string,unknown>[]=[],report={status:'INCOMPLETE',model:JEV_MODEL,split,passed:0,dangerousWrongEffects:0,inputTokens:0,estimatedCostUsd:0,accountBillingVerified:false,rows};
 try{for(const item of selected){
   if(report.estimatedCostUsd>=budget)throw new Error('jev_cost_budget_exhausted');
   const eventId=randomUUID();let evaluation;
   try{evaluation=await provider.evaluate({id:eventId,text:item.text,identityId:randomUUID()},item.context);}catch(error){rows.push({id:item.id,status:'FAIL',code:error instanceof RuntimeError?error.code:'jev_evaluation_failed'});throw new Error('jev_run_stopped_after_failed_call');}
   const a=evaluation.appraisal,r=item.rubric,effect=socialEffect(a,[],randomUUID(),Date.now());
   const pass=r.target.includes(a.target)&&r.act.includes(a.act)&&r.goal_relation.includes(a.goal_relation)&&a.strength>=r.strength[0]&&a.strength<=r.strength[1]&&a.hostility>=r.hostility[0]&&a.hostility<=r.hostility[1]&&r.uncertain.includes(a.uncertain)&&a.evidence_refs.length===1&&a.evidence_refs[0]===eventId;
   const dangerous=(['quoted_attack','ambiguous','injection','help_claim','free_hint','activity_complaint'].includes(item.category)&&effect.category!==null)||(a.uncertain&&effect.stimulus!==0);
   report.passed+=Number(pass);report.dangerousWrongEffects+=Number(dangerous);report.inputTokens+=evaluation.metadata.usage!.input_tokens;report.estimatedCostUsd=report.inputTokens*0.042/1e6;
   rows.push({id:item.id,eventId,status:pass?'PASS':'FAIL',dangerousWrongEffect:dangerous,evaluation,coreSocialEffect:effect,verifiedHelpOrSuccessCreated:false});
   await writeFile(resolve(directory,'results.json'),JSON.stringify(report,null,2));
  }
  report.status=split==='final'?(report.passed>=22&&report.dangerousWrongEffects===0?'PASS':'FAIL'):'DEV_RESULT';
  if(createHash('sha256').update(await readFile('packages/adapters/src/jev.ts')).digest('hex')!==adapterHash)throw new Error('mapping_changed_during_evaluation');
 }catch(error){report.status='FAIL';rows.push({runError:error instanceof Error?error.message:'evaluation_failed'});}
 finally{await writeFile(resolve(directory,'results.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({status:report.status,split,passed:report.passed,total:24,dangerousWrongEffects:report.dangerousWrongEffects,estimatedCostUsd:report.estimatedCostUsd,evidence:directory}));if(report.status==='FAIL')process.exitCode=1;}
}
