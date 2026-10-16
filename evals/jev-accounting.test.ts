import {it,expect,vi} from 'vitest';
import {randomUUID} from 'node:crypto';
import {JevAppraisalProvider,type JevCall} from '../packages/adapters/src/jev.ts';
import {recordedJevResponse} from './jev-fixture.ts';
import {summarizeJevCalls} from './jev-accounting.ts';

const event={id:randomUUID(),identityId:randomUUID(),text:'합성 질문'};
const options={localOnly:false,allowPaidProviders:true,apiKey:'synthetic-test-key'};
it('Q07 records the usage of an invalid response and never retries',async()=>{
 const raw=recordedJevResponse();raw.usage.input_tokens=1569;
 raw.answers.act.choice='question';raw.answers.act.confidence=.33;
 raw.answers.act.probabilities={greeting:0,question:.39,praise:.01,criticism:0,teasing:.4,hint:0,help_offer:0,decline:0,other:.04,unknown:.16};
 const calls:JevCall[]=[],fetcher=vi.fn(async()=>Response.json(raw));
 const provider=new JevAppraisalProvider({...options,onCall:call=>calls.push(call)},fetcher);
 await expect(provider.evaluate(event,{})).rejects.toMatchObject({code:'jev_invalid_output'});
 expect(fetcher).toHaveBeenCalledTimes(1);
 expect(calls).toEqual([{callId:1,httpStatus:200,usageStatus:'reported',usage:raw.usage,errorCode:'jev_invalid_output'}]);
 expect(JSON.stringify(calls)).not.toMatch(/synthetic-test-key|합성 질문|Authorization/);
});
it('Q07 accounts success and failure once for both runners',async()=>{
 const good=recordedJevResponse();good.usage.input_tokens=1555;
 const bad=recordedJevResponse();bad.usage.input_tokens=1569;bad.answers.act.choice='teasing';
 const calls:JevCall[]=[],fetcher=vi.fn().mockResolvedValueOnce(Response.json(good)).mockResolvedValueOnce(Response.json(bad));
 const provider=new JevAppraisalProvider({...options,onCall:call=>calls.push(call)},fetcher);
 const result=await provider.evaluate(event,{});
 await expect(provider.evaluate(event,{})).rejects.toMatchObject({code:'jev_invalid_output'});
 expect(summarizeJevCalls(calls)).toMatchObject({attemptedCalls:2,validEvaluations:1,knownInputTokens:3124,inputTokens:3124,unknownUsageCalls:0,costEstimateComplete:true});
 expect(summarizeJevCalls(calls).estimatedKnownCostUsd).toBe(3124*.042/1e6);
 expect(calls.map(c=>c.callId)).toEqual([1,2]);expect(result.metadata.usage!.input_tokens).toBe(1555);
});
it.each(['missing-usage','bad-usage','non-json','http','oversized'])('Q07 %s is unknown usage, never free confirmed cost',async kind=>{
 const raw:any=recordedJevResponse();if(kind==='missing-usage')delete raw.usage;if(kind==='bad-usage')raw.usage.input_tokens=-1;
 const response=kind==='http'?new Response('private error',{status:429}):kind==='non-json'?new Response('private body'):kind==='oversized'?new Response('x'.repeat(65537)):Response.json(raw);
 const calls:JevCall[]=[],fetcher=vi.fn(async()=>response),provider=new JevAppraisalProvider({...options,onCall:call=>calls.push(call)},fetcher);
 await expect(provider.evaluate(event,{})).rejects.toBeDefined();
 expect(fetcher).toHaveBeenCalledTimes(1);expect(summarizeJevCalls(calls)).toMatchObject({attemptedCalls:1,validEvaluations:0,unknownUsageCalls:1,costEstimateComplete:false,knownInputTokens:0});
 expect(JSON.stringify(calls)).not.toContain('private');
});
it('Q07 rejected input or disabled provider records no attempted request',async()=>{
 const onCall=vi.fn(),fetcher=vi.fn();
 await expect(new JevAppraisalProvider({...options,onCall},fetcher).evaluate({...event,text:'x'.repeat(1001)},{})).rejects.toMatchObject({code:'jev_input_too_large'});
 await expect(new JevAppraisalProvider({...options,onCall,localOnly:true},fetcher).evaluate(event,{})).rejects.toMatchObject({code:'jev_paid_api_disabled'});
 expect(fetcher).not.toHaveBeenCalled();expect(onCall).not.toHaveBeenCalled();
});
it('Q07 timeout emits once and late success cannot rewrite the record',async()=>{
 let finish!:(response:Response)=>void;const calls:JevCall[]=[];
 const fetcher=vi.fn(()=>new Promise<Response>(r=>{finish=r;}));
 const provider=new JevAppraisalProvider({...options,onCall:call=>calls.push(call)},fetcher,5);
 await expect(provider.evaluate(event,{})).rejects.toMatchObject({code:'jev_timeout'});
 const snapshot=JSON.stringify(calls);finish(Response.json(recordedJevResponse()));await new Promise(r=>setTimeout(r,10));
 expect(JSON.stringify(calls)).toBe(snapshot);expect(calls).toHaveLength(1);
 expect(summarizeJevCalls(calls)).toMatchObject({unknownUsageCalls:1,validEvaluations:0,costEstimateComplete:false});
 expect(provider.readiness().errorCode).toBe('jev_timeout');
});
it.each([false,true])('Q07 observer failure is explicit and preserves original error (invalid=%s)',async invalid=>{
 const raw=recordedJevResponse();if(invalid)raw.answers.act.choice='teasing';
 const calls:JevCall[]=[],onCall=vi.fn((call:JevCall)=>{calls.push(call);throw new Error('private observer details');});
 const provider=new JevAppraisalProvider({...options,onCall},async()=>Response.json(raw));
 await expect(provider.evaluate(event,{})).rejects.toMatchObject({code:invalid?'jev_invalid_output':'jev_call_recording_failed',observationError:'jev_call_recording_failed'});
 expect(onCall).toHaveBeenCalledTimes(1);expect(provider.readiness().status).toBe('unavailable');
 expect(summarizeJevCalls(calls)).toMatchObject({validEvaluations:0,observationFailures:1});
});
