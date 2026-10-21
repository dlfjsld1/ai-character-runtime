import {afterAll,afterEach,beforeAll,describe,it,expect,vi} from 'vitest';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {createHash,randomUUID} from 'node:crypto';
import {parseEnv} from 'node:util';
import {chromium} from '@playwright/test';
import {DeepSeekDialogue,type DeepSeekOptions} from '../packages/adapters/src/deepseek.ts';
import {Coordinator} from '../apps/runtime/src/coordinator/index.ts';
import {Store} from '../packages/database/src/store.ts';
import {runContextualStage} from './contextual-stage.ts';

// Opt-in integration: synthetic provider HTTP, real isolated DB and Chrome.
// A fresh artifact root and database range are required for each invocation.
const enabled=['CX_STAGE_FAILURE_ROOT','CX_STAGE_FAILURE_UI','CX_STAGE_FAILURE_DB_PROFILE','CX_STAGE_FAILURE_CHROME'].every(key=>!!process.env[key]);
const read=(path:string)=>JSON.parse(readFileSync(path,'utf8'));
const hash=(path:string)=>createHash('sha256').update(readFileSync(path)).digest('hex');
type InternalDialogue={options:DeepSeekOptions};
type FailureMode='decoder'|'usage'|'late'|'cancel'|'finished';

