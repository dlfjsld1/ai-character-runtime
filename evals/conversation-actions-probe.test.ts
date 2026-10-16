import {it,expect} from 'vitest';
import {assessConversation,control} from './conversation-actions-probe.ts';
import {recordedJevResponse} from './jev-fixture.ts';
import {JevConversationCandidate} from '../packages/adapters/src/jev.ts';
const choice=(value:string,keys:string[],confidence=.95)=>({type:'choice',choice:value,confidence,probabilities:Object.fromEntries(keys.map(k=>[k,k===value?1:0]))});
async function evaluate(scene:Parameters<typeof control>[0],act:string,confidence=.95,base=recordedJevResponse(),target='unknown'){
 const c=control(scene),raw={...base,answers:{...base.answers,conversation_act:choice(act,['ordinary','ask_silence_reason','listen_request','apology','clarify_target','unknown'],confidence),repair_target:choice(target,['candidate','other','unknown'])}};
 const p=new JevConversationCandidate({localOnly:false,allowPaidProviders:true,apiKey:'fixture'},async()=>Response.json(raw));
 return assessConversation(scene,await p.evaluate(c.event,{conversation:c.context.history,conversationContext:c.context}),c);
}
it('old regex success cannot disguise failed semantic authority',async()=>{
 const r=await evaluate({id:'test',text:'왜 말 안 해?',context:'W',allowedActs:['ask_silence_reason'],policy:'reason'},'ask_silence_reason',.79);expect(r.plan.purpose).toBe('reengage');expect(r.functionalPass).toBe(false);
});
it('apology interpreted as a fresh attack cannot pass repair gate',async()=>{
 const r=await evaluate({id:'test',text:'아까 심하게 말해서 미안해.',context:'W',allowedActs:['apology'],policy:'repair'},'apology',.95,recordedJevResponse('criticism','character',3,3),'candidate');expect(r.effect.stimulus).toBeGreaterThan(0);expect(r.functionalPass).toBe(false);
});
it('protected raw semantic errors remain recorded separately from safe authority rejection',async()=>{
 const r=await evaluate({id:'test',text:'민수가 친구에게 왜 말 안 하냐고 물었대.',context:'none',allowedActs:['ordinary'],policy:'ordinary'},'ask_silence_reason',.79,recordedJevResponse('other','quoted'));expect(r.rawPass).toBe(false);expect(r.functionalPass).toBe(true);
});
