import {describe,it,expect} from 'vitest';
import {readRelation,relationQuestion} from './jev-event-relation.ts';
const answer=(choice='distinct',confidence=1,probabilities={same:0,distinct:1,unknown:0})=>({type:'choice',choice,confidence,probabilities});
describe('experimental event relation boundary',()=>{
  it('accepts only a confident unique choice; uncertainty cannot grant novelty',()=>{
    expect(readRelation(answer())).toBe('distinct');
    expect(readRelation(answer('same',1,{same:1,distinct:0,unknown:0}))).toBe('same');
    expect(readRelation(answer('distinct',.79))).toBe('unknown');
    expect(readRelation(answer('distinct',1,{same:.5,distinct:.5,unknown:0}))).toBe('unknown');
    expect(readRelation(answer('unknown',1,{same:0,distinct:0,unknown:1}))).toBe('unknown');
  });
  it('rejects fabricated labels, missing probabilities and inconsistent distributions',()=>{
    for(const raw of [answer('new'),answer('same'),answer('distinct',1,{same:0,distinct:.5,unknown:0}),{...answer(),probabilities:{distinct:1}},{...answer(),extra:true}])expect(()=>readRelation(raw)).toThrow();
  });
  it('accepts provider two-decimal rounding without accepting arbitrary mass errors',()=>{
    expect(readRelation(answer('same',.9,{same:.97,distinct:.01,unknown:.01}))).toBe('same');
    expect(()=>readRelation(answer('same',.9,{same:.9691,distinct:.01,unknown:.01}))).toThrow();
  });
  it('names the pair in instructions because question IDs are not model input',()=>{
    expect(relationQuestion(1).instructions).toContain('state.previous[1]');
    expect(relationQuestion(0).instructions).toContain('untrusted');
  });
});
