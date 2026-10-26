import {beforeAll,beforeEach,afterAll,it,expect} from 'vitest';
import {randomUUID} from 'node:crypto';
import {testDatabase,reset,IDENTITY_IDS,CHARACTER_ID,fixtureProvider} from './helpers.ts';
import {scriptedJev} from './semantic-jev-fixture.ts';
import {Coordinator} from '../apps/runtime/src/coordinator/index.ts';
import {thinkingCueAllowed,pickThinkingCue} from '../apps/runtime/src/coordinator/thinking-cue.ts';
import {Store} from '../packages/database/src/store.ts';
import {neutralAppraisal,RuntimeError} from '../packages/contracts/src/domain.ts';
import {THINKING_CUES_V1} from '../packages/database/src/seed.ts';

const meta=(act?:string)=>({provider:'jev',model:'jev-1.13.0',...(act?{providerResult:{version:4,payload:{conversation:{conversation_act:{choice:act}}}}}:{})});
const asked={...neutralAppraisal,target:'character' as const,act:'question' as const};
it('a cue only for turns the character answers; listen requests, unknown acts, criticism and recent withholding are silent',()=>{
  expect(thinkingCueAllowed(asked,meta('ordinary'),false,false)).toBe(true);
  // A listen request comes back as act "other"; only the conversation act carries it.
  expect(thinkingCueAllowed({...asked,act:'other'},meta('listen_request'),false,false)).toBe(false);
  expect(thinkingCueAllowed(asked,meta('unknown'),false,false)).toBe(false);
  expect(thinkingCueAllowed({...asked,act:'criticism'},meta('ordinary'),false,false)).toBe(false);
  expect(thinkingCueAllowed({...asked,act:'criticism',target:'other'},meta('ordinary'),false,false)).toBe(true);
  expect(thinkingCueAllowed(asked,meta('ordinary'),false,true)).toBe(false);
  // A failed appraisal means a normal reply.
  expect(thinkingCueAllowed(neutralAppraisal,meta(),true,false)).toBe(true);
});
it('cues rotate without repeating the last one; none configured means none',()=>{
  const cues=['음..','그러니까..','어..'];
  for(const last of cues)for(const r of [0,.5,.99])expect(pickThinkingCue(cues,last,()=>r)).not.toBe(last);
  expect(pickThinkingCue(['음..'],'음..')).toBe('음..');
  expect(pickThinkingCue([],null)).toBeNull();
});

let db:Awaited<ReturnType<typeof testDatabase>>,store:Store,now:number;
beforeAll(async()=>{db=await testDatabase();});
beforeEach(async()=>{now=Date.now();await reset(db,now);store=new Store(db,CHARACTER_ID,()=>now);});
afterAll(async()=>{await db?.close();});
const user=IDENTITY_IDS[0]!;
type Sent={type:string;payload:any};
// Runs one chat turn. `late` moves the store clock past the 4 s mark right after
// the input is accepted, so the cue is due as soon as the appraisal is in.
async function turn(text:string,opts:{late:boolean;delayMs?:number;fail?:boolean;table?:Record<string,'listen_request'|'ordinary'>}){
  const sessionId=randomUUID();await store.startSession(sessionId,randomUUID());
  const clientId=randomUUID(),owner=await store.grantOwner(sessionId,randomUUID(),clientId),sent:Sent[]=[];
  const slow=async()=>{await new Promise(r=>setTimeout(r,opts.delayMs??0));if(opts.fail)throw new RuntimeError('provider_timeout',503);return ['그건 이렇게 해 보면 돼.'];};
  const provider={...fixtureProvider,dialogue:slow};
  const sink={owner:()=>({clientId,outputEpoch:owner.outputEpoch}),sendOwner:(type:string,payload:object)=>{sent.push({type,payload});},inputStatus:()=>{},changed:async()=>{},failure:()=>{}};
  const co=new Coordinator(store,provider,sink,scriptedJev(opts.table??{}));
  try{
    const accepted=await co.chat(sessionId,randomUUID(),{identityId:user,text});
    if(opts.late)now+=5000;
    for(let i=0;i<300;i++){
      if(sent.some(s=>s.type==='response.start'||s.type==='character.thinking.end'))break;
      const r=(await db.pool.query("SELECT count(*)::int n FROM transitions t JOIN events p ON p.id=t.source_event_id WHERE p.parent_event_id=$1",[accepted.eventId])).rows[0].n;
      if(r&&!opts.delayMs&&!opts.fail&&sent.length===0&&i>40)break;
      await new Promise(r=>setTimeout(r,20));
    }
    await new Promise(r=>setTimeout(r,50));
    return {sent,eventId:accepted.eventId};
  }finally{await co.stop();}
}
it('a slow reply shows a configured cue first, then the reply replaces it',async()=>{
  const {sent,eventId}=await turn('이 상자 여는 법 알려 줘.',{late:true,delayMs:300});
  const types=sent.map(s=>s.type);
  expect(types.indexOf('character.thinking')).toBeGreaterThanOrEqual(0);
  expect(types.indexOf('character.thinking')).toBeLessThan(types.indexOf('response.start'));
  const cue=sent.find(s=>s.type==='character.thinking')!.payload;
  expect(cue.eventId).toBe(eventId);expect(THINKING_CUES_V1).toContain(cue.text);expect(typeof cue.outputEpoch).toBe('string');
  expect(types.filter(t=>t==='character.thinking')).toHaveLength(1);
  // The cue is not dialogue: nothing about it is stored.
  expect((await db.pool.query('SELECT count(*)::int n FROM speech_segments WHERE text=$1',[cue.text])).rows[0].n).toBe(0);
});
it('a reply that starts within 4 s shows no cue',async()=>{
  const {sent}=await turn('이 상자 여는 법 알려 줘.',{late:false});
  expect(sent.map(s=>s.type)).toContain('response.start');expect(sent.some(s=>s.type==='character.thinking')).toBe(false);
});
it('a listen request never shows a cue even when late',async()=>{
  const {sent}=await turn('지금은 대답하지 말고 그냥 들어줘.',{late:true,table:{'지금은 대답하지 말고 그냥 들어줘.':'listen_request'}});
  expect(sent.some(s=>s.type==='character.thinking')).toBe(false);
});
it('a failed reply clears a shown cue',async()=>{
  const {sent}=await turn('이 상자 여는 법 알려 줘.',{late:true,delayMs:200,fail:true});
  const types=sent.map(s=>s.type);
  expect(types).toContain('character.thinking');expect(types).toContain('character.thinking.end');expect(types).not.toContain('response.start');
});
