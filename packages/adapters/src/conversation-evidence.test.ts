import {it,expect,vi} from 'vitest';
import {randomUUID} from 'node:crypto';
import {JevConversationCandidate,mapJevConversationResponse,conversationContextHash,JEV_CONVERSATION_VERSION,JEV_QUESTIONS} from './jev.ts';
import {jevEvidenceVerifier} from './appraisal-evidence.ts';
import {recordedJevResponse} from '../../../evals/jev-fixture.ts';
import type {ConversationContext} from '../../contracts/src/conversation.ts';
const id=randomUUID(),identityId=randomUUID(),sessionId=randomUUID();
const context:ConversationContext={version:1,sessionId,identityId,asOf:1700000000000,history:{version:1,sessionId,identityId,cutoffEventId:id,truncated:false,turns:[]},silence:null,repairCandidate:null};
const choice=(value:string,keys:string[],confidence=.95)=>({type:'choice',choice:value,confidence,probabilities:Object.fromEntries(keys.map(k=>[k,k===value?1:0]))});
export function conversationFixture(act='listen_request',target='unknown'){
 return {...recordedJevResponse(),answers:{...recordedJevResponse().answers,conversation_act:choice(act,['ordinary','ask_silence_reason','listen_request','apology','clarify_target','unknown']),repair_target:choice(target,['candidate','other','unknown'])}};
}
function evaluated(raw=conversationFixture()){
 const value=mapJevConversationResponse(raw,id);value.metadata.providerResult={version:4,provider:'jev',mappingVersion:JEV_CONVERSATION_VERSION,eventId:id,identityId,eventRevision:'1',contextHash:conversationContextHash(context),payload:value.metadata.providerResult} as any;return value;
}
const binding={eventId:id,identityId,eventRevision:'1',conversationContext:context};
it('conversation confidence is independent of old appraisal uncertainty and repair confidence',()=>{
 const raw=conversationFixture('ask_silence_reason');raw.answers.strength.confidence=.2;raw.answers.repair_target.confidence=.2;const value=evaluated(raw);expect(value.appraisal.uncertain).toBe(true);expect(jevEvidenceVerifier.verifyConversation!(value.appraisal,value.metadata,binding)).toEqual({act:'ask_silence_reason',repairTarget:'unknown'});
});
it.each(['target','conversation_act'])('low %s confidence grants no semantic authority',key=>{
 const raw=conversationFixture();(raw.answers as any)[key].confidence=.79;const value=evaluated(raw);expect(jevEvidenceVerifier.verifyConversation!(value.appraisal,value.metadata,binding)).toBeUndefined();
});
it('ties, wrong choice, missing keys, and context/identity/revision tampering are rejected',()=>{
 const raw=conversationFixture();raw.answers.conversation_act.probabilities={ordinary:.5,ask_silence_reason:0,listen_request:.5,apology:0,clarify_target:0,unknown:0};const tied=evaluated(raw);expect(jevEvidenceVerifier.verifyConversation!(tied.appraisal,tied.metadata,binding)).toBeUndefined();
 const bad=conversationFixture();bad.answers.conversation_act.choice='apology';expect(()=>mapJevConversationResponse(bad,id)).toThrow('jev_invalid_output');delete (bad.answers as any).repair_target;expect(()=>mapJevConversationResponse(bad,id)).toThrow('jev_invalid_output');
 const value=evaluated();for(const patch of [{eventRevision:'2'},{identityId:randomUUID()},{eventId:randomUUID()},{conversationContext:{...context,asOf:context.asOf+1}}])expect(jevEvidenceVerifier.verifyConversation!(value.appraisal,value.metadata,{...binding,...patch})).toBeUndefined();
});
it('seven questions preserve the five old rubrics; only bounded public text leaves the adapter',async()=>{
 const requests:any[]=[];const fetcher=vi.fn(async(_url:any,init:any)=>{requests.push(JSON.parse(init.body));return Response.json(conversationFixture());});const provider=new JevConversationCandidate({localOnly:false,allowPaidProviders:true,apiKey:'unit-key'},fetcher);
 const result=await provider.evaluate({id,identityId,revision:'1',text:'조언은 나중에 하고 내 얘기만 들어줄래?'},{conversation:context.history,conversationContext:context,privateKey:'must-not-send'});
 expect(Object.keys(requests[0].questions)).toHaveLength(7);for(const [key,value] of Object.entries(JEV_QUESTIONS))expect(requests[0].questions[key]).toEqual(value);
 expect(JSON.stringify(requests)).not.toMatch(new RegExp(id+'|'+identityId+'|'+sessionId+'|must-not-send'));expect(result.metadata.providerResult).toMatchObject({version:4,contextHash:conversationContextHash(context)});
 expect(jevEvidenceVerifier.verifyConversation!(result.appraisal,result.metadata,binding)).toMatchObject({act:'listen_request'});
});
it('additional candidate text cannot push public state over the original byte limit',async()=>{
 const fetcher=vi.fn();const provider=new JevConversationCandidate({localOnly:false,allowPaidProviders:true,apiKey:'unit-key'},fetcher);
 const large={...context,repairCandidate:{eventId:randomUUID(),revision:'1',identityId,sessionId,at:context.asOf-1,text:'가'.repeat(1000),used:false}};
 await expect(provider.evaluate({id,identityId,revision:'1',text:'가'.repeat(800)},{activity:{prompt:'x'.repeat(12000),status:'solving'},conversation:context.history,conversationContext:large})).rejects.toThrow('jev_input_too_large');expect(fetcher.mock.calls).toHaveLength(0);
});
