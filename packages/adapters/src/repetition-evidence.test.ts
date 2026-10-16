import {it,expect} from 'vitest';
import {JevRepetitionCandidate,JevAppraisalProvider,mapJevRepetitionResponse,JEV_QUESTIONS} from './jev.ts';
import {jevEvidenceVerifier} from './appraisal-evidence.ts';
import {recordedJevResponse} from '../../../evals/jev-fixture.ts';
import * as jev from './jev.ts';
import {providerResultSchema} from './jev-schema.ts';
import {selectPraiseGroup,socialAffect} from '../../character-core/src/index.ts';
const event={id:'10000000-0000-4000-8000-000000000010',identityId:'20000000-0000-4000-8000-000000000010',revision:'2',text:'너 두 번째 그림 정말 잘 그렸어.'};
const snapshot={asOf:1000,complete:true,items:[{eventId:'10000000-0000-4000-8000-000000000011',revision:'1',text:'너 첫 번째 그림 정말 잘 그렸어.'}]};
const binding={eventId:event.id,identityId:event.identityId,eventRevision:event.revision,recentPraise:snapshot};
const choice=(value:string,keys:string[],confidence=1)=>({type:'choice',choice:value,confidence,probabilities:Object.fromEntries(keys.map(key=>[key,key===value?1:0]))});
it('S2-P1 strong sameness with weak non-contradiction reuses an event only in v9',()=>{
 const pair={sameEvent:{type:'choice',choice:'yes',confidence:.97,probabilities:{yes:.98,no:.02,unknown:0}},separateEvent:{type:'choice',choice:'no',confidence:.62,probabilities:{yes:.24,no:.75,unknown:.01}}};
 expect(jev.repetitionV8Relation(pair)).toBe('unknown');
 expect(jev.repetitionV9Relation(pair)).toBe('same');
});
it('S2-P1 v9 never ignores contradictions, ties or weak positive evidence',()=>{
 const keys=['yes','no','unknown'];
 for(const same of keys)for(const separate of keys)for(const sc of [.799,.8,1])for(const dc of [0,.799,.8,1]){
  const pair={sameEvent:choice(same,keys,sc),separateEvent:choice(separate,keys,dc)};
  const expected=sc>=.8&&same==='yes'&&separate==='no'?'same':sc>=.8&&dc>=.8&&same==='no'&&separate==='yes'?'distinct':'unknown';
  expect(jev.repetitionV9Relation(pair)).toBe(expected);
 }
 for(const key of ['sameEvent','separateEvent'] as const){const pair={sameEvent:choice('yes',keys),separateEvent:choice('no',keys)};pair[key].probabilities={yes:.5,no:.5,unknown:0};expect(jev.repetitionV9Relation(pair)).toBe('unknown');}
 for(const mutate of [(p:any)=>p.sameEvent.choice='new',(p:any)=>p.separateEvent.probabilities={yes:0,no:.2,unknown:0},(p:any)=>p.separateEvent.extra=1]){const pair={sameEvent:choice('yes',keys),separateEvent:choice('no',keys)};mutate(pair);expect(()=>jev.repetitionV9Relation(pair)).toThrow('jev_invalid_output');}
});
it('S2-P2 existing-group reuse excludes other consumption only with every member resolved',()=>{
 const groups=[{eventId:'a',revision:'1',groupId:'A'},{eventId:'a2',revision:'1',groupId:'A'},{eventId:'b',revision:'1',groupId:'B'}];
 const evidence=(relations:('same'|'distinct'|'unknown')[])=>({concrete:true,comparisons:groups.map((g,i)=>({...g,relation:relations[i]!}))});
 expect(selectPraiseGroup(groups,evidence(['same','same','distinct']),true)).toEqual({kind:'existing',groupId:'A'});
 for(const r of [['same','unknown','distinct'],['same','same','unknown'],['same','same','same'],['same','distinct','distinct']] as ('same'|'distinct'|'unknown')[][])expect(selectPraiseGroup(groups,evidence(r),true)).toEqual({kind:'fallback'});
 const appraisal=jev.mapJevResponse(recordedJevResponse('praise','character',3),event.id).appraisal;
 const history=[{id:'a',identityId:event.identityId,kind:'praise' as const,at:1000,order:1n,affectStimulus:.12,affectGroupId:'A'},{id:'b',identityId:event.identityId,kind:'praise' as const,at:1000,order:2n,affectStimulus:.18,affectGroupId:'B'}];
 expect(socialAffect(appraisal,history,event.identityId,1000).stimulus).toBe(0);
 expect(socialAffect(appraisal,history,event.identityId,1000,undefined,'A').stimulus).toBe(.09);
});
it('S2-R1 v8 only authorizes unambiguous complementary event predicates',()=>{
 const values=['yes','no','unknown'];
 for(const same of values)for(const separate of values){
  const pair={sameEvent:choice(same,values),separateEvent:choice(separate,values)};
  expect(jev.repetitionV8Relation(pair)).toBe(same==='yes'&&separate==='no'?'same':same==='no'&&separate==='yes'?'distinct':'unknown');
 }
 for(const key of ['sameEvent','separateEvent'] as const){
  const pair={sameEvent:choice('yes',values),separateEvent:choice('no',values)};
  pair[key].confidence=.799;expect(jev.repetitionV8Relation(pair)).toBe('unknown');
  pair[key].confidence=.8;expect(jev.repetitionV8Relation(pair)).toBe('same');
  pair[key].probabilities={yes:.5,no:.5,unknown:0};expect(jev.repetitionV8Relation(pair)).toBe('unknown');
 }
});
function raw(count=1){const base=recordedJevResponse('praise','character',3);return {...base,answers:{...base.answers,concrete:choice('yes',['yes','no','unknown']),...Object.fromEntries(Array.from({length:count},(_,i)=>[`comparison_${i}`,choice('distinct',['same','distinct','unknown'])]))}};}
async function evaluate(response:any=raw(),context:object={recentPraise:snapshot}){
 let body:any;
 const provider=new JevRepetitionCandidate({localOnly:false,allowPaidProviders:true,apiKey:'fixture'},async(_url,options)=>{body=JSON.parse(String(options?.body));return Response.json(response);});
 return {evaluation:await provider.evaluate(event,context),body};
}
it('S2-A sends only public text, binds exact sources locally, and grants no model-owned group ID',async()=>{
 const {evaluation,body}=await evaluate(raw(),{recentPraise:snapshot,memory:'PRIVATE',groupId:'SECRET',activity:null});
 expect(body.state).toEqual({utterance:event.text,speaker:'user',addressee:'character',activity:null,previous:snapshot.items.map(i=>i.text)});
 for(const secret of [event.id,event.identityId,snapshot.items[0]!.eventId,'PRIVATE','SECRET','asOf','revision'])expect(JSON.stringify(body)).not.toContain(secret);
 expect(jevEvidenceVerifier.verifyRepetition?.(evaluation.appraisal,evaluation.metadata,binding)).toEqual({concrete:true,comparisons:[{eventId:snapshot.items[0]!.eventId,revision:'1',relation:'distinct'}]});
 expect(Object.keys(body.questions)).toHaveLength(7);
});
it('S2-A incomplete, invalid and oversized comparisons send no partial text or extra questions',async()=>{
 for(const recentPraise of [{...snapshot,complete:false},{...snapshot,items:Array.from({length:9},()=>snapshot.items[0])},{...snapshot,items:[{...snapshot.items[0],text:'가'.repeat(1001)}]}]){
  const {evaluation,body}=await evaluate(recordedJevResponse('praise','character',3),{recentPraise});
  expect(body.state.previous).toBeUndefined();expect(body.questions).toEqual(JEV_QUESTIONS);
  expect(jevEvidenceVerifier.verifyRepetition?.(evaluation.appraisal,evaluation.metadata,binding)).toBeUndefined();
  expect(jevEvidenceVerifier.verify(evaluation.appraisal,evaluation.metadata,binding)?.acknowledgePraise).toBe(true);
 }
 const {body}=await evaluate(recordedJevResponse('praise','character',3),{activity:{prompt:'가'.repeat(3900),status:'ready'},recentPraise:{...snapshot,items:Array.from({length:8},(_,i)=>({eventId:`10000000-0000-4000-8000-00000000002${i}`,revision:'1',text:'가'.repeat(200)}))}});
 expect(body.state.previous).toBeUndefined();expect(body.questions).toEqual(JEV_QUESTIONS);
});
it('S2-B low comparison confidence does not erase S1B affect or participation',async()=>{
 const response:any=raw();response.answers.strength={...response.answers.strength,score:2.65,confidence:.65,probabilities:{'0':0,'1':0,'2':.35,'3':.65}};response.answers.comparison_0.confidence=.79;
 const {evaluation:e}=await evaluate(response);
 expect(e.appraisal).toMatchObject({uncertain:true,strength:0});
 expect(jevEvidenceVerifier.verifyAffect?.(e.appraisal,e.metadata,binding)).toEqual({kind:'praise',strength:2});
 expect(jevEvidenceVerifier.verify(e.appraisal,e.metadata,binding)?.acknowledgePraise).toBe(true);
 expect(jevEvidenceVerifier.verifyRepetition?.(e.appraisal,e.metadata,binding)?.comparisons[0]?.relation).toBe('unknown');
 response.answers.strength=recordedJevResponse('praise','character',3).answers.strength;
 expect((await evaluate(response)).evaluation.appraisal.uncertain).toBe(false);
});
it('S2-B ties and uncertain concrete withhold novelty; malformed extras fail the single request',async()=>{
 const response:any=raw();response.answers.concrete.confidence=.79;
 let e=(await evaluate(response)).evaluation;
 expect(jevEvidenceVerifier.verifyRepetition?.(e.appraisal,e.metadata,binding)?.concrete).toBe(false);
 response.answers.concrete.confidence=1;response.answers.comparison_0.probabilities={same:.5,distinct:.5,unknown:0};
 e=(await evaluate(response)).evaluation;expect(jevEvidenceVerifier.verifyRepetition?.(e.appraisal,e.metadata,binding)?.comparisons[0]?.relation).toBe('unknown');
 for(const mutate of [(r:any)=>delete r.answers.comparison_0,(r:any)=>r.answers.extra={},(r:any)=>r.answers.comparison_0.probabilities.distinct=.2,(r:any)=>r.answers.comparison_0.choice='made_up']){
  const r=raw();mutate(r);expect(()=>mapJevRepetitionResponse(r,event.id,1)).toThrow('jev_invalid_output');
 }
});
it('S2-A source/time/revision/order/model/usage/current-appraisal tampering grants no grouping',async()=>{
 const {evaluation}=await evaluate();
 for(const mutate of [
  (e:any)=>e.metadata.providerResult.comparison.asOf++,
  (e:any)=>e.metadata.providerResult.comparison.sources[0].revision='9',
  (e:any)=>e.metadata.providerResult.comparison.sources=[],
  (e:any)=>e.metadata.providerResult.eventRevision='1',
  (e:any)=>e.metadata.providerResult.identityId=snapshot.items[0]!.eventId,
  (e:any)=>e.metadata.model='different',
  (e:any)=>delete e.metadata.usage,
  (e:any)=>e.appraisal.strength=1,
  (e:any)=>e.metadata.failureCode='failed',
  (e:any)=>e.metadata.providerResult.payload.mappingVersion='jev-appraisal-v6',
 ]){const e=structuredClone(evaluation);mutate(e);expect(jevEvidenceVerifier.verifyRepetition?.(e.appraisal,e.metadata,binding)).toBeUndefined();}
});
it('S2-B v6 stays the production default and has no repetition authority; zero-history bootstrap works',async()=>{
 const provider=new JevAppraisalProvider({localOnly:false,allowPaidProviders:true,apiKey:'fixture'},async(_u,o)=>{expect(JSON.parse(String(o?.body)).questions).toEqual(JEV_QUESTIONS);return Response.json(recordedJevResponse('praise','character',3));});
 const old=await provider.evaluate(event,{recentPraise:snapshot});expect(old.metadata.promptVersion).toBe('jev-appraisal-v6');
 expect(jevEvidenceVerifier.verifyRepetition?.(old.appraisal,old.metadata,binding)).toBeUndefined();
 const recentPraise={...snapshot,items:[]},e=(await evaluate(raw(0),{recentPraise})).evaluation;
 expect(jevEvidenceVerifier.verifyRepetition?.(e.appraisal,e.metadata,{...binding,recentPraise})).toEqual({concrete:true,comparisons:[]});
});
function rawV8(count=1){
 const base=recordedJevResponse('praise','character',3),answers:Record<string,unknown>={...base.answers,concrete:choice('yes',['yes','no','unknown'])};
 for(let i=0;i<count;i++){answers[`same_event_${i}`]=choice('no',['yes','no','unknown']);answers[`separate_event_${i}`]=choice('yes',['yes','no','unknown']);}
 return {...base,answers};
}
async function evaluateV8(context:object={recentPraise:snapshot},change?:(raw:ReturnType<typeof rawV8>)=>void){
 let body:any,calls=0;
 const provider=new jev.JevRepetitionV8Candidate({localOnly:false,allowPaidProviders:true,apiKey:'fixture'},async(_url,options)=>{
  calls++;body=JSON.parse(String(options?.body));const response=body.questions.concrete?rawV8(body.state.previous.length):recordedJevResponse('praise','character',3);change?.(response);return Response.json(response);
 });
 return {evaluation:await provider.evaluate(event,context),body,calls};
}
it('S2-R2 v8 compares all eight inputs within body limits without internal identifiers',async()=>{
 const recentPraise={...snapshot,items:Array.from({length:8},(_,i)=>({eventId:`10000000-0000-4000-8000-00000000002${i}`,revision:'1',text:`너 ${i+1}번 그림 정말 잘 그렸어.`}))};
 const {evaluation:e,body,calls}=await evaluateV8({recentPraise,memory:'PRIVATE',groupId:'SECRET'});
 expect(calls).toBe(1);expect(Object.keys(body.questions)).toHaveLength(22);expect(Buffer.byteLength(JSON.stringify(body))).toBeLessThanOrEqual(32000);expect(body.state.previous).toEqual(recentPraise.items.map(i=>i.text));
 for(const secret of [event.id,event.identityId,'PRIVATE','SECRET',...recentPraise.items.map(i=>i.eventId)])expect(JSON.stringify(body)).not.toContain(secret);
 expect(e.metadata.promptVersion).toBe('jev-appraisal-v8');expect(jevEvidenceVerifier.verifyRepetition?.(e.appraisal,e.metadata,{...binding,recentPraise})?.comparisons.map(i=>i.relation)).toEqual(Array(8).fill('distinct'));
});
it('S2-R2 v8 oversize or incomplete context drops the whole comparison in one request',async()=>{
 for(const context of [{recentPraise:{...snapshot,complete:false}},{activity:{prompt:'가'.repeat(3900),status:'ready'},recentPraise:{...snapshot,items:Array.from({length:8},(_,i)=>({eventId:`10000000-0000-4000-8000-00000000002${i}`,revision:'1',text:'가'.repeat(200)}))}}]){
  const {evaluation:e,body,calls}=await evaluateV8(context);expect(calls).toBe(1);expect(body.state.previous).toBeUndefined();expect(body.questions).toEqual(JEV_QUESTIONS);expect(jevEvidenceVerifier.verifyRepetition?.(e.appraisal,e.metadata,binding)).toBeUndefined();expect(jevEvidenceVerifier.verify(e.appraisal,e.metadata,binding)?.acknowledgePraise).toBe(true);
 }
});
it('S2-R1 v8 low pair confidence preserves S1B while malformed keys, distributions and mixed versions fail',async()=>{
 const {evaluation:e}=await evaluateV8(undefined,r=>{(r.answers.separate_event_0 as any).confidence=.79;r.answers.strength={...recordedJevResponse().answers.strength,score:2.65,confidence:.65,probabilities:{'0':0,'1':0,'2':.35,'3':.65}};});
 expect(e.appraisal).toMatchObject({uncertain:true,strength:0});expect(jevEvidenceVerifier.verifyAffect?.(e.appraisal,e.metadata,binding)).toEqual({kind:'praise',strength:2});expect(jevEvidenceVerifier.verifyRepetition?.(e.appraisal,e.metadata,binding)?.comparisons[0]?.relation).toBe('unknown');
 for(const mutate of [(r:any)=>delete r.answers.same_event_0,(r:any)=>r.answers.comparison_0={},(r:any)=>r.answers.separate_event_0.probabilities.yes=.1,(r:any)=>r.answers.same_event_0.choice='new']){const r=rawV8();mutate(r);expect(()=>jev.mapJevRepetitionV8Response(r,event.id,1)).toThrow('jev_invalid_output');}
 const payload=jev.mapJevRepetitionV8Response(rawV8(),event.id,1).metadata.providerResult;
 expect(providerResultSchema.safeParse({...payload,mappingVersion:'jev-appraisal-v7'}).success).toBe(false);
 expect(providerResultSchema.safeParse({...payload,repetition:{concrete:choice('yes',['yes','no','unknown']),comparisons:[]}}).success).toBe(false);
});
it('S2-R1 v8 rejects source or binding mutations and supports zero-history bootstrap',async()=>{
 const {evaluation}=await evaluateV8();
 for(const alter of [(e:any)=>e.metadata.providerResult.comparison.asOf++,(e:any)=>e.metadata.providerResult.comparison.sources[0].revision='3',(e:any)=>e.metadata.providerResult.eventRevision='1',(e:any)=>e.metadata.providerResult.identityId=snapshot.items[0]!.eventId,(e:any)=>e.metadata.promptVersion='jev-appraisal-v7',(e:any)=>e.appraisal.strength=0,(e:any)=>delete e.metadata.usage]){
  const e=structuredClone(evaluation);alter(e);expect(jevEvidenceVerifier.verifyRepetition?.(e.appraisal,e.metadata,binding)).toBeUndefined();
 }
 const recentPraise={...snapshot,items:[]},e=(await evaluateV8({recentPraise})).evaluation;expect(jevEvidenceVerifier.verifyRepetition?.(e.appraisal,e.metadata,{...binding,recentPraise})).toEqual({concrete:true,comparisons:[]});
});

