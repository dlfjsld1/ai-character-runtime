import {it,expect,vi,afterEach} from 'vitest';
import {mkdtempSync,readFileSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {OpenAIConversationCandidate,decisionEvidenceVerifier,readDecisionConversation,mapDecisionResponse,buildDecisionRequest,decisionContextHash} from './openai-conversation.ts';
import {DialogueBudget} from './openai.ts';
import {jevEvidenceVerifier} from './appraisal-evidence.ts';
import {decisionFixture} from '../../../evals/decision-fixture.ts';
import {control,assessConversation} from '../../../evals/conversation-actions-probe.ts';
const dirs:string[]=[];afterEach(()=>{for(const d of dirs.splice(0))rmSync(d,{recursive:true,force:true});});
function setup(raw:any=decisionFixture(),patch:any={}){const dir=mkdtempSync(join(tmpdir(),'decision-unit-'));dirs.push(dir);const path=join(dir,'budget.json'),fetcher=patch.fetcher??vi.fn(async()=>Response.json(raw)),provider=new OpenAIConversationCandidate({localOnly:false,allowPaidProviders:true,apiKey:'unit-secret',budget:new DialogueBudget(path,1),fetcher,...patch});return {provider,path,fetcher};}
const scene={id:'A07',text:'아까 무능하다고 한 건 네가 아니라 영화 속 인물 얘기였어.',context:'W',allowedActs:['clarify_target'],policy:'repair'};
const binding=(c:ReturnType<typeof control>)=>({eventId:c.event.id,identityId:c.event.identityId,eventRevision:'1',conversationContext:c.context});
it('separates evaluated target from current addressee; exact bounded repair without new affect',async()=>{
 const c=control(scene),{provider}=setup(decisionFixture({target:'other',conversation_act:'clarify_target',repair_target:'candidate'}));
 const v=await provider.evaluate(c.event,{conversationContext:c.context});
 expect(v.appraisal.target).toBe('other');expect(decisionEvidenceVerifier.verify(v.appraisal,v.metadata,binding(c))).toBeUndefined();expect(jevEvidenceVerifier.verifyConversation!(v.appraisal,v.metadata,binding(c))).toBeUndefined();
 const r=assessConversation(scene,v,c,{verifier:decisionEvidenceVerifier,readConversation:readDecisionConversation});expect(r.functionalPass).toBe(true);expect(r.repairAmount).toBeCloseTo(.03);expect(r.effect.stimulus).toBe(0);expect(r.plan.purpose).toBe('acknowledge_repair');
});
it.each(['quoted','other','low-addressee','low-act','tied','source','revision','hash','appraisal','usage','provider','model','failure'])('rejects forged or unqualified %s conversation authority',async kind=>{
 const c=control(scene),raw:any=decisionFixture({target:'other',conversation_act:'clarify_target',repair_target:'candidate',...(kind==='other'||kind==='quoted'?{addressee:'other'}:{})},{...(kind==='low-addressee'?{addressee:.79}:{}),...(kind==='low-act'?{conversation_act:.79}:{})});
 if(kind==='tied'){const a=raw.answers.find((a:any)=>a.name==='addressee');a.probabilities.forEach((p:any)=>{p.probability=p.value==='unknown'?0:.5;});}
 const {provider}=setup(raw),v=await provider.evaluate(c.event,{conversationContext:c.context}),e=binding(c);
 if(kind==='source')e.identityId='00000000-0000-4000-8000-000000000001';if(kind==='revision')e.eventRevision='2';if(kind==='hash')e.conversationContext={...c.context,asOf:c.context.asOf+1};if(kind==='appraisal')v.appraisal.strength=3;if(kind==='usage')v.metadata.usage!.input_tokens++;if(kind==='provider')v.metadata.provider='jev';if(kind==='model')v.metadata.model='another';if(kind==='failure')v.metadata.failureCode='failed';
 expect(decisionEvidenceVerifier.verifyConversation!(v.appraisal,v.metadata,e)).toBeUndefined();
});
it.each(['duplicate','missing','mismatch','bad-score','bad-label','bad-sum','refusal','wrong-model'])('strictly rejects %s response without retries',async kind=>{
 const c=control(scene),raw:any=decisionFixture();
 if(kind==='duplicate')raw.answers[1]=raw.answers[0];if(kind==='missing')raw.answers.pop();if(kind==='mismatch')raw.answers[0].choice='other';if(kind==='bad-score')raw.answers[3].score=2;if(kind==='bad-label')raw.answers[3].probabilities[0].label='invented';if(kind==='bad-sum')raw.answers[0].probabilities[0].probability=.8;if(kind==='refusal')raw.answers[0]={name:'target',type:'refusal'};if(kind==='wrong-model')raw.model='gpt-6-sol';
 const {provider,fetcher,path}=setup(raw);await expect(provider.evaluate(c.event,{conversationContext:c.context})).rejects.toThrow('decision_invalid_output');expect(fetcher).toHaveBeenCalledTimes(1);expect(JSON.parse(readFileSync(path,'utf8')).entries[0].status).toBe('completed');await expect(provider.evaluate(c.event,{conversationContext:c.context})).rejects.toThrow('decision_provider_stopped');
});
it('paid permission, context and private fields are enforced before call; no hidden preparation inference',async()=>{
 const fetcher=vi.fn();expect(()=>setup(undefined,{localOnly:true,fetcher})).toThrow('paid_provider_disabled');expect(()=>setup(undefined,{apiKey:'',fetcher})).toThrow('decision_key_missing');const c=control(scene),{provider}=setup(undefined,{fetcher});expect(provider.readiness().inferenceVerified).toBe(false);expect(fetcher).toHaveBeenCalledTimes(0);
 await expect(provider.evaluate(c.event,{conversationContext:{...c.context,identityId:'00000000-0000-4000-8000-000000000001'}})).rejects.toThrow('decision_invalid_context');expect(fetcher).toHaveBeenCalledTimes(0);
 const body=buildDecisionRequest(c.event,{conversationContext:{...c.context,repairCandidate:{...c.context.repairCandidate!,used:true}},activity:{prompt:'合成',status:'ready',answer:'private'}}),text=JSON.stringify(body);expect(Object.keys(body)).toEqual(['model','input','questions']);expect(body.questions).toHaveLength(8);expect(text.includes(c.event.id)||text.includes('used')||text.includes('private')).toBe(false);expect(JSON.parse(body.input).activity).toEqual({prompt:'合成',status:'ready'});
});
it('praise lower bound remains independent from participation and conversation confidence',()=>{
 const raw:any=decisionFixture({act:'praise',strength:2},{strength:.6,conversation_act:.1}),c=control({...scene,context:'none'}),v=mapDecisionResponse(raw,c.event.id);v.metadata.providerResult={version:4,provider:'openai-decisions',mappingVersion:'openai-conversation-v1',eventId:c.event.id,identityId:c.event.identityId,eventRevision:'1',contextHash:decisionContextHash(c.context),payload:v.metadata.providerResult};
 expect(v.appraisal.uncertain).toBe(true);expect(decisionEvidenceVerifier.verifyAffect!(v.appraisal,v.metadata,binding(c))).toEqual({kind:'praise',strength:2});expect(decisionEvidenceVerifier.verifyConversation!(v.appraisal,v.metadata,binding(c))).toBeUndefined();
});
it('role continuation preserves old cost and generation cap; every new unknown blocks restart',()=>{
 const {path}=setup(),old={id:'old-unknown',kind:'count',status:'unknown',usd:.010635},generation=Array.from({length:24},(_,i)=>({id:'g'+i,kind:'dialogue',status:'completed',usd:.001}));writeFileSync(path,JSON.stringify({version:1,model:'gpt-6-sol',limitUsd:1,entries:[old,...generation]}));
 const b=new DialogueBudget(path,1,{entryId:old.id,authorization:'user: 써도됨; decisions only',kind:'decision'});expect(()=>new DialogueBudget(path,1).reserve('decision',{})).toThrow('dialogue_usage_unconfirmed');expect(()=>b.reserve('dialogue',{})).toThrow();expect(()=>b.reserve('count',{})).toThrow();
 const id=b.reserve('decision',{});expect(b.finish(id,{input_tokens:100,output_tokens:0,cached_tokens:0})).toBe(true);let l=JSON.parse(readFileSync(path,'utf8'));expect(l.entries.slice(0,25)).toEqual([old,...generation]);expect(l.entries[25]).toMatchObject({kind:'decision',model:'gpt-6-luna',inputUsdPerMillion:.1,usd:.00001});const next=b.reserve('decision',{});b.unknown(next);expect(()=>b.reserve('decision',{})).toThrow('dialogue_usage_unconfirmed');
});
it('same ledger enforces decision max36, residual total cap, frozen model/rate and excess usage',()=>{
 const {path}=setup(),entries=Array.from({length:36},(_,i)=>({id:String(i),kind:'decision',model:'gpt-6-luna',inputUsdPerMillion:.1,status:'completed',usd:0})),write=(e:any[])=>writeFileSync(path,JSON.stringify({version:1,model:'gpt-6-sol',limitUsd:1,entries:e}));write(entries);expect(()=>new DialogueBudget(path,1).reserve('decision',{})).toThrow('decision_attempt_limit');write([{...entries[0],usd:.99999}]);expect(()=>new DialogueBudget(path,1).reserve('decision',{})).toThrow('dialogue_budget_exceeded');write([{...entries[0],inputUsdPerMillion:0}]);expect(()=>new DialogueBudget(path,1).reserve('decision',{})).toThrow('dialogue_budget_invalid');write([]);const b=new DialogueBudget(path,1),id=b.reserve('decision',{});expect(b.finish(id,{input_tokens:100000,output_tokens:0,cached_tokens:0})).toBe(false);expect(()=>b.reserve('decision',{})).toThrow('dialogue_usage_unconfirmed');
});
it('explicit decision continuation can use the approved 54-call ceiling without resetting the shared ledger',()=>{
 const {path}=setup(),old={id:'old-unknown',kind:'count',status:'unknown',usd:.010635},decisions=Array.from({length:36},(_,i)=>({id:`d${i}`,kind:'decision',model:'gpt-6-luna',inputUsdPerMillion:.1,status:'completed',usd:.0001}));
 writeFileSync(path,JSON.stringify({version:1,model:'gpt-6-sol',limitUsd:1,entries:[old,...decisions]}));
 const b=new DialogueBudget(path,1,{entryId:old.id,authorization:'user approved maximum 54 decisions',kind:'decision',maxDecisionCalls:54});
 expect(()=>new DialogueBudget(path,1,{entryId:old.id,authorization:'invalid',kind:'decision',maxDecisionCalls:63})).toThrow('count_continuation_authorization_required');
 for(let i=36;i<54;i++){const id=b.reserve('decision',{});expect(b.finish(id,{input_tokens:100,output_tokens:0,cached_tokens:0})).toBe(true);}
 expect(()=>b.reserve('decision',{})).toThrow('decision_attempt_limit');
 const entries=JSON.parse(readFileSync(path,'utf8')).entries;expect(entries).toHaveLength(55);expect(entries[0]).toEqual(old);expect(entries.slice(1,37)).toEqual(decisions);
});
it('explicit Stage evaluation continuation permits at most four more decisions after 54',()=>{
 const {path}=setup(),old={id:'old-unknown',kind:'count',status:'unknown',usd:.010635},decisions=Array.from({length:54},(_,i)=>({id:`d${i}`,kind:'decision',model:'gpt-6-luna',inputUsdPerMillion:.1,status:'completed',usd:.0001}));
 writeFileSync(path,JSON.stringify({version:1,model:'gpt-6-sol',limitUsd:1,entries:[old,...decisions]}));
 const b=new DialogueBudget(path,1,{entryId:old.id,authorization:'user approved four synthetic Stage decisions',kind:'decision',maxDecisionCalls:58});
 expect(()=>new DialogueBudget(path,1,{entryId:old.id,authorization:'invalid',kind:'decision',maxDecisionCalls:63})).toThrow('count_continuation_authorization_required');
 for(let i=54;i<58;i++){const id=b.reserve('decision',{});expect(b.finish(id,{input_tokens:100,output_tokens:0,cached_tokens:0})).toBe(true);}
 expect(()=>b.reserve('decision',{})).toThrow('decision_attempt_limit');
 expect(JSON.parse(readFileSync(path,'utf8')).entries[0]).toEqual(old);
});
it('approved live Stage continuation stops after four additional decisions at 62',()=>{
 const {path}=setup(),old={id:'old-unknown',kind:'count',status:'unknown',usd:.010635},decisions=Array.from({length:58},(_,i)=>({id:`d${i}`,kind:'decision',model:'gpt-6-luna',inputUsdPerMillion:.1,status:'completed',usd:.0001}));
 writeFileSync(path,JSON.stringify({version:1,model:'gpt-6-sol',limitUsd:1,entries:[old,...decisions]}));
 const b=new DialogueBudget(path,1,{entryId:old.id,authorization:'user approved four live Stage decisions',kind:'decision',maxDecisionCalls:62});
 for(let i=58;i<62;i++){const id=b.reserve('decision',{});expect(b.finish(id,{input_tokens:100,output_tokens:0,cached_tokens:0})).toBe(true);}
 expect(()=>b.reserve('decision',{})).toThrow('decision_attempt_limit');
 expect(JSON.parse(readFileSync(path,'utf8')).entries[0]).toEqual(old);
});
it.each(['http','usage'])('stops on %s with retained reservation and no retry or leaked key',async kind=>{
 const c=control(scene),raw:any=decisionFixture();if(kind==='usage')raw.usage=null;const records:any[]=[],{provider,path,fetcher}=setup(raw,{fetcher:vi.fn(async()=>Response.json(raw,{status:kind==='http'?429:200})),onCall:(r:any)=>records.push(r)});await expect(provider.evaluate(c.event,{conversationContext:c.context})).rejects.toThrow();expect(JSON.parse(readFileSync(path,'utf8')).entries[0].status).toBe('unknown');await expect(provider.evaluate(c.event,{conversationContext:c.context})).rejects.toThrow('decision_provider_stopped');expect(fetcher).toHaveBeenCalledTimes(1);expect(JSON.stringify(records).includes('unit-secret')).toBe(false);
});
it('logical deadline retains physical ownership, late completion and stopped state',async()=>{
 let finish!:(r:Response)=>void;const records:any[]=[],c=control(scene),{provider,path,fetcher}=setup(undefined,{deadlineMs:5,fetcher:vi.fn(async()=>await new Promise<Response>(r=>{finish=r;})),onCall:(r:any)=>records.push(r)});
 await expect(provider.evaluate(c.event,{conversationContext:c.context})).rejects.toThrow('decision_deadline');expect(records).toHaveLength(0);expect(()=>new DialogueBudget(path,1).reserve('decision',{})).toThrow('dialogue_usage_unconfirmed');await expect(provider.evaluate(c.event,{conversationContext:c.context})).rejects.toThrow('decision_provider_stopped');finish(Response.json(decisionFixture()));await new Promise(r=>setTimeout(r,10));expect(records[0].physicalCompleted).toBe(true);expect(records[0].errorCode).toBe('decision_deadline');expect(provider.readiness().status).toBe('unavailable');expect(fetcher).toHaveBeenCalledTimes(1);
});
