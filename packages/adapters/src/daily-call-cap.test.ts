import {it,expect,vi} from 'vitest';
import {mkdtempSync,rmSync,writeFileSync,readFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {DailyCallCap} from './daily-call-cap.ts';
import {parseConfig} from '../../contracts/src/local-config.ts';
import {createProviders} from '../../../apps/runtime/src/providers.ts';
import type {AppraisalProvider} from '../../contracts/src/ai-ports.ts';

const event={id:'e',text:'안녕',identityId:'u'};
const fake=(evaluate:AppraisalProvider['evaluate'])=>({name:'jev',model:'m',promptVersion:'p',readiness:()=>({status:'ready' as const,inferenceVerified:true,errorCode:null}),evaluate});

it('counts every attempt, failures included, blocks at the cap and resets on the next local day',async()=>{
  const dir=mkdtempSync(join(tmpdir(),'appraisal-cap-'));
  try{
    let now=new Date(2026,9,22,23,0).getTime();
    const inner=vi.fn(async()=>{throw new Error('provider down');});
    const cap=new DailyCallCap(fake(inner),join(dir,'nested','calls.json'),2,()=>now);
    expect(cap).toMatchObject({name:'jev',model:'m',promptVersion:'p'});
    for(let i=0;i<2;i++)await expect(cap.evaluate(event,{})).rejects.toThrow('provider down');
    expect(cap.readiness()).toMatchObject({status:'blocked',errorCode:'appraisal_daily_cap_reached'});
    await expect(cap.evaluate(event,{})).rejects.toMatchObject({code:'appraisal_daily_cap_reached'});
    expect(inner).toHaveBeenCalledTimes(2);
    now=new Date(2026,9,23,0,1).getTime();
    expect(cap.readiness().status).toBe('ready');
    await expect(cap.evaluate(event,{})).rejects.toThrow('provider down');
    expect(JSON.parse(readFileSync(join(dir,'nested','calls.json'),'utf8'))).toEqual({day:'2026-10-23',calls:1});
  }finally{rmSync(dir,{recursive:true,force:true});}
});
it('an unreadable count blocks instead of calling the provider',async()=>{
  const dir=mkdtempSync(join(tmpdir(),'appraisal-cap-'));
  try{
    const path=join(dir,'calls.json');writeFileSync(path,'{"day":"2026-10-22","calls":-1}');
    const inner=vi.fn();const cap=new DailyCallCap(fake(inner),path,5);
    expect(cap.readiness()).toMatchObject({status:'blocked',errorCode:'appraisal_call_count_invalid'});
    await expect(cap.evaluate(event,{})).rejects.toMatchObject({code:'appraisal_call_count_invalid'});expect(inner).not.toHaveBeenCalled();
  }finally{rmSync(dir,{recursive:true,force:true});}
});
it('config wraps the configured appraiser only when a cap is set, and a cap needs a path',()=>{
  const base={LOCAL_ONLY:'false',ALLOW_PAID_PROVIDERS:'true',TYPESAFE_API_KEY:'synthetic'};
  expect(createProviders(parseConfig(base),{}).appraiser).not.toBeInstanceOf(DailyCallCap);
  expect(createProviders(parseConfig({...base,APPRAISAL_DAILY_MAX_CALLS:'500',APPRAISAL_CALL_COUNT_PATH:join(tmpdir(),'unused-calls.json')}),{}).appraiser).toBeInstanceOf(DailyCallCap);
  expect(()=>parseConfig({...base,APPRAISAL_DAILY_MAX_CALLS:'500'})).toThrow();
});
