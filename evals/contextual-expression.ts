import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
import {z} from 'zod';
import {initialState,apply,decay,speechStyle,dialoguePlan,continueRegister,stageExpression} from '../packages/character-core/src/index.ts';
import type {Plan} from '../packages/contracts/src/domain.ts';
import {OllamaProvider} from '../packages/adapters/src/ollama.ts';

const variantSchema=z.object({id:z.string(),frustration:z.number().min(0).max(1),joy:z.number().min(0).max(1),tone:z.enum(['sharp','restrained','contextual']),recipient:z.enum(['A','B']),register:z.enum(['formal','casual']),expectedTone:z.enum(['sharp','restrained','contextual','masked']).nullable(),text:z.string(),causeTarget:z.null().optional(),mask:z.boolean().optional(),maskDiscomfort:z.boolean().optional(),silentFirst:z.boolean().optional(),recoverAtSecond:z.boolean().optional(),persona:z.string().optional()}).strict();
const fixtureSchema=z.object({version:z.literal('contextual-expression-v1'),scope:z.string(),flows:z.array(z.object({id:z.string(),topic:z.string(),variants:z.array(variantSchema).length(2)}).strict()).length(8)}).strict();
const fixturePath='evals/fixtures/contextual-expression-v1.json';
export function contextualFixtures(){
 const f=fixtureSchema.parse(JSON.parse(readFileSync(resolve(fixturePath),'utf8')));
 assert.deepEqual(f.flows.map(flow=>flow.id),Array.from({length:8},(_,i)=>`CX-S0${i+1}`));
 for(const flow of f.flows)assert.equal(new Set(flow.variants.map(v=>v.id)).size,2);
 return f;
}
export async function contextualMock(){
 const fixture=contextualFixtures(),rows=[];let requests=0;
 for(const flow of fixture.flows)for(const v of flow.variants){
  let state=apply(initialState(1000),{eventId:'00000000-0000-4000-8000-000000000001',targetId:v.causeTarget===null?null:'A',now:1000,stimuli:{frustration:v.frustration,joy:v.joy}});
  let previous:Plan|null=null;
  for(let turn=0;turn<3;turn++){
   state=decay(state,1000+turn*100);
   if(v.recoverAtSecond&&turn===1)state.affect.frustration.value=0; // explicit control, never inferred forgiveness
   const before=structuredClone(state),mask=v.mask?{joy:'mask' as const,discomfort:'mask' as const,embarrassment:'mask' as const}:v.maskDiscomfort?{discomfort:'mask' as const}:{};
   let plan:Plan={...dialoguePlan(state,turn===1&&v.silentFirst?'reengage':'question',v.recipient),speechStyle:speechStyle(state,v.recipient,{discomfortTone:v.tone,...mask}),participation:{mode:'speak'}};
   if(turn===0&&v.silentFirst)plan={...plan,action:'listen',participation:{mode:'silent',reason:'withholding'}};
   if(turn===1&&v.silentFirst)plan.reengagement={silenceEventId:'synthetic-silence',disclosure:'deflect'};
   // This controlled harness supplies only its simulated completed deliveries.
   plan=continueRegister(state,plan,previous);
   const recovered=v.recoverAtSecond&&turn>0;
   assert.equal(plan.speechStyle!.register,recovered?'casual':v.register);
   assert.equal(plan.speechStyle!.discomfortTone??null,recovered?null:v.expectedTone);
   const input=turn===0?v.text:turn===1&&v.silentFirst?'왜 말 안 해?':turn===1?'모임은 오후 3시야. 몇 시야?':'다른 얘기 하자. 상자는 파란색이야. 무슨 색이지?';
   const formal=plan.speechStyle!.register==='formal';
   // Deliberately plain canned answers; their naturalness cannot pass CX quality.
   const answer=turn===0?(formal?'말씀은 들었습니다.':'말은 들었어.'):turn===1&&v.silentFirst?(formal?'지금은 이유를 말하고 싶지 않습니다.':'지금은 이유를 말하고 싶지 않아.'):turn===1?(formal?'오후 3시입니다.':'오후 3시야.'):(formal?'파란색입니다.':'파란색이야.');
   const started=performance.now(),calls:any[]=[];let output:string[]=[];
   const provider=new OllamaProvider('qwen2.5:7b',{count:async()=>100,countText:async()=>100},'http://127.0.0.1:11434',async(_url,options)=>{
    requests++;const request=JSON.parse(String(options?.body));calls.push(request);
    return new Response(JSON.stringify({message:{content:JSON.stringify({sentences:[answer]})},done:true})+'\n',{headers:{'content-type':'application/x-ndjson'}});
   });
   if(plan.participation?.mode==='speak'){
    output=await provider.dialogue(plan,{currentInput:{payload:{text:input,identityId:v.recipient}},sources:[],memories:[],...(v.silentFirst?{silence:{eventId:'synthetic-silence',identityId:v.recipient,reason:'withholding',affect:{frustration:v.frustration}}}:{})});
    assert.deepEqual(output,[answer]);assert.equal(calls.length,1);previous=plan;
   }else assert.equal(calls.length,0);
   assert.deepEqual(state,before);
   rows.push({flow:flow.id,variant:v.id,turn,input,control:{persona:v.persona,frustration:state.affect.frustration.value,joy:state.affect.joy.value,intent:v.tone,mask},plan,request:calls[0]??null,output,projectedExpression:stageExpression(plan),mockCompletionMs:performance.now()-started,quality:'NOT_VERIFIED',stageCaptionMs:null,stageAck:'NOT_EXECUTED'});
  }
 }
 assert.equal(rows.length,48);assert.equal(requests,46);
 return {version:fixture.version,status:'MOCK_PASS',flows:8,variants:16,turns:48,mockRequests:requests,externalCalls:0,claims:{koreanQuality:'NOT_VERIFIED',naturalPersonaJudgment:'NOT_VERIFIED',database:'NOT_EXECUTED',browserStage:'NOT_EXECUTED'},rows};
}
export async function writeContextualMock(directory:string){
 const result=await contextualMock();
 const files=[fixturePath,'evals/contextual-expression.ts','packages/contracts/src/domain.ts','packages/character-core/src/index.ts','packages/adapters/src/dialogue-request.ts','packages/database/src/store.ts'];
 const sourceHashes=Object.fromEntries(files.map(file=>[file,createHash('sha256').update(readFileSync(file)).digest('hex')]));
 mkdirSync(directory);writeFileSync(resolve(directory,'results.json'),JSON.stringify({...result,sourceHashes},null,2)+'\n');
 return {status:result.status,flows:result.flows,turns:result.turns,mockRequests:result.mockRequests,externalCalls:0};
}
