import {beforeAll,beforeEach,afterAll,it,expect} from 'vitest';
import {randomUUID} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {testDatabase,reset,IDENTITY_IDS,CHARACTER_ID,fixtureProvider} from './helpers.ts';
import {scriptedJev,type ConversationAct} from './semantic-jev-fixture.ts';
import {recordedJevResponse} from './jev-fixture.ts';
import {Coordinator} from '../apps/runtime/src/coordinator/index.ts';
import {Store} from '../packages/database/src/store.ts';
import type {Situation} from '../packages/contracts/src/first-reaction.ts';

const lines=JSON.parse(readFileSync('packages/database/data/first-reactions-v1.json','utf8')).firstReactions;
let db:Awaited<ReturnType<typeof testDatabase>>,store:Store,now:number;
beforeAll(async()=>{db=await testDatabase();});
beforeEach(async()=>{now=Date.now();await reset(db,now);store=new Store(db,CHARACTER_ID,()=>now);});
afterAll(async()=>{await db?.close();});
type Sent={type:string;payload:any};
// One chat turn with a scripted Jev appraisal and a fixed situation answer. late moves the
// store clock past the 4 s cue mark so a cue would be due if no reaction was shown.
async function turn(text:string,situation:Situation|null,opts:{act?:ConversationAct;base?:ReturnType<typeof recordedJevResponse>;late?:boolean}={}){
  const sessionId=randomUUID();await store.startSession(sessionId,randomUUID());
  const clientId=randomUUID(),owner=await store.grantOwner(sessionId,randomUUID(),clientId),sent:Sent[]=[];
  const provider={...fixtureProvider,dialogue:async()=>{await new Promise(r=>setTimeout(r,150));return ['그건 이렇게 보면 돼.'];}};
  const sink={owner:()=>({clientId,outputEpoch:owner.outputEpoch}),sendOwner:(type:string,payload:object)=>{sent.push({type,payload});},inputStatus:()=>{},changed:async()=>{},failure:()=>{}};
  const appraiser=scriptedJev({[text]:opts.base?{act:opts.act??'ordinary',base:opts.base}:opts.act??'ordinary'});
  const co=new Coordinator(store,provider,sink,appraiser,undefined,undefined,undefined,{classify:async()=>situation} as never);
  try{
    const accepted=await co.chat(sessionId,randomUUID(),{identityId:IDENTITY_IDS[0],text});if(opts.late)now+=5000;
    for(let i=0;i<150&&!(await db.pool.query("SELECT 1 FROM transitions t JOIN events p ON p.id=t.source_event_id WHERE p.parent_event_id=$1",[accepted.eventId])).rowCount;i++)await new Promise(r=>setTimeout(r,20));
    for(let i=0;i<50&&!sent.some(s=>s.type==='response.start');i++)await new Promise(r=>setTimeout(r,20));
    await new Promise(r=>setTimeout(r,80));
    const plan=(await db.pool.query("SELECT r.plan FROM response_runs r JOIN events p ON p.id=r.trigger_event_id WHERE p.parent_event_id=$1",[accepted.eventId])).rows[0]?.plan;
    return {sent,types:sent.map(s=>s.type),plan};
  }finally{await co.stop();}
}
const sure=(category:Situation['category'],target='character',confidence=.9):Situation=>({category,confidence,target});
it('a clear situation shows one reviewed line before the reply, replaces the cue and reaches the reply as already said',async()=>{
  const {sent,types,plan}=await turn('나 시험 합격했어!',sure('good_news'),{late:true});
  const reaction=sent.find(s=>s.type==='character.reaction')?.payload;expect(reaction).toBeDefined();
  expect(lines.good_news.map((l:any)=>l.text)).toContain(reaction.text);
  expect(types.indexOf('character.reaction')).toBeLessThan(types.indexOf('response.start'));
  expect(types).not.toContain('character.thinking');
  expect(plan.firstReaction).toBe(reaction.text);
});
it('a correction gets a reaction although the thinking cue would stay quiet for it',async()=>{
  const {types}=await turn('아까 네 설명 틀렸어.',sure('correction_received'),{base:recordedJevResponse('criticism','character',2,0)});
  expect(types).toContain('character.reaction');
});
it.each([
  ['listen request',sure('request_received'),{act:'listen_request' as const}],
  ['certain hostile attack',sure('correction_received'),{base:recordedJevResponse('criticism','character',3,3)}],
  ['quoted praise',sure('praise_received','quoted'),{}],
  ['low confidence',sure('good_news','character',.5),{}],
  ['no situation answer',null,{}],
])('%s shows no reaction',async(_name,situation,opts)=>{
  const {types,plan}=await turn('어떤 말',situation,opts as never);
  expect(types).not.toContain('character.reaction');expect(plan?.firstReaction).toBeUndefined();
});
it('the reaction tone follows the state before this turn: calm allows any, concealment neutral, discomfort no cheer',async()=>{
  const {reactionStyle}=await import('../apps/runtime/src/coordinator/first-reaction.ts'),{initialState,dialoguePlan}=await import('../packages/character-core/src/index.ts');
  const base=dialoguePlan(initialState(0),'other',IDENTITY_IDS[0]!);
  expect(reactionStyle({...base,expression:'neutral'}).tones).toEqual(['neutral','happy','embarrassed','uncomfortable']);
  expect(reactionStyle({...base,expression:'uncomfortable'}).tones).toEqual(['uncomfortable','neutral']);
  expect(reactionStyle({...base,expression:'happy',speechStyle:{register:'formal',positiveTone:'neutral',concealAffect:true}})).toEqual({register:'formal',tones:['neutral']});
});