it('S2-P1 v9 binds its own raw version and provenance, retaining v8 requests and S1B',async()=>{
 const calls:unknown[]=[];
 const provider=new jev.JevRepetitionV9Candidate({localOnly:false,allowPaidProviders:true,apiKey:'fixture'},async(_u,o)=>{const body=JSON.parse(String(o?.body));calls.push(body);const r:any=rawV8(body.state.previous?.length??0);if(!body.questions.concrete)return Response.json(recordedJevResponse('praise','character',3));for(let i=0;i<body.state.previous.length;i++){r.answers['same_event_'+i]=choice('yes',['yes','no','unknown'],.97);r.answers['separate_event_'+i]=choice('no',['yes','no','unknown'],.62);}r.answers.strength={...r.answers.strength,score:2.65,confidence:.65,probabilities:{'0':0,'1':0,'2':.35,'3':.65}};return Response.json(r);});
 const e=await provider.evaluate(event,{recentPraise:snapshot});
 expect(e.metadata.promptVersion).toBe('jev-appraisal-v9');expect((calls[0] as any).questions).toEqual(jev.repetitionV8Questions(1));
 expect(jevEvidenceVerifier.verifyRepetition?.(e.appraisal,e.metadata,binding)?.comparisons[0]?.relation).toBe('same');expect(jevEvidenceVerifier.verifyAffect?.(e.appraisal,e.metadata,binding)).toEqual({kind:'praise',strength:2});
 expect(jevEvidenceVerifier.verify(e.appraisal,e.metadata,binding)?.acknowledgePraise).toBe(true);
 for(const alter of [(x:any)=>x.metadata.providerResult.comparison.asOf++,(x:any)=>x.metadata.providerResult.comparison.sources[0].revision='7',(x:any)=>x.metadata.providerResult.eventRevision='1',(x:any)=>x.metadata.providerResult.identityId=event.id,(x:any)=>x.metadata.model='other',(x:any)=>delete x.metadata.usage,(x:any)=>x.metadata.providerResult.payload.mappingVersion='jev-appraisal-v8',(x:any)=>x.appraisal.strength=1]){const x=structuredClone(e);alter(x);expect(jevEvidenceVerifier.verifyRepetition?.(x.appraisal,x.metadata,binding)).toBeUndefined();}
 const payload=(e.metadata.providerResult as any).payload;
 for(const version of ['jev-appraisal-v6','jev-appraisal-v7','jev-appraisal-v8'])expect(providerResultSchema.safeParse({...payload,mappingVersion:version}).success).toBe(false);
 expect(providerResultSchema.safeParse({...payload,repetitionV8:payload.repetitionV9}).success).toBe(false);
 const eight={...snapshot,items:Array.from({length:8},(_,i)=>({eventId:'10000000-0000-4000-8000-00000000002'+i,revision:'1',text:'너 '+i+'번 그림 정말 잘 그렸어.'}))};
 const e8=await provider.evaluate(event,{recentPraise:eight});expect((calls[1] as any).questions).toEqual(jev.repetitionV8Questions(8));expect(Buffer.byteLength(JSON.stringify(calls[1]))).toBeLessThanOrEqual(32000);expect(jevEvidenceVerifier.verifyRepetition?.(e8.appraisal,e8.metadata,{...binding,recentPraise:eight})?.comparisons).toHaveLength(8);
 const empty={...snapshot,items:[]};const bootstrap=await provider.evaluate(event,{recentPraise:empty});expect(jevEvidenceVerifier.verifyRepetition?.(bootstrap.appraisal,bootstrap.metadata,{...binding,recentPraise:empty})).toEqual({concrete:true,comparisons:[]});
 const incomplete=await provider.evaluate(event,{recentPraise:{...snapshot,complete:false}});expect((calls[3] as any).questions).toEqual(JEV_QUESTIONS);expect(jevEvidenceVerifier.verifyRepetition?.(incomplete.appraisal,incomplete.metadata,binding)).toBeUndefined();expect(calls).toHaveLength(4);
});