describe.skipIf(!enabled)('CX Stage failure evidence with real DB and Chrome',()=>{
 let database:URL,previousPassword:string|undefined,previousExitCode:typeof process.exitCode;
 let transportCalls=0,latePhysicalComplete=false;
 beforeAll(()=>{
  previousPassword=process.env.PGPASSWORD;
  const profile=parseEnv(readFileSync(process.env.CX_STAGE_FAILURE_DB_PROFILE!,'utf8'));
  if(!profile.TEST_DATABASE_URL)throw Error('cx_stage_test_database_profile_required');
  database=new URL(profile.TEST_DATABASE_URL);
  if(!['postgres:','postgresql:'].includes(database.protocol)||database.hostname!=='127.0.0.1'||database.port!=='55434')throw Error('cx_stage_isolated_database_required');
  if(database.password)process.env.PGPASSWORD=decodeURIComponent(database.password);
  database.password='';
 });
 afterEach(()=>{vi.restoreAllMocks();process.exitCode=previousExitCode;});
 afterAll(()=>{if(previousPassword===undefined)delete process.env.PGPASSWORD;else process.env.PGPASSWORD=previousPassword;});

 async function runFailure(mode:FailureMode,index:number){
  previousExitCode=process.exitCode;transportCalls=0;latePhysicalComplete=false;
  const root=join(process.env.CX_STAGE_FAILURE_ROOT!,mode),prepared=join(root,'prepared'),out=join(root,'run');
  const ui=process.env.CX_STAGE_FAILURE_UI!,chrome=process.env.CX_STAGE_FAILURE_CHROME!;
  const first=Number(process.env.CX_STAGE_FAILURE_DB_START??4);
  if(!Number.isSafeInteger(first)||first<4)throw Error('cx_stage_fresh_database_range_required');
  const url=new URL(database);url.pathname='/character_runtime_cx_stage_mock_20261018_r'+(first+index);
  // The provider must use its injected synthetic transport, never global fetch.
  vi.spyOn(globalThis,'fetch').mockImplementation(async()=>{throw Error('external_provider_io_forbidden');});
  const dialogue=DeepSeekDialogue.prototype.dialogue;
  vi.spyOn(DeepSeekDialogue.prototype,'dialogue').mockImplementation(async function(this:DeepSeekDialogue,plan,context){
   const options=(this as unknown as InternalDialogue).options,transport=options.fetcher!;
   options.fetcher=async(input,init)=>{
    transportCalls++;
    const response=await transport(input,init),body=await response.json();
    if(mode==='decoder')body.choices[0].message.content=JSON.stringify({content:'해결됐어.',sentences:[]});
    if(mode==='usage')delete body.usage;
    if(mode==='late'){await new Promise(resolve=>setTimeout(resolve,150));latePhysicalComplete=true;}
    return Response.json(body,{status:response.status});
   };
   if(mode==='late'){options.deadlineMs=10;options.physicalTimeoutMs=2000;}
   return dialogue.call(this,plan,context);
  });
  let cancellation:Promise<void>|undefined,cancellationError:unknown;
  if(mode==='cancel'){
   let coordinator:Coordinator|undefined;
   const dispatch=Coordinator.prototype.dispatch,report=Store.prototype.report;
   vi.spyOn(Coordinator.prototype,'dispatch').mockImplementation(function(this:Coordinator,id){coordinator=this;return dispatch.call(this,id);});
   vi.spyOn(Store.prototype,'report').mockImplementation(async function(this:Store,...args){
    const committed=await report.apply(this,args);
    if(args[2]==='caption.shown'&&!cancellation){
     // Let the current control transaction and ACK finish before requesting
     // cancellation through the normal Coordinator -> Store path.
     cancellation=new Promise(resolve=>{setTimeout(()=>{
      void coordinator!.cancel(args[0],randomUUID(),args[3].responseId,'operator_stop').then(()=>resolve(),error=>{cancellationError=error;resolve();});
     },150);});
    }
    return committed;
   });
  }
  if(mode==='finished'){
   const launch=chromium.launchPersistentContext.bind(chromium);
   vi.spyOn(chromium,'launchPersistentContext').mockImplementation(async(...args)=>{
    const context=await launch(...args);
    await context.addInitScript(()=>{
     const send=WebSocket.prototype.send;
     WebSocket.prototype.send=function(data){
      if(typeof data==='string'&&JSON.parse(data)?.type==='caption.finished')return;
      return send.call(this,data);
     };
    });
    return context;
   });
  }
  await runContextualStage(['--prepare','--out',prepared,'--ui',ui]);
  const path=join(prepared,'prepared.json');
  await runContextualStage(['--rehearse','--out',out,'--ui',ui,'--prepared',path,'--prepared-hash',hash(path),'--database',url.href,'--chrome',chrome,'--synthetic-inputs']);
  await cancellation;if(cancellationError)throw cancellationError;
  return read(join(out,'results.json'));
 }

 function assertStopped(result:any){
  expect(transportCalls).toBe(1);expect(result.transportCalls).toBe(1);expect(result.apiCalls).toBe(0);expect(result.mode).toBe('mock');
  expect(result.status).toBe('FAIL');expect(result.steps).toHaveLength(1);
  expect(result.claims.dbStageDelivery).toBe('NOT_VERIFIED');expect(result.claims.actualGeneration).toBe('NOT_VERIFIED');
  expect(result.physicalDrained).toBe(true);expect(result.lockReleased).toBe(true);
  const step=result.steps[0];
  expect(step.fixture.inputId).toBeTruthy();expect(step.request).toBeTruthy();expect(step.raw).toBeTruthy();
  for(const field of ['segments','packets','observations','dbAcks','sources','sentAcks','evidenceErrors'])expect(step[field],field).toEqual(expect.any(Array));
  expect(step.sources.length).toBeGreaterThan(0);expect(step.evidenceErrors).toEqual([]);
  expect(result.accounting.newCalls).toBe(1);expect(result.accounting.priorPrefixPreserved).toBe(true);
  expect(result.cleanup.busyAfter).toBe(false);expect(result.cleanup.errors).toEqual([]);
  return step;
 }

 it('preserves the failed response and empty delivery evidence after decoder rejection',async()=>{
  const result=await runFailure('decoder',0),step=assertStopped(result);
  expect(result.failures).toContain('invalid_output');expect(step.response).toMatchObject({status:'failed',cancel_reason:'invalid_output'});
  expect(step.segments).toEqual([]);expect(step.observations).toEqual([]);expect(step.dbAcks).toEqual([]);expect(step.sentAcks).toEqual([]);expect(step.busy).toBe(false);
 },90000);

 it('preserves an unknown usage charge and stops before delivery when usage is missing',async()=>{
  const result=await runFailure('usage',1),step=assertStopped(result);
  expect(result.failures).toContain('deepseek_usage_unconfirmed');expect(step.response).toMatchObject({status:'failed',cancel_reason:'deepseek_usage_unconfirmed'});
  expect(step.segments).toEqual([]);expect(step.observations).toEqual([]);expect(step.dbAcks).toEqual([]);expect(step.sentAcks).toEqual([]);expect(step.busy).toBe(false);
  expect(result.accounting.summary.unresolvedEntries).toBe(1);expect(result.accounting.after.entries[0].status).toBe('unknown');
 },90000);

 it('drains and accounts for late valid HTTP after a logical timeout without delivering it',async()=>{
  const result=await runFailure('late',2),step=assertStopped(result);
  expect(result.failures).toContain('deepseek_deadline');expect(step.response).toMatchObject({status:'failed',cancel_reason:'deepseek_deadline'});
  expect(latePhysicalComplete).toBe(true);expect(step.call.physicalCompleted).toBe(true);
  expect(result.accounting.after.entries[0].status).toBe('completed');expect(result.accounting.summary.unresolvedEntries).toBe(0);
  expect(step.decoded).toBeUndefined();expect(step.segments).toEqual([]);expect(step.observations).toEqual([]);expect(step.dbAcks).toEqual([]);expect(step.sentAcks).toEqual([]);expect(step.busy).toBe(false);
 },90000);

 it('preserves the first shown caption and cancellation without claiming completed delivery',async()=>{
  const result=await runFailure('cancel',3),step=assertStopped(result);
  expect(step.response).toMatchObject({status:'cancelled',cancel_reason:'operator_stop'});expect(step.busy).toBe(false);
  expect(step.decoded).toHaveLength(2);expect(step.segments).toHaveLength(2);
  expect(step.segments[0].text_shown_at).toBeTruthy();expect(step.segments.every((segment:any)=>segment.delivery_status==='cancelled')).toBe(true);
  expect(step.dbAcks.map((ack:any)=>ack.kind)).toEqual(['caption.shown']);
  expect(step.sentAcks.map((ack:any)=>ack.type)).toEqual(['caption.shown']);
  expect(step.observations.map((observation:any)=>observation.type)).toEqual(['caption.shown']);
  expect(step.packets.some((packet:any)=>packet.type==='response.cancel')).toBe(true);
 },90000);

 it('preserves native disconnection and cancellation after a finished ACK is dropped',async()=>{
  const result=await runFailure('finished',4),step=assertStopped(result);
  // Wire assigns a sequence before native send. Dropping one frame makes the
  // next unchanged frame fail the server sequence fence and close the owner.
  // This verifies native disconnect cancellation, not a connected ACK timeout.
  expect(step.response).toMatchObject({status:'cancelled',cancel_reason:'stage_disconnected'});expect(step.busy).toBe(false);
  expect(result.failures).toContain('delivery_cancelled');
  expect(step.decoded).toHaveLength(2);expect(step.segments).toHaveLength(2);
  expect(step.segments[0].text_shown_at).toBeTruthy();expect(step.segments[1].text_shown_at).toBeNull();
  expect(step.segments.every((segment:any)=>segment.delivery_status==='cancelled')).toBe(true);
  expect(step.dbAcks.map((ack:any)=>ack.kind)).toEqual(['caption.shown']);
  expect(step.sentAcks.length).toBeGreaterThanOrEqual(1);expect(step.sentAcks.every((ack:any)=>ack.type==='caption.shown')).toBe(true);
  expect(step.observations.some((observation:any)=>observation.type==='caption.shown')).toBe(true);
  // Init-script order may place the observer before or after the drop wrapper;
  // actual wire and DB ACK evidence above must always show no finished ACK.
  expect(result.cleanup.responses).toEqual(expect.arrayContaining([expect.objectContaining({id:step.response.id,status:'cancelled'})]));
 },90000);
});
