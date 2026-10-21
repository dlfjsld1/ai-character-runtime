import {it,expect} from 'vitest';
import {socialAffect,socialEffect,initialState,chooseSocial,projectRelationships} from './index.ts';
import {neutralAppraisal,type EvidenceInput} from '../../contracts/src/domain.ts';
const praise={...neutralAppraisal,target:'character' as const,act:'praise' as const};
it('S1B-D relationship excludes affect-only history while affect includes it',()=>{
 const history:EvidenceInput[]=[{id:'a',identityId:'speaker',kind:'praise',at:0,order:1n,strength:0,relationshipEligible:false,appliedStimulus:0,affectStimulus:.12}];
 expect(socialAffect(praise,history,'speaker',0,{kind:'praise',strength:2}).stimulus).toBe(.06);
 expect(socialEffect({...praise,uncertain:false,strength:3},history,'speaker',0).stimulus).toBe(.18);
 expect(projectRelationships(history).get('speaker')?.affinity??.5).toBe(.5);
 expect(socialAffect(praise,history,'speaker',0).stimulus).toBe(0);
 expect(socialAffect({...praise,target:'quoted'},history,'speaker',0,{kind:'praise',strength:2}).stimulus).toBe(0);
});
it('S1B-E participation remains separate from positive affect and preserves its rate cap',()=>{
 const now=1700000000000,state=initialState(now),effect=socialAffect(praise,[],'speaker',now),context={participationEvidence:{target:'character' as const,act:'praise' as const,acknowledgePraise:true as const}};
 expect(effect.stimulus).toBe(0);expect(chooseSocial(state,praise,effect,'speaker',now,context).participation).toEqual({mode:'speak'});
 state.turn.acknowledgements['speaker:praise']=now;
 expect(chooseSocial(state,praise,effect,'speaker',now+1,context).participation).toEqual({mode:'silent',reason:'no_addition'});
 expect(chooseSocial(state,praise,effect,'speaker',now+15000,context).participation).toEqual({mode:'speak'});
 expect(chooseSocial(state,praise,effect,'speaker',now+15000,{...context,appraisalFailed:true}).participation).toEqual({mode:'speak'});
});
