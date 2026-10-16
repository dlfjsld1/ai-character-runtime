import {it,expect} from 'vitest';
import {mapJevResponse} from './jev.ts';
import {jevEvidenceVerifier} from './appraisal-evidence.ts';
import {recordedJevResponse} from '../../../evals/jev-fixture.ts';
const event={eventId:'10000000-0000-4000-8000-000000000010',identityId:'20000000-0000-4000-8000-000000000010',eventRevision:'2'};
function candidate(change?:(raw:ReturnType<typeof recordedJevResponse>)=>void){
 const raw=recordedJevResponse('praise','character',3);raw.answers.strength={...raw.answers.strength,score:2.65,confidence:.65,probabilities:{'0':0,'1':0,'2':.35,'3':.65}};change?.(raw);
 const result=mapJevResponse(raw,event.eventId);result.metadata.promptVersion='jev-appraisal-v6';
 const payload={...result.metadata.providerResult,mappingVersion:'jev-appraisal-v6'};
 return {appraisal:result.appraisal,metadata:{...result.metadata,providerResult:{version:2,provider:'jev',mappingVersion:'jev-appraisal-v6',...event,payload}}};
}
it('S1B-A preserves uncertain appraisal while granting bounded, revision-bound affect',()=>{
 const e=candidate(),before=structuredClone(e);
 expect(e.appraisal).toMatchObject({uncertain:true,strength:0});
 expect(jevEvidenceVerifier.verifyAffect?.(e.appraisal,e.metadata,event)).toEqual({kind:'praise',strength:2});
 expect(jevEvidenceVerifier.verify(e.appraisal,e.metadata,event)).toMatchObject({target:'character',act:'praise',acknowledgePraise:true});
 expect(e).toEqual(before);
});
it('S1B-B normalizes rounded probabilities and uses the conservative ordinal tail',()=>{
 for(const [probabilities,strength] of [
  [{'0':.05,'1':0,'2':.35,'3':.60},2],
  [{'0':.06,'1':0,'2':.34,'3':.60},undefined],
  [{'0':0,'1':.05,'2':.35,'3':.61},2],
  [{'0':0,'1':.2,'2':.2,'3':.6},1],
  [{'0':0,'1':0,'2':.5,'3':.5},2],
 ] as const){
  const e=candidate(raw=>{raw.answers.strength.probabilities={...probabilities};raw.answers.strength.score=Object.entries(probabilities).reduce((sum,[key,value])=>sum+Number(key)*value,0);});
  expect(jevEvidenceVerifier.verifyAffect?.(e.appraisal,e.metadata,event)).toEqual(strength?{kind:'praise',strength}:undefined);
 }
});
it('S1B-B refuses uncertain target, act, goal and hostility, or nonzero hostility',()=>{
 for(const key of ['target','act','goal_relation','hostility'] as const){
  const e=candidate(raw=>{raw.answers[key].confidence=.79;});
  expect(jevEvidenceVerifier.verifyAffect?.(e.appraisal,e.metadata,event)).toBeUndefined();
 }
 const hostile=candidate(raw=>{raw.answers.hostility={...raw.answers.hostility,score:1,confidence:1,probabilities:{'0':0,'1':1,'2':0,'3':0}};});
 expect(jevEvidenceVerifier.verifyAffect?.(hostile.appraisal,hostile.metadata,event)).toBeUndefined();
 const certain=candidate(raw=>{raw.answers.strength={...raw.answers.strength,score:3,confidence:1,probabilities:{'0':0,'1':0,'2':0,'3':1}};});
 expect(certain.appraisal.uncertain).toBe(false);expect(jevEvidenceVerifier.verifyAffect?.(certain.appraisal,certain.metadata,event)).toBeUndefined();
});
it('S1B-C rejects changed appraisal, failure and unregistered mapping; legacy v4 has no new authority',()=>{
 for(const change of [
  (e:ReturnType<typeof candidate>)=>{e.appraisal.strength=1;},
  (e:ReturnType<typeof candidate>)=>{e.metadata.failureCode='jev_failed';},
  (e:ReturnType<typeof candidate>)=>{e.metadata.promptVersion='jev-appraisal-v99';},
 ]){const e=candidate();change(e);expect(jevEvidenceVerifier.verifyAffect?.(e.appraisal,e.metadata,event)).toBeUndefined();}
 const e=candidate();const legacy={...e.metadata,promptVersion:'jev-appraisal-v4',providerResult:{...(e.metadata.providerResult as any).payload,mappingVersion:'jev-appraisal-v4'}};
 expect(jevEvidenceVerifier.verify(e.appraisal,legacy,event)).toEqual({target:'character',act:'praise'});
 expect(jevEvidenceVerifier.verifyAffect?.(e.appraisal,legacy,event)).toBeUndefined();
});
it('S1B-C refuses another revision, identity, missing revision and legacy envelope',()=>{
 for(const altered of [{...event,eventRevision:'1'},{...event,identityId:'20000000-0000-4000-8000-000000000011'},{...event,eventRevision:undefined}]){
  const e=candidate();expect(jevEvidenceVerifier.verifyAffect?.(e.appraisal,e.metadata,altered)).toBeUndefined();
 }
 const e=candidate();(e.metadata.providerResult as any).version=1;delete (e.metadata.providerResult as any).eventRevision;
 expect(jevEvidenceVerifier.verifyAffect?.(e.appraisal,e.metadata,event)).toBeUndefined();
});
