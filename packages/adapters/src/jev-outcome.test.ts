import {it,expect,vi} from 'vitest';
import {JevOutcomeProbe,JEV_OUTCOME_THRESHOLD} from './jev-outcome.ts';
import {validateEventInterpretation} from '../../contracts/src/affect-appraisal.ts';
import {affectRequest,affectSource,affectNow} from '../../../evals/affect-fixture.ts';

const choice=(value:string,confidence=.95)=>({type:'choice',choice:value,confidence,probabilities:{[value]:confidence}});
const reply=(ref:string,use='used',result='favorable',conf=.95)=>Response.json({model:'jev-1.13.0',answers:{action_ref:choice(ref,conf),action_use:choice(use,conf),action_result:choice(result,conf)},usage:{input_tokens:1,output_tokens:1}});
function withEpisode(){const r=affectRequest();r.experience.status='found';r.sources.push(affectSource(20,'episode','단계별 목록으로 나눠 봐.',affectNow-1000));return r;}
const probe=(fetcher:any,count=vi.fn())=>({p:new JevOutcomeProbe('jev-test-key',count,fetcher),count});

it('decides a confident outcome with verbatim evidence the contract accepts',async()=>{
  const request=withEpisode(),fetcher=vi.fn(async()=>reply('a0'));const {p,count}=probe(fetcher);
  const d=await p.decide(request);expect(d.accepted).toBe(true);expect(count).toHaveBeenCalledTimes(1);
  if(!d.accepted)return;expect(d.outcome).toMatchObject({use:'used',result:'favorable'});
  expect(validateEventInterpretation({status:'uncertain',outcome:d.outcome,appraisals:[]},request).outcome).toEqual(d.outcome);
});
it('no eligible episode needs no call; a confident "none" is decided as no outcome',async()=>{
  const fetcher=vi.fn(async()=>reply('none'));const {p}=probe(fetcher);
  expect(await p.decide(affectRequest())).toEqual({accepted:true,outcome:null});expect(fetcher).not.toHaveBeenCalled();
  expect(await p.decide(withEpisode())).toEqual({accepted:true,outcome:null});
});
it.each([
  ['ambiguous',async()=>reply('ambiguous'),'ambiguous'],
  ['low confidence',async()=>reply('a0','used','favorable',JEV_OUTCOME_THRESHOLD-.01),'low_confidence'],
  ['http error',async()=>new Response('x',{status:503}),'jev_http_503'],
  ['network failure',async()=>{throw new TypeError('down');},'jev_unavailable'],
  ['malformed',async()=>Response.json({answers:{}}),'jev_invalid_output'],
  ['unknown episode',async()=>reply('a7'),'jev_invalid_output'],
])('%s falls back instead of deciding',async(_n,impl,reason)=>{
  const {p}=probe(vi.fn(impl as any));expect(await p.decide(withEpisode())).toEqual({accepted:false,reason});
});
it('the daily cap stops the call and falls back',async()=>{
  const fetcher=vi.fn(async()=>reply('a0'));const {p}=probe(fetcher,vi.fn(()=>{throw Object.assign(new Error('cap'),{code:'appraisal_daily_cap_reached'});}));
  expect((await p.decide(withEpisode())).accepted).toBe(false);expect(fetcher).not.toHaveBeenCalled();
});
it('an unobserved use never carries a completed result',async()=>{
  const {p}=probe(vi.fn(async()=>reply('a0','not_used','favorable')));const d=await p.decide(withEpisode());
  expect(d).toMatchObject({accepted:true,outcome:{use:'not_used',result:'pending'}});
});
