import {readFileSync} from 'node:fs';
import {describe,it,expect} from 'vitest';
import {boundedLimits,controlCondition,validateFixtures} from './mixed-affect-expression.ts';
import {initialState} from '../packages/character-core/src/index.ts';

const fixtures=()=>JSON.parse(readFileSync(new URL('./fixtures/mixed-affect-expression-v1.json',import.meta.url),'utf8'));
const ledger=()=>({version:1,model:'gpt-6-sol',limitUsd:3,entries:[
 {id:'3f1c4f32-41f7-42f2-b05e-dfe0d65aaaef',kind:'count' as const,status:'unknown' as const,usd:.02},
 {id:'3d0ab723-3d8e-4a76-824e-e59ef7a8dc67',kind:'dialogue' as const,status:'unknown' as const,usd:.03},
 {id:'decision-completed',kind:'decision' as const,status:'completed' as const,usd:.01},
 {id:'dialogue-completed',kind:'dialogue' as const,status:'completed' as const,usd:.01},
]});
describe('bounded mixed-affect live evaluation preflight',()=>{
 it('fixes six controls and six natural inputs with only the trusted C6 masking condition',()=>{
  const f=validateFixtures(fixtures());expect(f.controls).toHaveLength(6);expect(f.sequence).toHaveLength(6);
  expect(f.controls.filter(c=>c.expressionIntent).map(c=>c.id)).toEqual(['C6-mask-discomfort']);
 });
 it('rejects state or intent injection into the natural sequence',()=>{
  for(const extra of [{joy:.7},{expressionIntent:{joy:'show'}},{expectedStyle:{register:'formal'}}]){const f=fixtures();Object.assign(f.sequence[0],extra);expect(()=>validateFixtures(f)).toThrow('sequence_must_not_inject_state_or_intent');}
 });
 it('rejects missing affect source, unexpected hiding policy and expanded case count',()=>{
  const missing=fixtures();missing.controls[1].joySource=null;expect(()=>validateFixtures(missing)).toThrow('control_source_required');
  const intent=fixtures();intent.controls[0].expressionIntent={joy:'show',discomfort:'mask'};expect(()=>validateFixtures(intent)).toThrow('unsupported_control_intent');
  const extra=fixtures();extra.sequence.push({...extra.sequence[0],id:'extra'});expect(()=>validateFixtures(extra)).toThrow('fixed_6_plus_6_required');
 });
 it('records decay out of the high control band separately from success or technical failure',()=>{
  const state=initialState(1000);state.affect.joy.value=.7;state.affect.frustration.value=.6;
  expect(controlCondition({joy:.7,frustration:.7},state).status).toBe('REACHED');
  state.affect.joy.value=.5999;
  expect(controlCondition({joy:.7,frustration:.7},state)).toMatchObject({status:'CONDITION_NOT_REACHED',missed:[{emotion:'joy',minimum:.6,actual:.5999}]});
  expect(controlCondition({joy:0,frustration:.7},state).status).toBe('REACHED');
 });
 it('derives only twelve additional cumulative calls and never mutates old unknown reserves',()=>{
  const before=ledger(),saved=structuredClone(before),limits=boundedLimits(before);
  expect(limits).toMatchObject({decision:13,dialogue:14,usd:3});expect(before).toEqual(saved);
 });
 it('rejects missing old reserves, new unknowns and physical calls still reserved',()=>{
  const missing=ledger();missing.entries.shift();expect(()=>boundedLimits(missing)).toThrow('new_or_missing_unresolved_usage');
  const pending:any=ledger();pending.entries.push({id:'pending',kind:'decision',status:'reserved',usd:.1});expect(()=>boundedLimits(pending)).toThrow('new_or_missing_unresolved_usage');
  const unknown:any=ledger();unknown.entries.push({id:'new-unknown',kind:'dialogue',status:'unknown',usd:.1});expect(()=>boundedLimits(unknown)).toThrow('new_or_missing_unresolved_usage');
 });
 it('rejects changed budget, exhaustion, invalid costs and duplicate IDs',()=>{
  const changed=ledger();changed.limitUsd=4;expect(()=>boundedLimits(changed)).toThrow('invalid_existing_ledger');
  const exhausted=ledger();exhausted.entries[0]!.usd=3;expect(()=>boundedLimits(exhausted)).toThrow('budget_exhausted');
  const invalid=ledger();invalid.entries[0]!.usd=-1;expect(()=>boundedLimits(invalid)).toThrow('invalid_existing_ledger');
  const duplicate=ledger();duplicate.entries.push({...duplicate.entries[0]!});expect(()=>boundedLimits(duplicate)).toThrow('invalid_existing_ledger');
 });
});
