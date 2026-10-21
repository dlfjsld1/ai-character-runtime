import {describe,it,expect,vi} from 'vitest';
import {parseStageArgs,StageAdmission,finishStageRunAccounting,collectStageStep} from './contextual-stage.ts';
import type {openStageBudget} from './contextual-stage-guard.ts';
import type {Store} from '../packages/database/src/store.ts';
const common=['--out','J:/ai/stage-out','--ui','J:/ai/stage-ui'];
const execute=['--prepared','J:/ai/prepared.json','--prepared-hash','a'.repeat(64),'--database','postgresql://postgres@127.0.0.1:55434/character_runtime_cx_stage_mock_20261018_r1','--chrome','chrome.exe','--synthetic-inputs'];
describe('Stage explicit execution scope',()=>{
 it('prepare needs no credentials or database',()=>expect(parseStageArgs(['--prepare',...common]).prepare).toBe(true));
 it('rehearses only a named fresh local database',()=>expect(parseStageArgs(['--rehearse',...common,...execute]).rehearse).toBe(true));
 for(const args of [common,['--prepare','--live',...common],['--prepare',...common,'--allow-paid-providers'],['--prepare',...common,'--key-file','secret.env'],['--live',...common,...execute],['--rehearse',...common,...execute,'--ledger','J:/ai/real.json'],['--prepare','--out','C:/tmp','--ui','J:/ai/ui']])it('rejects missing or mismatched modes '+args.join(' '),()=>expect(()=>parseStageArgs(args)).toThrow());
 for(const database of ['postgresql://postgres@remote:55434/character_runtime_cx_stage_mock_20261018_r1','postgresql://postgres@127.0.0.1:55434/postgres','postgresql://postgres@127.0.0.1:5432/character_runtime_cx_stage_mock_20261018_r1'])it('rejects shared or remote DB '+database,()=>expect(()=>parseStageArgs(['--rehearse',...common,...execute.map(x=>x.startsWith('postgresql:')?database:x)])).toThrow());
});
describe('Stage accounting failures preserve observed calls',()=>{
 it('retains already sent HTTP count when the ledger cannot be read',()=>{
  const close=vi.fn(),guard={accounting:()=>{throw Error('stage_unexpected_entries');},close} as unknown as ReturnType<typeof openStageBudget>;
  const result=finishStageRunAccounting(guard,{transportCalls:1,apiCalls:1},true);
  expect(result).toEqual({transportCalls:1,apiCalls:1,accountingErrors:['stage_unexpected_entries'],lockReleased:true});expect(close).toHaveBeenCalledWith({physicalDrained:true});
 });
 it('keeps synthetic transports distinct from real API requests',()=>{
  expect(finishStageRunAccounting(undefined,{transportCalls:1,apiCalls:0},true)).toMatchObject({transportCalls:1,apiCalls:0});
 });
 it('does not release a run whose physical call has not ended',()=>{
  const close=vi.fn(),guard={accounting:()=>({newCalls:1}),close} as unknown as ReturnType<typeof openStageBudget>;
  const result=finishStageRunAccounting(guard,{transportCalls:1,apiCalls:1},false);
  expect(result.lockReleased).toBe(false);expect(result.accountingErrors).toEqual(['physical_drain_unconfirmed']);expect(close).not.toHaveBeenCalled();
 });
});
describe('Stage partial evidence survives failed recollection',()=>{
 it('keeps the last observed DB and browser evidence when later reads fail',async()=>{
  const response={id:'response',status:'delivering'},segments=[{id:'segment'}],observations=[{requestId:'shown',payload:{responseId:'response'}}],dbAcks=[{id:'ack'}],sources=[{event_id:'input'}];
  const step={fixture:{response:{id:'response'}},response,segments,observations,dbAcks,sources,busy:true,packetOffset:0,sentAckOffset:0,evidenceErrors:['earlier read failed']};
  const store={db:{pool:{query:async()=>{throw Error('database_unavailable');}}},busy:async()=>{throw Error('database_unavailable');}} as unknown as Store;
  await collectStageStep(step,store,undefined,[],[]);
  expect(step).toMatchObject({response,segments,observations,dbAcks,sources,busy:true});
  expect(step.evidenceErrors).toHaveLength(7);expect(step.evidenceErrors[0]).toBe('earlier read failed');expect(step.evidenceErrors.some(e=>e.includes('stage_page_unavailable'))).toBe(true);
 });
 it('replaces old evidence only after a successful read',async()=>{
  const response={id:'response',status:'cancelled'},segments=[{id:'new-segment'}];
  const step:any={fixture:{response:{id:'response'}},response:{status:'delivering'},segments:[{id:'old-segment'}],packetOffset:0,sentAckOffset:0};
  const query=vi.fn().mockResolvedValueOnce({rows:[response]}).mockResolvedValueOnce({rows:segments}).mockRejectedValueOnce(Error('ack_unavailable')).mockResolvedValueOnce({rows:[]});
  await collectStageStep(step,{db:{pool:{query}},busy:async()=>false} as unknown as Store,undefined,[],[]);
  expect(step).toMatchObject({response,segments,dbAcks:[],sources:[],observations:[],busy:false});expect(step.evidenceErrors).toHaveLength(2);
 });
});
describe('Stage generation admission before budget reservation',()=>{
 const ctx=(id:string)=>({currentInput:{id}});
 it('blocks unarmed generations permanently',()=>{const g=new StageAdmission();expect(()=>g.consume(ctx('a'))).toThrow();expect(()=>g.arm('a')).toThrow();expect(g.calls).toBe(0);});
 it('blocks foreign generations permanently',()=>{const g=new StageAdmission();g.arm('a');expect(()=>g.consume(ctx('b'))).toThrow();expect(()=>g.consume(ctx('a'))).toThrow();expect(g.calls).toBe(0);});
 it('blocks duplicates permanently',()=>{const g=new StageAdmission();g.arm('a');g.consume(ctx('a'));expect(()=>g.consume(ctx('a'))).toThrow();g.done();expect(()=>g.arm('b')).toThrow();expect(g.calls).toBe(1);});
 it('permits the next completed fixed turn',()=>{const g=new StageAdmission();g.arm('a');g.consume(ctx('a'));g.done();g.arm('b');g.consume(ctx('b'));expect(g.calls).toBe(2);});
 it('latches failure before any later provider call',()=>{const g=new StageAdmission();g.arm('a');g.stop();expect(()=>g.consume(ctx('a'))).toThrow();expect(()=>g.arm('b')).toThrow();expect(g.calls).toBe(0);});
 it('caps this path at eight generations',()=>{const g=new StageAdmission();for(let i=0;i<8;i++){g.arm(String(i));g.consume(ctx(String(i)));g.done();}g.arm('9');expect(()=>g.consume(ctx('9'))).toThrow();expect(g.calls).toBe(8);});
});
