import {it,expect,vi,afterEach} from 'vitest';
import {mkdtempSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {OpenAIInteractionCandidate,interactionEvidenceVerifier as verifier,mapInteractionResponse,buildInteractionRequest,intensityLowerBound,INTERACTION_VERSION} from './openai-interaction.ts';
import {DialogueBudget} from './openai.ts';
import {interactionFixture,boundInteraction} from '../../../evals/interaction-fixture.ts';
import {control} from '../../../evals/conversation-actions-probe.ts';
const dirs:string[]=[];afterEach(()=>{for(const d of dirs.splice(0))rmSync(d,{recursive:true,force:true});});
const scene={id:'V2',text:'아까 그 말은 네가 아니라 영화 속 인물 얘기였어. 오해하게 해서 미안해.',context:'W',allowedActs:[],policy:'repair'};
const bind=(c:ReturnType<typeof control>)=>({eventId:c.event.id,identityId:c.event.identityId,eventRevision:'1',conversationContext:c.context});
it('one request binds independent apology and clarification facts without intensity authority',async()=>{
 const c=control(scene),dir=mkdtempSync(join(tmpdir(),'interaction-'));dirs.push(dir);const path=join(dir,'budget.json'),fetcher=vi.fn(async()=>Response.json(interactionFixture({apology:1,clarify_target:1,repairs_candidate:1}))),provider=new OpenAIInteractionCandidate({localOnly:false,allowPaidProviders:true,apiKey:'synthetic-key',budget:new DialogueBudget(path,1),fetcher});
 const v=await provider.evaluate(c.event,{conversationContext:c.context});expect(provider.promptVersion).toBe(INTERACTION_VERSION);expect(fetcher).toHaveBeenCalledTimes(1);
 expect(verifier.verifyConversation!(v.appraisal,v.metadata,bind(c))).toMatchObject({acts:{apology:'yes',clarify_target:'yes'},repairTarget:'candidate'});expect(verifier.verifyAffect!(v.appraisal,v.metadata,bind(c))).toBeUndefined();expect(v.appraisal.uncertain).toBe(true);
 expect(JSON.parse(readFileSync(path,'utf8')).entries[0]).toMatchObject({kind:'decision',status:'completed',usd:.00001});
});
it('outer recipient is fixed routing context; history and quoted current speech stay separate',()=>{
 const c=control(scene);c.event.text='민수가 친구에게 "왜 말 안 해?"라고 했대.';
 const body=buildInteractionRequest(c.event,{conversationContext:c.context}),input=JSON.parse(body.input);
 expect(body.questions).toHaveLength(9);expect(body.questions.some(q=>q.name==='addressee'||q.name==='conversation_act')).toBe(false);
 expect(input.current).toEqual({speaker:'user',recipient:'character',text:c.event.text});expect(input.priorIncident.text).toBe(c.context.repairCandidate!.text);
 expect(body.input.includes(c.event.id)||body.input.includes(c.event.identityId)||body.input.includes('used')).toBe(false);
 expect(()=>buildInteractionRequest({...c.event,revision:undefined},{conversationContext:c.context})).toThrow('interaction_invalid_context');
});
it('intensity tail lower bound does not use fine-level confidence as a global veto',()=>{
 const c=control(scene),raw=interactionFixture({direct_attack:1},[0,0,.45,.55],.53),v=boundInteraction(raw,c.event.id,c.context);
 expect(intensityLowerBound(raw)).toBe(2);expect(verifier.verifyAffect!(v.appraisal,v.metadata,bind(c))).toEqual({kind:'direct_insult',strength:2});
 const ambiguous=boundInteraction(interactionFixture({direct_attack:1},[.5,0,0,.5]),c.event.id,c.context);
 expect(verifier.verifyAffect!(ambiguous.appraisal,ambiguous.metadata,bind(c))).toBeUndefined();expect(verifier.verifyConversation!(ambiguous.appraisal,ambiguous.metadata,bind(c))).toMatchObject({directAttack:'yes'});
});
it.each([0,.05,.051,.949,.95,1])('predicate boundary %s remains independent of other facts',probability=>{
 const c=control(scene),v=boundInteraction(interactionFixture({apology:probability,clarify_target:1,direct_praise:.6}),c.event.id,c.context);
 expect(verifier.verifyConversation!(v.appraisal,v.metadata,bind(c))).toMatchObject({acts:{apology:probability>=.95?'yes':probability<=.05?'no':'unknown',clarify_target:'yes'},directPraise:'unknown'});
});
it.each(['source','revision','hash','appraisal','usage','provider','model','version','failure'])('invalid %s rejects the entire authority without interpreting silence',kind=>{
 const c=control(scene),v=boundInteraction(interactionFixture({direct_attack:1},[0,0,1,0]),c.event.id,c.context),e=bind(c);
 if(kind==='source')e.identityId='00000000-0000-4000-8000-000000000001';if(kind==='revision')e.eventRevision='2';if(kind==='hash')e.conversationContext={...c.context,asOf:c.context.asOf+1};if(kind==='appraisal')v.appraisal.uncertain=false;if(kind==='usage')v.metadata.usage!.input_tokens++;if(kind==='provider')v.metadata.provider='jev';if(kind==='model')v.metadata.model='different';if(kind==='version')v.metadata.promptVersion='openai-conversation-v1';if(kind==='failure')v.metadata.failureCode='synthetic_failure';
 expect(verifier.validate!(v.appraisal,v.metadata,e)).toBe(false);expect(verifier.verifyConversation!(v.appraisal,v.metadata,e)).toBeUndefined();expect(verifier.verifyAffect!(v.appraisal,v.metadata,e)).toBeUndefined();
});
it.each(['duplicate','missing','mismatch','bad-score','bad-label','bad-sum','bad-predicate','refusal','wrong-model'])('rejects malformed %s response',kind=>{
 const raw:any=interactionFixture();
 if(kind==='duplicate')raw.answers[1]=raw.answers[0];if(kind==='missing')raw.answers.pop();if(kind==='mismatch')raw.answers[0].choice='question';if(kind==='bad-score')raw.answers[8].score=2;if(kind==='bad-label')raw.answers[8].probabilities[0].label='invented';if(kind==='bad-sum')raw.answers[0].probabilities[2].probability=.8;if(kind==='bad-predicate')raw.answers[1].probability=1.1;if(kind==='refusal')raw.answers[1]={name:'ask_silence_reason',type:'refusal'};if(kind==='wrong-model')raw.model='other';
 expect(()=>mapInteractionResponse(raw,control(scene).event.id)).toThrow('interaction_invalid_output');
});
