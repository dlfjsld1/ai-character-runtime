import {it,expect} from 'vitest';
import {randomUUID} from 'node:crypto';
import {contextualFixtures,contextualMock} from './contextual-expression.ts';
import {Store} from '../packages/database/src/store.ts';
import {initialState,speechStyle,dialoguePlan} from '../packages/character-core/src/index.ts';
import {buildDialogueRequest,buildKnowledgeRequest} from '../packages/adapters/src/dialogue-request.ts';
import type {Plan} from '../packages/contracts/src/domain.ts';

it('CX authored fixture keeps eight flows, sixteen contrasts and three-turn mock transport separate from quality',async()=>{
 expect(contextualFixtures().flows).toHaveLength(8);
 const result=await contextualMock();
 expect(result).toMatchObject({status:'MOCK_PASS',flows:8,variants:16,turns:48,mockRequests:46,externalCalls:0});
 expect(result.rows.filter(row=>row.plan.participation?.mode==='silent')).toHaveLength(2);
 expect(result.rows.every(row=>row.quality==='NOT_VERIFIED'&&row.stageAck==='NOT_EXECUTED')).toBe(true);
 for(const row of result.rows.filter(row=>row.request)){
  expect(row.request.messages[0].content).toContain('답변 전체');
  expect(row.request.messages[0].content).toContain('정당한 피드백이나 정정');
 }
});

// Query responses are synthetic. This exercises Store's plan/source ownership
// boundary, not PostgreSQL execution, browser delivery or model semantics.
async function stored(options:{tone?:'sharp'|'restrained'|'contextual'|'masked';valid?:boolean;category?:string;other?:boolean;conceal?:boolean;coreMask?:boolean;previous?:Plan;completed?:boolean;shared?:boolean}={}){
 const identity=randomUUID(),cause=randomUUID(),state=initialState(1000);
 state.affect.frustration.value=.7;state.affect.frustration.causes=[{eventId:cause,targetId:identity}];
 let plan:Plan={...dialoguePlan(state,'knowledge_answer',identity),speechStyle:speechStyle(state,identity,{discomfortTone:options.tone==='masked'?undefined:options.tone??'sharp',...(options.tone==='masked'?{discomfort:'mask'}:{})})};
 if(options.conceal)plan={...plan,speechStyle:{...plan.speechStyle!,concealAffect:true}};
 if(options.coreMask)plan={...plan,speechStyle:speechStyle(state,identity,{joy:'mask',discomfort:'mask',embarrassment:'mask'})};
 const before=structuredClone(state),sourceIds:string[]=[],queries:string[]=[];let saved:Plan|undefined;
 const c={query:async(sql:string,args:any[]=[])=>{
  queries.push(sql);let rows:any[]=[];
  if(sql.startsWith('SELECT r.id,r.plan'))rows=options.previous?[{id:'previous',plan:{...options.previous,targetIdentityId:identity},segment_count:1,delivered_count:options.completed===false?0:1}]:[];
  else if(sql.startsWith('SELECT 1 FROM response_sources'))rows=options.shared===false?[]:[{exists:1}];
  else if(sql.startsWith('SELECT DISTINCT e.id')){
   expect(args[1]).toEqual([cause]);
   rows=options.valid===false?[]:[{id:cause,revision:'1',identity_id:options.other?randomUUID():identity,kind:'chat.final',category:options.category??'direct_insult'}];
  }else if(sql.startsWith('INSERT INTO response_runs'))saved=args[6];
  else if(sql.startsWith('INSERT INTO response_sources'))sourceIds.push(args[3]);
  return {rows,rowCount:rows.length};
 }};
 const store=new Store({} as any,randomUUID(),()=>1000);
 const result=await (store as any).response(c,{body:state,version:1n,generationEpoch:1n,configVersion:1n,snapshotAt:new Date(1000)},randomUUID(),{id:'trigger',revision:'1'},plan);
 expect(state).toEqual(before);expect(saved).toEqual(result.plan);
 return {plan:result.plan as Plan,sourceIds,cause,queries};
}
it.each(['sharp','restrained','contextual','masked'] as const)('CX03 Store binds valid %s cause even in casual register',async tone=>{
 const r=await stored({tone});expect(r.plan.speechStyle?.discomfortTone).toBe(tone);expect(r.sourceIds).toContain(r.cause);
 expect(r.queries.join('\n')).toContain('a.event_revision=e.revision');
 expect(r.queries.join('\n')).toContain("e.data_status='active'");
});
it.each([{valid:false},{category:'praise'},{other:true}])('CX03 Store strips unsupported sharpness %j',async options=>{
 const r=await stored(options);expect(r.plan.speechStyle).toEqual({register:'casual',positiveTone:'neutral'});expect(r.sourceIds).not.toContain(r.cause);
});
it('CX04 contradictory sharpness is stripped before persistence when concealing',async()=>{
 const r=await stored({conceal:true});expect(r.plan.speechStyle).toEqual({register:'casual',positiveTone:'neutral',concealAffect:true});
});
const prior:Plan={action:'answer',purpose:'question',targetIdentityId:'replaced-by-fixture',expression:'neutral',maxSentences:1,delivery:'normal',memoryIds:[],speechStyle:{register:'casual',positiveTone:'neutral',discomfortTone:'sharp'}};
it.each([{completed:true,shared:true,expected:'casual'},{completed:false,shared:true,expected:'formal'},{completed:true,shared:false,expected:'formal'}])('CX01 Store retains only delivered casual distance with shared cause %j',async ({expected,...options})=>{
 const r=await stored({...options,previous:prior,tone:'contextual'});expect(r.plan.speechStyle?.register).toBe(expected);
});
it('CX01 partial hiding retains casual register across the next topic',async()=>{
 const masked=await stored({previous:prior,tone:'masked'});
 const next=await stored({previous:masked.plan,tone:'contextual'});expect(next.plan.speechStyle?.register).toBe('casual');
});
it('CX01/04 full casual concealment retains its dependency for the following topic',async()=>{
 const hidden=await stored({previous:prior,coreMask:true});
 expect(hidden.plan.speechStyle).toEqual({register:'casual',positiveTone:'neutral',concealAffect:true});
 expect(hidden.sourceIds).toContain(hidden.cause);
 const next=await stored({previous:hidden.plan,tone:'contextual'});expect(next.plan.speechStyle?.register).toBe('casual');
});
it('CX02 current production, content-first and retrieval requests share the expression policy',()=>{
 const plan:Plan={...prior,speechStyle:{register:'casual',positiveTone:'bright',discomfortTone:'sharp'}};
 for(const request of [buildDialogueRequest(plan,{},'synthetic'),buildDialogueRequest(plan,{},'gemma4:12b-it-qat')]){
  const text=JSON.stringify(request.messages);expect(text).toContain('날 선');expect(text).toContain('답변 전체');expect(text).not.toContain('비꼬거나 모욕하지 않는다');
 }
 const request=buildKnowledgeRequest({...plan,purpose:'knowledge_answer'},{knowledge:{query:'시간',revision:'synthetic-v1',chunks:[]}} as any);
 expect(JSON.stringify(request.messages)).toContain('날 선');expect(JSON.stringify(request.messages)).toContain('chunks에서만');
});
