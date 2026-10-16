import {beforeAll,beforeEach,afterAll,it,expect,vi} from 'vitest';
import {randomUUID} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {testDatabase,reset,IDENTITY_IDS} from './helpers.ts';
import {Store} from '../packages/database/src/store.ts';
import {Coordinator} from '../apps/runtime/src/coordinator/index.ts';
import {createProviders,type ProviderRegistry} from '../apps/runtime/src/providers.ts';
import {parseConfig} from '../packages/contracts/src/local-config.ts';
import {JevAppraisalProvider,mapJevResponse,JEV_VERSION} from '../packages/adapters/src/jev.ts';
import {jevEvidenceVerifier,readJevEvidence} from '../packages/adapters/src/appraisal-evidence.ts';
import {recordedJevResponse} from './jev-fixture.ts';
import type {DialogueGenerator,AppraisalProvider} from '../packages/contracts/src/ai-ports.ts';
import {decay} from '../packages/character-core/src/index.ts';
import {neutralAppraisal} from '../packages/contracts/src/domain.ts';
import type {AppraisalEvidenceVerifier} from '../packages/contracts/src/ai-ports.ts';

let db:Awaited<ReturnType<typeof testDatabase>>,now:number;
beforeAll(async()=>{db=await testDatabase();});
beforeEach(async()=>{now=1700000000000;await reset(db,now);});
afterAll(async()=>{await db?.close();});

