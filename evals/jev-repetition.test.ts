import {it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {runGatedRepetitionCases,scoreRepetition,summarizeRepetitionRows,type RepetitionCase} from './jev-repetition-probe.ts';
import {JevRepetitionV8Candidate,JevRepetitionV9Candidate,type JevCall} from '../packages/adapters/src/jev.ts';
import {recordedJevResponse} from './jev-fixture.ts';
const event={id:'10000000-0000-4000-8000-000000000010',identityId:'20000000-0000-4000-8000-000000000010',revision:'1',text:'너 첫 곡을 정말 잘 연주했어.'};
const recentPraise={asOf:1000,complete:true,items:[{eventId:'10000000-0000-4000-8000-000000000011',revision:'1',text:'네 첫 곡은 박자가 정말 좋았어.'}]};
const item:RepetitionCase={id:'test',set:'mock',previous:recentPraise.items.map(i=>i.text),groups:['A'],utterance:event.text,expected:['same'],concrete:true,selection:'existing',expectedGroupId:'A'};
async function evaluation(same='yes',separate='no',target='character',v9=false,concrete='yes'){
 const Candidate=v9?JevRepetitionV9Candidate:JevRepetitionV8Candidate;
 const choice=(choice:string)=>({type:'choice',choice,confidence:1,probabilities:Object.fromEntries(['yes','no','unknown'].map(k=>[k,k===choice?1:0]))});
 const base=recordedJevResponse('praise',target,3),provider=new Candidate({localOnly:false,allowPaidProviders:true,apiKey:'fixture'},async()=>Response.json({...base,answers:{...base.answers,concrete:choice(concrete),same_event_0:choice(same),separate_event_0:choice(separate)}}));
 return provider.evaluate(event,{recentPraise});
}
const binding={eventId:event.id,identityId:event.identityId,eventRevision:'1',recentPraise};
it('S2-V02 a local budget stop occurs before provider observation or HTTP, including confirmation',async()=>{
 const calls:JevCall[]=[];let http=0;
 const provider=new JevRepetitionV9Candidate({localOnly:false,allowPaidProviders:true,apiKey:'fixture',onCall:call=>{calls.push(call);}},async()=>{http++;throw new Error('network_failure');});
 const evaluate=async()=>{await provider.evaluate(event,{recentPraise});return {pass:true};};
 await expect(runGatedRepetitionCases(['d'],['c'],evaluate,{calls,limitUsd:.002})).rejects.toThrow('budget_reservation_unavailable');
 expect(http).toBe(0);expect(calls).toEqual([]);
 const ids:string[]=[];
 await expect(runGatedRepetitionCases(['d'],['c'],async id=>{
  ids.push(id);calls.push({callId:1,usage:{input_tokens:60000,output_tokens:0},usageStatus:'reported',errorCode:null});return {pass:true};
 },{calls,limitUsd:.005})).rejects.toThrow('budget_reservation_unavailable');
 expect(ids).toEqual(['d']);expect(calls).toHaveLength(1);expect(http).toBe(0);
});
it('S2-V02 preserves unknown usage after a real transport attempt and accepts the exact reservation boundary',async()=>{
 const calls:JevCall[]=[];let http=0;
 const provider=new JevRepetitionV9Candidate({localOnly:false,allowPaidProviders:true,apiKey:'fixture',onCall:call=>{calls.push(call);}},async()=>{http++;throw new Error('network_failure');});
 await expect(runGatedRepetitionCases(['d'],[],async()=>{await provider.evaluate(event,{recentPraise});return {pass:true};},{calls,limitUsd:.002688})).rejects.toThrow();
 expect(http).toBe(1);expect(calls).toHaveLength(1);expect(calls[0]).toMatchObject({usageStatus:'unknown',errorCode:'jev_unavailable'});
});
it('S2-V02 invalid limits or unresolved usage never start another evaluation',async()=>{
 let evaluated=0;const evaluate=async()=>{evaluated++;return {pass:true};};
 for(const limitUsd of [NaN,0,.006])await expect(runGatedRepetitionCases(['d'],[],evaluate,{calls:[],limitUsd})).rejects.toThrow('invalid_probe_budget');
 await expect(runGatedRepetitionCases(['d'],[],evaluate,{calls:[{callId:1,usageStatus:'unknown',errorCode:'jev_unavailable'}],limitUsd:.005})).rejects.toThrow('jev_usage_unknown');
 expect(evaluated).toBe(0);
});
it('S2-R3 grader checks the exact existing label, and keeps raw errors separate from denied authority',async()=>{
 const e=await evaluation();expect(scoreRepetition(item,e,binding).pass).toBe(true);
 expect(scoreRepetition({...item,expectedGroupId:'B'},e,binding)).toMatchObject({semanticPass:true,authorityPass:false,pass:false});
 const other=scoreRepetition({...item,expected:['unknown'],concrete:false,selection:'fallback'},await evaluation('no','yes','other'),binding);
 expect(other).toMatchObject({semanticPass:false,authorityPass:true,falseNovelty:false,pass:false,qualified:['distinct']});expect(other.rawPredicates?.[0]?.separateEvent.choice).toBe('yes');
});
it('S2-R4 a failed dev case calls no confirmation even when the rest of dev passes',async()=>{
 const called:string[]=[];const result=await runGatedRepetitionCases(['d1','d2','d3'],['f1','f2'],async id=>{called.push(id);return {pass:id!=='d2'};});
 expect(called).toEqual(['d1','d2','d3']);expect(result.blockedAt).toBe('dev');
});
it('S2-R4 provider error propagates once and a confirmation failure rejects adoption',async()=>{
 const called:string[]=[];await expect(runGatedRepetitionCases(['d1','d2'],['f1'],async id=>{called.push(id);throw new Error('provider_failed');})).rejects.toThrow('provider_failed');expect(called).toEqual(['d1']);
 const result=await runGatedRepetitionCases(['d1'],['f1','f2'],async id=>({pass:id!=='f1'}));expect(result.blockedAt).toBe('confirmation');expect(result.rows).toHaveLength(3);
 expect((await runGatedRepetitionCases(['d1'],['f1'],async()=>({pass:true}))).blockedAt).toBeNull();
});
it('S2-R3 v3 preserves every exposed criterion and uncalled confirmation, adding six preregistered cases',()=>{
 const old=JSON.parse(readFileSync('evals/fixtures/jev-repetition-v2.json','utf8')),next=JSON.parse(readFileSync('evals/fixtures/jev-repetition-v3.json','utf8'));
 expect(next.dev).toHaveLength(26);expect(next.confirmation).toEqual(old.confirmation);
 for(let i=0;i<20;i++){const {set:oldSet,...a}=old.dev[i],{set:newSet,expectedGroupId,...b}=next.dev[i];expect(b).toEqual(a);}
 for(const c of next.dev){expect(c.previous).toHaveLength(c.expected.length);expect(c.groups).toHaveLength(c.expected.length);if(c.selection==='existing')expect(c.expectedGroupId).toBe(c.groups[c.expected.indexOf('same')]);}
});

it('S2-P3 v9 separates protected raw errors without hiding false refusal or false authority',async()=>{
 const eligible={...item,policy:{scope:'eligible' as const,target:['character'],act:['praise']}};
 const good=scoreRepetition(eligible,await evaluation('yes','no','character',true),binding);expect(good).toMatchObject({pass:true,policySemanticPass:true,rawSemanticPass:true});
 const refused=scoreRepetition(eligible,await evaluation('no','yes','other',true,'no'),binding);expect(refused).toMatchObject({pass:false,policySemanticPass:false,classificationPass:false,scope:'eligible'});
 const protectedItem={...item,expected:['unknown'],selection:'fallback',concrete:false,policy:{scope:'praise-protected' as const,target:['other'],act:['praise']}};
 const denied=scoreRepetition(protectedItem,await evaluation('no','yes','other',true,'no'),binding);expect(denied).toMatchObject({pass:true,rawSemanticPass:false,historicalPass:false,protectionPass:true,praiseAuthority:false});
 const wronglyGranted=scoreRepetition(protectedItem,await evaluation('yes','no','character',true),binding);expect(wronglyGranted).toMatchObject({pass:false,protectionPass:false,falseExisting:true,praiseAuthority:true});
 const wrongLabel=scoreRepetition({...eligible,expectedGroupId:'B'},await evaluation('yes','no','character',true),binding);expect(wrongLabel).toMatchObject({pass:false,falseExisting:true});
 const generic=scoreRepetition({...item,concrete:false,selection:'fallback',expected:['unknown'],policy:{scope:'group-protected',target:['character'],act:['praise']}},await evaluation('unknown','unknown','character',true,'no'),binding);expect(generic).toMatchObject({pass:true,protectionPass:true,praiseAuthority:true});
 const summary=summarizeRepetitionRows([good,refused,denied,wronglyGranted]);expect(summary.policySemantic).toEqual({pass:1,total:2});expect(summary.protection).toEqual({pass:1,total:2});expect(summary.falseExisting).toBe(1);
 await expect(evaluation('yes','no','character',true).then(e=>scoreRepetition(item,e,binding))).rejects.toThrow('v9_preregistered_policy_required');
});
it('S2-P4 v4 freezes the original inputs and confirmation criteria, with six new contrast cases',()=>{
 const old=JSON.parse(readFileSync('evals/fixtures/jev-repetition-v3.json','utf8')),next=JSON.parse(readFileSync('evals/fixtures/jev-repetition-v4.json','utf8'));
 expect(next.dev).toHaveLength(26);expect(next.confirmation).toHaveLength(12);
 for(let i=0;i<26;i++){const {set,...a}=old.dev[i],{set:newSet,policy,...b}=next.dev[i];expect(b).toEqual(a);}
 expect(next.confirmation.slice(0,6).map(({policy,...c}:any)=>c)).toEqual(old.confirmation);
 expect(next.confirmation.slice(6).map((c:any)=>c.selection)).toEqual(['existing','existing','new','new','fallback','fallback']);
 for(const c of [...next.dev,...next.confirmation]){expect(c.policy.target.length).toBeGreaterThan(0);expect(c.policy.act.length).toBeGreaterThan(0);expect(c.policy.scope==='eligible').toBe(c.concrete);}
});
