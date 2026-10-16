import {it,expect} from 'vitest';
import * as core from './index.ts';
import type {Appraisal,EvidenceInput} from '../../contracts/src/domain.ts';
const praise:Appraisal={target:'character',act:'praise',goal_relation:'unrelated',strength:3,hostility:0,uncertain:false,evidence_refs:['current']};
it('S2-C a distinct accomplishment gets its own budget; A/B/A retains A consumption',()=>{
 const history:EvidenceInput[]=[];
 for(const [i,expected] of [.18,.09,.03,0].entries()){
  const effect=core.socialAffect(praise,history,'user',1000,undefined,'A');
  expect(effect.stimulus).toBeCloseTo(expected);
  history.push({id:String(i),identityId:'user',kind:'praise',at:1000,order:BigInt(i),affectStimulus:effect.stimulus,affectGroupId:'A'});
 }
 expect(core.socialAffect(praise,history,'user',1000,undefined,'B').stimulus).toBe(.18);
 history.push({id:'b',identityId:'user',kind:'praise',at:1000,order:5n,affectStimulus:.18,affectGroupId:'B'});
 expect(core.socialAffect(praise,history,'user',1000,undefined,'A').stimulus).toBeCloseTo(0);
 expect(core.socialAffect(praise,history,'user',601000,undefined,'A').stimulus).toBe(.18);
});
it('S2-C ungrouped pressure applies to every group; fallback and relationship remain global',()=>{
 const history:EvidenceInput[]=[{id:'old',identityId:'user',kind:'praise',at:1000,order:1n,appliedStimulus:.18,affectStimulus:.12}];
 expect(core.socialAffect(praise,history,'user',1000,undefined,'B').stimulus).toBe(.09);
 expect(core.socialAffect(praise,history,'other',1000,undefined,'B').stimulus).toBe(.18);
 history.push({...history[0]!,id:'a',order:2n,affectGroupId:'A'});
 expect(core.socialAffect(praise,history,'user',1000).stimulus).toBeCloseTo(.06);
 expect(core.socialEffect(praise,history,'user',1000).stimulus).toBe(0);
 const attack={...praise,act:'criticism' as const,hostility:3};
 const insults=history.map(e=>({...e,kind:'direct_insult' as const}));
 expect(core.socialAffect(attack,insults,'user',1000,undefined,'B')).toEqual(core.socialAffect(attack,insults,'user',1000));
});
it('S2-C selection checks every member, provenance and contradictions without merging groups',()=>{
 const groups=[{eventId:'a1',revision:'1',groupId:'A'},{eventId:'a2',revision:'1',groupId:'A'},{eventId:'b1',revision:'2',groupId:'B'}];
 const evidence=(relations:('same'|'distinct'|'unknown')[],concrete=true)=>({concrete,comparisons:groups.map((g,i)=>({eventId:g.eventId,revision:g.revision,relation:relations[i]!}))});
 expect(core.selectPraiseGroup([], {concrete:true,comparisons:[]},true)).toEqual({kind:'new'});
 expect(core.selectPraiseGroup(groups,evidence(['same','same','distinct']),true)).toEqual({kind:'existing',groupId:'A'});
 expect(core.selectPraiseGroup(groups,evidence(['distinct','distinct','distinct']),true)).toEqual({kind:'new'});
 for(const relations of [['same','distinct','distinct'],['same','same','same'],['unknown','distinct','distinct']] as const)
  expect(core.selectPraiseGroup(groups,evidence([...relations]),true)).toEqual({kind:'fallback'});
 expect(core.selectPraiseGroup(groups,evidence(['distinct','distinct','distinct'],false),true)).toEqual({kind:'fallback'});
 expect(core.selectPraiseGroup(groups,evidence(['distinct','distinct','distinct']),false)).toEqual({kind:'fallback'});
 expect(core.selectPraiseGroup([{...groups[0]!,groupId:null}],{concrete:true,comparisons:[{eventId:'a1',revision:'1',relation:'distinct'}]},true)).toEqual({kind:'fallback'});
 expect(core.selectPraiseGroup(groups,{concrete:true,comparisons:[]},true)).toEqual({kind:'fallback'});
 const changed=evidence(['same','same','distinct']);changed.comparisons[0]!.revision='99';
 expect(core.selectPraiseGroup(groups,changed,true)).toEqual({kind:'fallback'});
});
