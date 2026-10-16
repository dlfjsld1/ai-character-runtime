import {it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {generationCase,scoreGeneration,selectGeneration,profiles,fitGenerationContext,installedCandidates,installedCandidateIds,checkGenerationReservation,runGeneration} from './conversation-eval.ts';
import {OllamaProvider} from '../packages/adapters/src/ollama.ts';
import {fixtureProvider} from './helpers.ts';
import {dropOldestExchange} from '../packages/contracts/src/conversation.ts';
it('A02-6: evaluation records the fitted context and never infers during preparation',async()=>{const c=generationCase(fixture.cases[0]);let inference=0,fitCalls=0;const p={...fixtureProvider,fitConversation:async()=>{fitCalls++;return {conversation:dropOldestExchange(c.context.conversation!),inputTokens:3328};},dialogue:async()=>{inference++;return ['확인했어.'];}};const row=await fitGenerationContext(p,c.plan,c.context);expect(row.context.conversation?.turns).toEqual([]);expect(row.context.conversation?.truncated).toBe(true);expect(row.inputTokens).toBe(3328);expect(fitCalls).toBe(1);expect(inference).toBe(0);await p.dialogue();expect(inference).toBe(1);
 const broken={...p,fitConversation:async()=>{throw Error('input_too_long');}};await expect(fitGenerationContext(broken,c.plan,c.context)).rejects.toThrow('input_too_long');expect(inference).toBe(1);
});
const fixture=JSON.parse(readFileSync('evals/fixtures/conversation-dev-v1.json','utf8'));
it('CR04–06: preregistered controls preserve state, current input and disclosure authority',()=>{const cases=fixture.cases.map(generationCase);expect(cases).toHaveLength(12);expect(cases[7].plan.reengagement?.disclosure).toBe('deflect');expect(cases[7].context.emotion?.frustration).toBe(.65);expect(cases[8].context.silence).toBe(null);expect(cases[8].plan.reengagement?.silenceEventId).toBe(null);expect(cases[0].context.conversation?.turns.map((t:any)=>t.text)).toEqual(['따뜻한 음식 하나 추천해줘.','잔치국수 어때?']);});
function comparison(){const rows=profiles.flatMap(profile=>fixture.cases.map((c:any)=>({id:c.id,profile,call:{elapsedMs:10}})));const grades=rows.map(r=>{const n=Number(r.id.slice(1));return {...r,call:undefined,hardPass:r.profile!=='current',N:r.profile==='current'?1:2,U:2,C:n<=4?r.profile==='current'?0:2:null,E:n>=4&&n<=8?2:null,D:n===5?2:n===7?0:null,note:'고정된 회귀용 가상 채점'};}).map(({call,...g})=>g);return {rows,reviewer:'codex_same_context' as const,grades};}
it('CR11: baseline failure does not block eligible candidates; ties select the smaller B',()=>{const c=comparison(),scores=scoreGeneration(c.rows,{reviewer:c.reviewer,grades:c.grades});expect(scores.current.eligible).toBe(false);expect(scores['conversation-direct-v1'].eligible).toBe(true);expect(selectGeneration(scores,c.rows)).toBe('conversation-history-v1');});
it('CR11: one hard failure, wrong applicability, missing/duplicate grades cannot be averaged away',()=>{const c=comparison();c.grades.find(g=>g.profile==='conversation-direct-v1')!.hardPass=false;const scores=scoreGeneration(c.rows,{reviewer:c.reviewer,grades:c.grades});expect(scores['conversation-direct-v1'].eligible).toBe(false);c.grades[0].C=null;expect(()=>scoreGeneration(c.rows,{reviewer:c.reviewer,grades:c.grades})).toThrow('review_applicability_mismatch');expect(()=>scoreGeneration(c.rows,{reviewer:c.reviewer,grades:c.grades.slice(1)})).toThrow('review_case_mismatch');});

const installedConfig={DIALOGUE_MODEL:'gemma4:12b-it-qat',DIALOGUE_TOKENIZER_PATH:'J:/ai/tokenizers/gemma',TOKENIZER_PYTHON:'J:/ai/python.exe'};
it('G1-H: installed candidates bind model and prompt separately without changing the production config',()=>{
 const before=structuredClone(installedConfig),c=installedCandidates(installedConfig,'J:/ai/tokenizers/qwen35');
 expect(c.map(x=>[x.id,x.model,x.profile])).toEqual([['gemma-current','gemma4:12b-it-qat','current'],['gemma-history','gemma4:12b-it-qat','conversation-history-v1'],['qwen35-history','qwen3.5:9b-q4_K_M','conversation-history-v1']]);
 expect(c[1].tokenizer).not.toBe(c[2].tokenizer);expect(installedConfig).toEqual(before);
 for(const path of [undefined,'C:/tokenizer',installedConfig.DIALOGUE_TOKENIZER_PATH])expect(()=>installedCandidates(installedConfig,path)).toThrow();
 expect(()=>installedCandidates({...installedConfig,DIALOGUE_MODEL:'unknown'},'J:/ai/qwen')).toThrow();
});
it('G1-H: new experiment isolates ledger keys, enforces 48 attempts, and never reuses confirmation for another candidate',()=>{
 const experiment='installed-model-v1' as const,ledger={experiment,attempts:Array.from({length:36},(_,i)=>({key:'generation-dev:case'+i,status:'completed',directory:'J:/ai/dev'}))};
 const keys=Array.from({length:12},(_,i)=>'generation-confirmation:qwen35-history:H'+i);
 expect(()=>checkGenerationReservation(ledger,experiment,'generation-confirmation',keys)).not.toThrow();
 expect(()=>checkGenerationReservation({...ledger,attempts:[...ledger.attempts,{key:'other',status:'failed',directory:''}]},experiment,'generation-confirmation',keys)).toThrow('generation_attempt_limit_or_duplicate');
 const used={...ledger,attempts:[...ledger.attempts,{key:'generation-confirmation:gemma-history:H01',status:'reserved',directory:''}]};
 expect(()=>checkGenerationReservation(used,experiment,'generation-confirmation',keys)).toThrow('confirmation_already_attempted');
 expect(()=>checkGenerationReservation(ledger,experiment,'generation-dev',[ledger.attempts[0].key])).toThrow('generation_attempt_limit_or_duplicate');
 expect(()=>checkGenerationReservation({attempts:[]},experiment,'generation-dev',keys)).toThrow('experiment_ledger_mismatch');
});
it('G1-Q: identical prompt profiles on different models retain separate grades and candidate selection',()=>{
 const c=comparison(),rename=(p:string)=>installedCandidateIds[profiles.indexOf(p as any)];
 const rows=c.rows.map(r=>({...r,profile:rename(r.profile)})),grades=c.grades.map(g=>({...g,profile:rename(g.profile)}));
 grades.find(g=>g.profile==='gemma-history')!.hardPass=false;
 const scores=scoreGeneration(rows,{reviewer:c.reviewer,grades},'G','installed-model-v1');
 expect(scores['gemma-history'].eligible).toBe(false);expect(scores['qwen35-history'].eligible).toBe(true);expect(selectGeneration(scores,rows,'installed-model-v1')).toBe('qwen35-history');
 expect(()=>scoreGeneration(rows,{reviewer:c.reviewer,grades})).toThrow('review_experiment_mismatch');
 const hRows=rows.filter(r=>r.profile==='qwen35-history').map(r=>({...r,id:r.id.replace('G','H')})),hGrades=grades.filter(g=>g.profile==='qwen35-history').map(g=>({...g,id:g.id.replace('G','H')}));
 expect(scoreGeneration(hRows,{reviewer:c.reviewer,grades:hGrades},'H','installed-model-v1')['qwen35-history'].eligible).toBe(true);
});
it.each([0,2,7])('G1-H: Gemma/Qwen history send identical instructions, facts and disclosure for control %s',async index=>{
 const bodies:any[]=[],control=generationCase(fixture.cases[index]),counter={count:async()=>10,countText:async()=>10};
 for(const candidate of installedCandidates(installedConfig,'J:/ai/tokenizers/qwen35').slice(1)){
  const provider=new OllamaProvider(candidate.model,counter,undefined,async(_url,init)=>{const body=JSON.parse(String(init?.body));bodies.push(body);const content=JSON.stringify(body.format.properties.content?{content:'확인했어.',sentences:['확인했어.']}:{sentences:['확인했어.']});return new Response(JSON.stringify({done:true,message:{content},prompt_eval_count:10})+'\n',{headers:{'content-type':'application/x-ndjson'}});},{evaluation:{model:candidate.model,seed:17,think:false,promptVariant:'conversation-history-v1'}});
  await provider.dialogue(control.plan,control.context);
 }
 expect(bodies[0].messages).toEqual(bodies[1].messages);expect(bodies[0].format).toEqual(bodies[1].format);expect(bodies[0].options).toEqual(bodies[1].options);expect(bodies.map(b=>b.think)).toEqual([false,false]);expect(bodies[0].model).not.toBe(bodies[1].model);
});
it('G1-H: malformed experiment arguments stop before filesystem or inference operations',async()=>{
 await expect(runGeneration(['--synthetic-inputs','--phase','generation-dev','--experiment','unknown'])).rejects.toThrow('unsupported_generation_experiment');
 await expect(runGeneration(['--synthetic-inputs','--phase','generation-dev','--experiment','installed-model-v1','--output-root','C:/results'])).rejects.toThrow('j_output_required');
});
