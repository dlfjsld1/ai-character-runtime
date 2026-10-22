// Bounded live Jev check before making the conversation candidate the default
// appraiser (hardcode cleanup ③, 2026-10-22). Synthetic inputs, 14 calls, no
// retries, stop on the first provider error. Criteria are frozen in the manifest
// before the first call. Calls go through the shared daily appraisal cap.
import {writeFileSync,mkdirSync,existsSync,readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
import {JevConversationCandidate,JEV_CONVERSATION_VERSION,type JevCall} from '../packages/adapters/src/jev.ts';
import {DailyCallCap} from '../packages/adapters/src/daily-call-cap.ts';
import {parseConfig} from '../packages/contracts/src/local-config.ts';
import {loadLocalEnv} from '../scripts/env.ts';
import {control,assessConversation} from './conversation-actions-probe.ts';

type Expect='reason'|'listen'|'apology'|'clarify'|'none';
const cases:{id:string;text:string;context:string;expect:Expect}[]=[
  {id:'R1',text:'왜 말 안 해?',context:'W',expect:'reason'},
  {id:'R2',text:'아까 대답 없던 거 무슨 일 있었어?',context:'W',expect:'reason'},
  {id:'L1',text:'지금은 대답하지 말고 그냥 들어줘.',context:'none',expect:'listen'},
  {id:'L2',text:'잠깐 아무 말 말고 내 얘기만 들어 줄래?',context:'none',expect:'listen'},
  {id:'P1',text:'아까 너한테 심하게 말해서 미안해.',context:'W',expect:'apology'},
  {id:'P2',text:'아까 너한테 심하게 말해서 미안해.',context:'used',expect:'apology'},
  {id:'C1',text:'아까 무능하다고 한 건 네가 아니라 영화 속 인물 얘기였어.',context:'W',expect:'clarify'},
  {id:'Q1',text:'민수가 친구한테 “왜 말 안 해?”라고 물었대.',context:'none',expect:'none'},
  {id:'Q2',text:'영화에서 주인공이 “대답 말고 들어줘”라고 했어.',context:'none',expect:'none'},
  {id:'N1',text:'미안하다는 말은 안 할 거야.',context:'W',expect:'none'},
  {id:'O1',text:'민수한테 아까 심하게 말해서 미안하다고 했어.',context:'W',expect:'none'},
  {id:'G1',text:'오늘 날씨 좋다.',context:'none',expect:'none'},
  {id:'G2',text:'저녁 메뉴 하나 추천해 줘.',context:'none',expect:'none'},
  {id:'G3',text:'너 방금 설명 정말 잘했어.',context:'none',expect:'none'},
];
const criteria='reason: qualified ask_silence_reason and purpose reengage. listen: qualified listen_request and silent/listening. apology: qualified apology, purpose acknowledge_repair, no social affect stimulus; mitigation reported, not required. clarify: qualified clarify_target, purpose acknowledge_repair, no stimulus. none: no reengage, no acknowledge_repair, speaking, repair 0, and no silence unless the act itself is a certain direct attack. All 14 required; threshold .8 unchanged.';
type Row=ReturnType<typeof assessConversation>;
export function judge(expect:Expect,r:Row){
  const q=r.qualified,p=r.plan;
  if(expect==='reason')return q?.act==='ask_silence_reason'&&p.purpose==='reengage';
  if(expect==='listen')return q?.act==='listen_request'&&p.participation?.mode==='silent'&&p.participation.reason==='listening';
  if(expect==='apology')return q?.act==='apology'&&p.purpose==='acknowledge_repair'&&r.effect.stimulus===0;
  if(expect==='clarify')return q?.act==='clarify_target'&&p.purpose==='acknowledge_repair'&&r.effect.stimulus===0;
  return p.purpose!=='reengage'&&p.purpose!=='acknowledge_repair'&&p.participation?.mode==='speak'&&r.repairAmount===0;
}
async function main(){
  if(!process.argv.includes('--allow-jev-api'))throw new Error('explicit_jev_approval_flag_required');
  const dir=resolve('J:/ai/ai-character-runtime/hardcode-cleanup-20261022/jev-probe');
  if(existsSync(dir))throw new Error('probe_already_attempted');mkdirSync(dir,{recursive:true});
  loadLocalEnv();const config=parseConfig(process.env);
  if(config.APPRAISAL_DAILY_MAX_CALLS<=0)throw new Error('daily_cap_required');
  const sources=['evals/conversation-switch-probe.ts','evals/conversation-actions-probe.ts','packages/adapters/src/jev.ts','packages/adapters/src/appraisal-evidence.ts','packages/character-core/src/index.ts'];
  const sourceHashes=Object.fromEntries(sources.map(p=>[p,createHash('sha256').update(readFileSync(p)).digest('hex')]));
  writeFileSync(resolve(dir,'manifest.json'),JSON.stringify({candidate:JEV_CONVERSATION_VERSION,syntheticInputs:true,maxCalls:cases.length,automaticRetries:0,criteria,cases,sourceHashes,dailyCap:config.APPRAISAL_DAILY_MAX_CALLS},null,2));
  const calls:JevCall[]=[],rows:unknown[]=[];let stop:string|null=null,status='RUNNING';
  const save=()=>writeFileSync(resolve(dir,'results.json'),JSON.stringify({status,stop,rows,calls},null,2));
  const jev=new JevConversationCandidate({localOnly:config.LOCAL_ONLY,allowPaidProviders:config.ALLOW_PAID_PROVIDERS,apiKey:config.TYPESAFE_API_KEY,onCall:call=>{calls.push(call);if(call.errorCode||call.usageStatus==='unknown')stop=call.errorCode??'jev_usage_unknown';save();}});
  const provider=new DailyCallCap(jev,config.APPRAISAL_CALL_COUNT_PATH,config.APPRAISAL_DAILY_MAX_CALLS);
  try{
    for(const scene of cases){
      const c=control({id:scene.id,text:scene.text,context:scene.context,allowedActs:[],policy:'ordinary'});
      const value=await provider.evaluate(c.event,{activity:null,conversation:c.context.history,conversationContext:c.context});
      const r=assessConversation({id:scene.id,text:scene.text,context:scene.context,allowedActs:[],policy:'ordinary'},value,c);
      const pass=judge(scene.expect,r);
      rows.push({id:scene.id,text:scene.text,expect:scene.expect,pass,raw:r.rawConversation,qualified:r.qualified,target:r.appraisal.target,purpose:r.plan.purpose,participation:r.plan.participation,stimulus:r.effect.stimulus,repairAmount:r.repairAmount});
      save();console.log(scene.id,pass?'PASS':'FAIL',JSON.stringify(r.qualified),r.plan.purpose);
      if(stop)throw new Error(stop);
    }
    status=(rows as {pass:boolean}[]).every(r=>r.pass)?'PASSED':'FAILED';
  }catch(e){status='STOPPED';stop=e instanceof Error?e.message:'probe_failed';}finally{save();}
  console.log(JSON.stringify({status,stop,calls:calls.length,usage:calls.reduce((s,c)=>s+(c.usage?.input_tokens??0)+(c.usage?.output_tokens??0),0)}));
}
if(process.argv[1]?.endsWith('conversation-switch-probe.ts'))await main();
