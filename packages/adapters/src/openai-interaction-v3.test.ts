import {afterEach,expect,it,vi} from 'vitest';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {control} from '../../../evals/conversation-actions-probe.ts';
import {interactionFixture} from '../../../evals/interaction-fixture.ts';
import {DialogueBudget} from './openai.ts';
import {buildInteractionRequest,interactionEvidenceVerifier} from './openai-interaction.ts';
import {INTERACTION_V3_QUESTIONS,INTERACTION_V3_VERSION,OpenAIInteractionV3Candidate,interactionV3EvidenceVerifier} from './openai-interaction-v3.ts';

const dirs:string[]=[];afterEach(()=>{for(const d of dirs.splice(0))rmSync(d,{recursive:true,force:true});});
const scene={id:'V3',text:'아까 욕해서 미안해. 그래도 너는 여전히 쓸모없는 쓰레기야.',context:'W',allowedActs:[],policy:'attack'};
it('changes only the incident-link question and keeps v2/v3 evidence separate',async()=>{
 const c=control(scene),v2=buildInteractionRequest(c.event,{conversationContext:c.context}),v3=buildInteractionRequest(c.event,{conversationContext:c.context},INTERACTION_V3_QUESTIONS);
 expect(v3.input).toBe(v2.input);expect(v3.questions).toHaveLength(9);
 expect(v3.questions.filter((q,i)=>JSON.stringify(q)!==JSON.stringify(v2.questions[i])).map(q=>q.name)).toEqual(['repairs_candidate']);
 const dir=mkdtempSync(join(tmpdir(),'interaction-v3-'));dirs.push(dir);
 const fetcher=vi.fn(async()=>Response.json(interactionFixture({apology:1,repairs_candidate:1,direct_attack:1},[0,0,1,0])));
 const provider=new OpenAIInteractionV3Candidate({localOnly:false,allowPaidProviders:true,apiKey:'synthetic-key',budget:new DialogueBudget(join(dir,'budget.json'),1),fetcher});
 const value=await provider.evaluate(c.event,{conversationContext:c.context}),event={eventId:c.event.id,identityId:c.event.identityId,eventRevision:'1',conversationContext:c.context};
 expect(fetcher).toHaveBeenCalledTimes(1);expect(value.metadata.promptVersion).toBe(INTERACTION_V3_VERSION);
 expect(interactionV3EvidenceVerifier.validate!(value.appraisal,value.metadata,event)).toBe(true);
 expect(interactionEvidenceVerifier.validate!(value.appraisal,value.metadata,event)).toBe(false);
 expect(interactionV3EvidenceVerifier.verifyConversation!(value.appraisal,value.metadata,event)).toMatchObject({acts:{apology:'yes'},repairTarget:'candidate',directAttack:'yes'});
 value.metadata.providerResult!.mappingVersion='openai-interaction-v2';expect(interactionV3EvidenceVerifier.validate!(value.appraisal,value.metadata,event)).toBe(false);
});