it('HB01: domain/application consumers cannot import concrete language providers; composition can',async()=>{
 for(const file of ['packages/character-core/src/index.ts','packages/database/src/store.ts','apps/runtime/src/coordinator/index.ts','apps/runtime/src/http/server.ts']){
  const source=await readFile(file,'utf8');expect(source).not.toMatch(/(?:from\s*|import\s*\()['"][^'"]*adapters\/[^'"]*(?:ollama|jev|appraisal)/);
 }
 expect(await readFile('apps/runtime/src/providers.ts','utf8')).toContain('adapters/src/jev.ts');
});
it('HB05: omitted selectors preserve defaults/cost blocks; unknown registration fails before construction',()=>{
 const config=parseConfig({}),providers=createProviders(config,{});
 expect(config).toMatchObject({APPRAISAL_PROVIDER:'jev',DIALOGUE_PROVIDER:'ollama'});
 expect(providers.dialogue.model).toBe('qwen2.5:7b');expect(providers.solver).toBe(providers.dialogue);
 expect(providers.appraiser.readiness()).toMatchObject({status:'blocked',inferenceVerified:false});
 const factory=vi.fn();const registry:ProviderRegistry={dialogue:{test:factory},appraisal:{test:factory}};
 expect(()=>createProviders({...config,DIALOGUE_PROVIDER:'test',APPRAISAL_PROVIDER:'__proto__'},{},registry)).toThrow('unsupported_provider_configuration');
 expect(factory).not.toHaveBeenCalled();
 expect(()=>createProviders({...config,DIALOGUE_MODEL:'not-installed'},{})).toThrow('unsupported_provider_configuration');
});
it('HB03: strict legacy/enveloped evidence validates provenance and rejects forged or incompatible evidence',()=>{
 const event={eventId:randomUUID(),identityId:IDENTITY_IDS[0]},legacy=mapJevResponse(recordedJevResponse('other'),event.eventId);
 legacy.metadata.promptVersion='jev-appraisal-v4';legacy.metadata.providerResult.mappingVersion='jev-appraisal-v4';
 const envelope={version:1,provider:'jev',mappingVersion:'jev-appraisal-v4',...event,payload:legacy.metadata.providerResult};
 const metadata={...legacy.metadata,providerResult:envelope};
 expect(jevEvidenceVerifier.verify(legacy.appraisal,legacy.metadata,event)).toEqual({target:'character',act:'other'});
 expect(jevEvidenceVerifier.verify(legacy.appraisal,metadata,event)).toEqual({target:'character',act:'other'});
 for(const patch of [{eventId:randomUUID()},{identityId:IDENTITY_IDS[1]},{provider:'forged'},{mappingVersion:'unregistered'},{version:2},{verified:true},{payload:{verified:true}},{payload:{...envelope.payload,verified:true}}]){
  expect(jevEvidenceVerifier.verify(legacy.appraisal,{...metadata,providerResult:{...envelope,...patch}},event)).toBeUndefined();
 }
 expect(jevEvidenceVerifier.verify({...legacy.appraisal,uncertain:!legacy.appraisal.uncertain},metadata,event)).toBeUndefined();
 expect(jevEvidenceVerifier.verify(legacy.appraisal,{...metadata,failureCode:'jev_unavailable'},event)).toBeUndefined();
 for(const version of ['jev-appraisal-v1','jev-appraisal-v2','jev-appraisal-v3','jev-appraisal-v4','jev-appraisal-v5']){
  const raw={...legacy.metadata.providerResult,mappingVersion:version};
  expect(readJevEvidence(raw)).toEqual(raw);
  if(version!=='jev-appraisal-v4')expect(jevEvidenceVerifier.verify(legacy.appraisal,{...legacy.metadata,promptVersion:version,providerResult:raw},event)).toBeUndefined();
 }
});

it('HB04: mixed legacy/new records survive recovery unchanged and source deletion cancels dependent output',async()=>{
 const store=new Store(db,undefined,()=>now,jevEvidenceVerifier),session=randomUUID();await store.startSession(session,randomUUID());
 const saved:{eventId:string;raw:Record<string,unknown>}[]=[];
 for(const [i,identityId] of IDENTITY_IDS.entries()){
  const accepted=await store.acceptChat(session,randomUUID(),{identityId,text:'지금은 대답하지 말고 그냥 들어줘.'});const selected=(await store.select(accepted.eventId))!;
  const evaluation=mapJevResponse(recordedJevResponse('other'),accepted.eventId);
  if(i===0){evaluation.metadata.promptVersion='jev-appraisal-v4';evaluation.metadata.providerResult.mappingVersion='jev-appraisal-v4';}
  const raw=i===0?evaluation.metadata.providerResult:{version:2,eventRevision:String(selected.revision),provider:'jev',mappingVersion:JEV_VERSION,eventId:accepted.eventId,identityId,payload:evaluation.metadata.providerResult};
  await store.commitAppraisal(selected,evaluation.appraisal,{...evaluation.metadata,providerResult:raw});saved.push({eventId:accepted.eventId,raw});
 }
 const before=(await store.state()).body;now+=1000;await store.recover();
 expect((await store.state()).body.affect).toEqual(decay(before,now).affect);
 for(const item of saved)expect((await db.pool.query('SELECT provider_result FROM appraisals WHERE event_id=$1',[item.eventId])).rows[0].provider_result).toEqual(item.raw);
 const nextSession=randomUUID();await store.startSession(nextSession,randomUUID());
 for(const [i,item] of saved.entries()){
  const accepted=await store.acceptChat(nextSession,randomUUID(),{identityId:IDENTITY_IDS[i],text:'왜 말 안 해?'}),selected=(await store.select(accepted.eventId))!;
  const evaluated=mapJevResponse(recordedJevResponse(),accepted.eventId),result=await store.commitAppraisal(selected,evaluated.appraisal,evaluated.metadata);
  expect(result.response?.plan.reengagement?.silenceEventId).toBe(item.eventId);
  await store.deleteEvent(item.eventId,'1',randomUUID());
  expect((await db.pool.query('SELECT status FROM response_runs WHERE id=$1',[result.response!.id])).rows[0].status).toBe('cancelled');
  expect((await db.pool.query('SELECT provider_result FROM appraisals WHERE event_id=$1',[item.eventId])).rows[0].provider_result).toBeNull();
  expect(await store.generated(result.response!.id,['늦은 합성 답'],null)).toBeNull();
 }
});

it.each([['one','one'],['one','two'],['two','one'],['two','two']])('HB06: appraisal %s / dialogue %s swaps preserve silence, reengagement and ACK lifecycle',async(appraisalName,dialogueName)=>{
 const parser=new JevAppraisalProvider({localOnly:false,allowPaidProviders:true,apiKey:'synthetic'},async(_url,init)=>Response.json(recordedJevResponse(JSON.parse(String(init?.body)).state.utterance.includes('들어')?'other':'question')));
 const second:AppraisalProvider={name:'alternative',model:'synthetic',promptVersion:'fixture-v1',readiness:()=>({status:'ready',inferenceVerified:false,errorCode:null}),evaluate:async event=>{
  const act=event.text.includes('들어')?'other':'question';
  return {appraisal:{...neutralAppraisal,target:'character',act,goal_relation:'unrelated',uncertain:false,evidence_refs:[event.id]},metadata:{provider:'alternative',model:'synthetic',promptVersion:'fixture-v1',providerResult:{fixtureEvent:event.id,fixtureIdentity:event.identityId,act}}};
 }};
 const secondVerifier:AppraisalEvidenceVerifier={verify:(appraisal,metadata,event)=>metadata.provider==='alternative'&&metadata.promptVersion==='fixture-v1'&&metadata.providerResult?.fixtureEvent===event.eventId&&metadata.providerResult?.fixtureIdentity===event.identityId&&metadata.providerResult?.act===appraisal.act&&appraisal.target==='character'?{target:'character',act:appraisal.act}:undefined};
 const dialogue=(name:string):DialogueGenerator=>({name,model:'synthetic',counter:{count:async()=>50,countText:async()=>10},fitConversation:async(_plan,context)=>({conversation:context.conversation,inputTokens:50}),dialogue:name==='one'?async plan=>[plan.purpose==='reengage'?'들어 달라고 해서 조용히 듣고 있었어.':'모임은 오후 3시에 시작해.']:async(_plan,context)=>[context.silence?'조용히 듣고 있었어.':'오후 3시야.']});
 const registry:ProviderRegistry={dialogue:Object.fromEntries(['one','two'].map(name=>[name,()=>({dialogue:dialogue(name)})])),appraisal:{one:()=>({appraiser:parser,evidenceVerifier:jevEvidenceVerifier}),two:()=>({appraiser:second,evidenceVerifier:secondVerifier})}};
 const providers=createProviders(parseConfig({APPRAISAL_PROVIDER:appraisalName,APPRAISAL_MODEL:'synthetic',DIALOGUE_PROVIDER:dialogueName}),{},registry);
 const store=new Store(db,undefined,()=>now,providers.evidenceVerifier),session=randomUUID(),client=randomUUID();await store.startSession(session,randomUUID());
 const owner=await store.grantOwner(session,randomUUID(),client),send=vi.fn(),failure=vi.fn();
 const co=new Coordinator(store,providers.dialogue,{owner:()=>({clientId:client,outputEpoch:owner.outputEpoch}),sendOwner:send,inputStatus:()=>{},changed:async()=>{},failure},providers.appraiser);
 const submit=async(text:string)=>{const accepted=await store.acceptChat(session,randomUUID(),{identityId:IDENTITY_IDS[0],text});await co.drain();return accepted;};
 try{
  const silent=await submit('지금은 대답하지 말고 그냥 들어줘.');expect(send).not.toHaveBeenCalled();expect(await store.busy()).toBe(false);
  const before=(await store.state()).body;expect(before.turn.recentSilences[0]).toMatchObject({reason:'listening',eventId:silent.eventId});
  const raw=(await db.pool.query('SELECT provider_result FROM appraisals WHERE event_id=$1',[silent.eventId])).rows[0].provider_result;
  expect(raw).toMatchObject(appraisalName==='one'?{version:2,eventRevision:'1',eventId:silent.eventId,identityId:IDENTITY_IDS[0],mappingVersion:JEV_VERSION}:{fixtureEvent:silent.eventId,fixtureIdentity:IDENTITY_IDS[0],act:'other'});
  for(const text of ['왜 말 안 해?','합성 모임은 오후 3시에 시작해. 몇 시지?']){
   now+=1000;await submit(text);await vi.waitFor(async()=>expect((await db.pool.query("SELECT count(*) FROM response_runs WHERE status='delivering'")).rows[0].count).toBe('1'));
   const rows=(await db.pool.query("SELECT ss.*,r.generation_epoch,r.plan FROM speech_segments ss JOIN response_runs r ON r.id=ss.response_id WHERE r.status='delivering'")).rows;
   if(text.startsWith('왜'))expect(rows[0].plan.reengagement.silenceEventId).toBe(silent.eventId);
   if(dialogueName==='two')expect(rows[0].text).toBe(text.startsWith('왜')?'조용히 듣고 있었어.':'오후 3시야.');
   for(const segment of rows){const payload={responseId:segment.response_id,segmentId:segment.id,generationEpoch:segment.generation_epoch,outputEpoch:segment.output_epoch};await store.report(session,randomUUID(),'caption.shown',payload,client);await store.report(session,randomUUID(),'caption.finished',payload,client);}
   expect(await store.busy()).toBe(false);expect((await store.state()).body.affect).toEqual(decay(before,now).affect);
  }
  await store.recover();expect((await store.state()).body.turn.recentSilences).toEqual(before.turn.recentSilences);
  await store.deleteEvent(silent.eventId,'1',randomUUID());expect((await store.state()).body.turn.recentSilences).toEqual([]);expect(failure).not.toHaveBeenCalled();
 }finally{await co.stop();}
});
