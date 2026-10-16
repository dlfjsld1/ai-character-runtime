import {it,expect} from 'vitest';
import {createHash,randomUUID} from 'node:crypto';
import {recordedJevResponse} from './jev-fixture.ts';
import {mapJevResponse} from '../packages/adapters/src/jev.ts';
import {analyzeStoredPolicy,compareDialoguePolicy} from './jev-policy-analysis.ts';

const rubric={target:['character'] as const,act:['greeting','question'] as const,goal_relation:['unrelated'] as const,strength:[0,0] as [number,number],hostility:[0,0] as [number,number],uncertain:[false]};
const mutableRubric=()=>({...rubric,target:[...rubric.target],act:[...rubric.act],goal_relation:[...rubric.goal_relation]});
function evaluation(){const raw=recordedJevResponse('greeting');raw.answers.strength.confidence=.5;return mapJevResponse(raw,randomUUID());}
it('Q08 permits a proposed greeting with uncertain intensity while preserving neutral social effects',()=>{
 const e=evaluation(),before=JSON.stringify(e),r=compareDialoguePolicy(e,mutableRubric());
 expect(r).toMatchObject({currentDialogueEligible:false,proposedDialogueEligible:true,addedDialogue:true,addedCorrect:true,productionUncertain:true,socialEffectChanged:false});
 expect(r.proposedSocialEffect).toEqual(r.currentSocialEffect);expect(r.proposedSocialEffect.stimulus).toBe(0);expect(JSON.stringify(e)).toBe(before);
});
it.each(['target','act'] as const)('Q08 low-confidence %s cannot gain dialogue eligibility',field=>{
 const raw=recordedJevResponse('greeting');raw.answers[field].confidence=.79;
 expect(compareDialoguePolicy(mapJevResponse(raw,randomUUID()),mutableRubric()).proposedDialogueEligible).toBe(false);
});
it('Q08 quoted targets and unsupported acts cannot gain speech eligibility',()=>{
 const raw=recordedJevResponse('question','quoted',0,0,.5);
 // Core already asks for clarification on an uncertain quoted question.
 // Preserve that behavior; this candidate must add no automatic response.
 expect(compareDialoguePolicy(mapJevResponse(raw,randomUUID()),mutableRubric())).toMatchObject({currentDialogueEligible:true,addedDialogue:false,reasons:['unsupported_target_or_act','target_low_confidence','act_low_confidence']});
 const praise=recordedJevResponse('praise','character',3,0,.5);
 expect(compareDialoguePolicy(mapJevResponse(praise,randomUUID()),mutableRubric()).proposedDialogueEligible).toBe(false);
});
it.each(['tie','unknown'])('Q08 %s cannot gain speech eligibility',kind=>{
 const raw=recordedJevResponse('greeting');
 if(kind==='tie')raw.answers.target.probabilities={character:.5,activity:.5,quoted:0,other:0,unknown:0};
 else{raw.answers.target.choice='unknown';raw.answers.target.probabilities={character:0,activity:0,quoted:0,other:0,unknown:1};}
 expect(compareDialoguePolicy(mapJevResponse(raw,randomUUID()),mutableRubric()).proposedDialogueEligible).toBe(false);
});
function artifacts(e:any=evaluation()){
 // This historical analyzer accepts v4 reports only; retain that fixture provenance.
 e=structuredClone(e);e.metadata.promptVersion='jev-appraisal-v4';e.metadata.providerResult.mappingVersion='jev-appraisal-v4';
 const cases=Array.from({length:12},(_,c)=>['dev','final'].flatMap(split=>[1,2].map(n=>({id:`c${c}-${split}-${n}`,category:`c${c}`,split,text:'합성',context:{},rubric:mutableRubric()})))).flat();
 const fixtureText=JSON.stringify({version:'jev-appraisal-fixtures-v3',syntheticInputs:true,cases});
 const manifest={syntheticInputs:true,split:'dev',version:'jev-appraisal-v4',fixtureHash:createHash('sha256').update(fixtureText).digest('hex'),inputIds:cases.filter(c=>c.split==='dev').map(c=>c.id)};
 const sourceReport={split:'dev',rows:[{id:manifest.inputIds[0],evaluation:e},{id:manifest.inputIds[1],code:'jev_invalid_output'},{runError:'stopped'}]};
 return {fixtureText,manifest,sourceReport};
}
it('Q08 records partial runs and invalid cases without promoting them to complete accuracy',()=>{
 const {fixtureText,manifest,sourceReport}=artifacts(),r=analyzeStoredPolicy(sourceReport,manifest,fixtureText);
 expect(r).toMatchObject({status:'DIAGNOSTIC_BENEFIT',expected:24,observed:2,validEvaluations:1,invalidEvaluations:1,missing:22,complete:false,apiCalls:0,databaseWrites:0,productionPolicyChanged:false});
});
it('Q08 reports an unsafe extra action as FAIL when the rubric requires uncertainty',()=>{
 const {fixtureText,manifest,sourceReport}=artifacts();const fixture=JSON.parse(fixtureText);fixture.cases[0].rubric.uncertain=[true];
 const text=JSON.stringify(fixture);manifest.fixtureHash=createHash('sha256').update(text).digest('hex');
 expect(analyzeStoredPolicy(sourceReport,manifest,text)).toMatchObject({status:'FAIL',addedWrong:1});
});
it('Q08 rejects mismatch in fixture, split, version or duplicate cases',()=>{
 const {fixtureText,manifest,sourceReport}=artifacts();
 expect(()=>analyzeStoredPolicy(sourceReport,manifest,fixtureText+' ')).toThrow('policy_fixture_hash_mismatch');
 expect(()=>analyzeStoredPolicy({...sourceReport,split:'final'},manifest,fixtureText)).toThrow('policy_split_mismatch');
 expect(()=>analyzeStoredPolicy(sourceReport,{...manifest,version:'jev-appraisal-v5'},fixtureText)).toThrow('policy_version_mismatch');
 expect(()=>analyzeStoredPolicy({...sourceReport,rows:[sourceReport.rows[0],sourceReport.rows[0]]},manifest,fixtureText)).toThrow('policy_duplicate_or_unknown_case');
});
it('Q08 a choice/probability contradiction remains invalid, never repaired into the candidate',()=>{
 const e=evaluation();e.metadata.providerResult!.answers.act.choice='question';
 const {fixtureText,manifest,sourceReport}=artifacts(e),r=analyzeStoredPolicy(sourceReport,manifest,fixtureText);
 expect(r).toMatchObject({validEvaluations:0,invalidEvaluations:2,addedDialogue:0,status:'NO_ADOPTION_EVIDENCE'});
});
it('Q08 a normal current-policy greeting has no additional candidate benefit',()=>{
 const e=mapJevResponse(recordedJevResponse('greeting'),randomUUID()),{fixtureText,manifest,sourceReport}=artifacts(e);
 expect(analyzeStoredPolicy(sourceReport,manifest,fixtureText)).toMatchObject({status:'NO_ADOPTION_EVIDENCE',addedDialogue:0});
});
