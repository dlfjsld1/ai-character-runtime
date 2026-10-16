import {it,expect} from 'vitest';
import type {DialogueGenerator,AppraisalProvider,ActivitySolver} from './ai-ports.ts';
import {neutralAppraisal} from './domain.ts';

it('a dialogue implementation needs neither appraisal nor activity solving',async()=>{
 const dialogue:DialogueGenerator={name:'test-dialogue',model:'synthetic',counter:{count:async()=>1,countText:async()=>1},fitConversation:async(_plan,context)=>({conversation:context.conversation,inputTokens:1}),dialogue:async(plan,context)=>[`${context.currentInput?.payload?.text} ${plan.delivery}`]};
 expect('solve' in dialogue).toBe(false);expect('appraise' in dialogue).toBe(false);
 expect(await dialogue.dialogue({action:'answer',purpose:'question',targetIdentityId:null,expression:'neutral',maxSentences:1,delivery:'calm',memoryIds:[]},{currentInput:{payload:{text:'합성 질문'}}})).toEqual(['합성 질문 calm']);
 const appraisal:AppraisalProvider={name:'test-appraisal',model:'synthetic',promptVersion:'test',readiness:()=>({status:'configured',inferenceVerified:false,errorCode:null}),evaluate:async()=>({appraisal:neutralAppraisal,metadata:{provider:'test-appraisal',model:'synthetic'}})};
 const solver:ActivitySolver={solve:async id=>({activity_id:id,candidate_answer:null,needs_hint:true})};
 expect('dialogue' in appraisal).toBe(false);expect('dialogue' in solver).toBe(false);
});
