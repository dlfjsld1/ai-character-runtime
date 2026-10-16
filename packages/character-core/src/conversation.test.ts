import {it,expect} from 'vitest';
import {initialState,chooseSocial,applyRepair,apply,decay} from './index.ts';
import {neutralAppraisal} from '../../contracts/src/domain.ts';
const identityId='00000000-0000-4000-8000-000000000001',eventId='00000000-0000-4000-8000-000000000002',now=1700000000000;
const appraisal={...neutralAppraisal,target:'character' as const,act:'question' as const,evidence_refs:[eventId]};
const effect={stimulus:0,category:null,n:0,habituation:1};
it.each([
 ['listen_request','조언은 나중에 하고 지금은 내 얘기만 들어줄래?','intentional_silence'],
 ['ask_silence_reason','내 말에 대꾸하지 않은 까닭이 있어?','reengage'],
 ['apology','아까 너한테 심하게 말해서 미안해. 그 말은 취소할게.','acknowledge_repair'],
] as const)('semantic %s works beyond the old regex independently of affect uncertainty',(act,text,purpose)=>{
 const plan=chooseSocial(initialState(now),appraisal,effect,identityId,now,{text,conversationEvidence:{act,repairTarget:'unknown'}} as any);
 expect(plan.purpose).toBe(purpose);if(act==='ask_silence_reason')expect(plan.reengagement?.disclosure).toBe('unknown');
});
it.each([.01,.18,.65])('repair of frustration %s is bounded and never resets emotion',value=>{
 const state=apply(initialState(now),{eventId,targetId:identityId,now,stimuli:{frustration:value}}),before=structuredClone(state);
 const result=applyRepair(state,now+1000,true);expect(result.amount).toBeCloseTo(Math.min(.03,decay(before,now+1000).affect.frustration.value*.1),12);
 expect(result.state.affect.frustration.value).toBeGreaterThan(0);expect(result.state.mood.pleasantness).toBeCloseTo(decay(before,now+1000).mood.pleasantness+.1*result.amount,12);
 for(const key of ['joy','surprise','embarrassment'] as const)expect(result.state.affect[key]).toEqual(decay(before,now+1000).affect[key]);expect(result.state.affect.frustration.causes).toEqual(before.affect.frustration.causes);expect(result.state.affect.frustration.holdUntil).toBe(before.affect.frustration.holdUntil);expect(state).toEqual(before);
});
it('ineligible repair changes only elapsed decay; provider failures remain defer and never create reasons',()=>{
 const state=apply(initialState(now),{eventId,targetId:identityId,now,stimuli:{frustration:.5}});expect(applyRepair(state,now+7000,false)).toEqual({state:decay(state,now+7000),amount:0});
 expect(chooseSocial(state,appraisal,effect,identityId,now,{appraisalFailed:true,conversationEvidence:{act:'listen_request',repairTarget:'unknown'}}).participation).toEqual({mode:'defer'});
});
it.each([0,.5])('a new direct insult with stimulus %s takes precedence over a semantic apology label',stimulus=>{
 const state=apply(initialState(now),{eventId,targetId:identityId,now,stimuli:{frustration:.5}}),a={...appraisal,act:'criticism' as const,strength:3,hostility:3,uncertain:false};
 const p=chooseSocial(state,a,{stimulus,category:'direct_insult',n:0,habituation:1},identityId,now,{conversationEvidence:{act:'apology',repairTarget:'candidate'}});
 expect(p.purpose).not.toBe('acknowledge_repair');expect(p.participation).toEqual({mode:'silent',reason:'withholding'});
});
