import {it,expect} from 'vitest';
import {socialAffect,socialEffect,initialState,apply,chooseSocial,projectRelationships} from './index.ts';
import {neutralAppraisal,type EvidenceInput} from '../../contracts/src/domain.ts';
const praise={...neutralAppraisal,target:'character' as const,act:'praise' as const,strength:3,uncertain:false};
const entry=(at:number,stimulus:number,extra:Partial<EvidenceInput>={}):EvidenceInput=>({id:`event-${at}`,identityId:'a',kind:'praise',at,order:1n,strength:3,appliedStimulus:stimulus,...extra});
it('C2-H1 repetition pressure recovers continuously across the old 600-second boundary',()=>{
 const history=[entry(0,.18)];
 const values=[0,150000,300000,599999,600000,600001].map(now=>socialAffect(praise,history,'a',now).stimulus);
 expect(values[0]).toBe(.09);expect(values[1]).toBeGreaterThan(values[0]);expect(values[2]).toBeGreaterThan(values[1]);
 expect(values[4]-values[3]).toBeLessThan(.000001);expect(values[4]).toBe(.18);expect(values[5]).toBe(.18);
});
it('C2-H1 simultaneous repetition retains the cap, with gradual recovery after rest',()=>{
 const history:EvidenceInput[]=[];const values=[];
 for(let i=0;i<4;i++){const effect=socialAffect(praise,history,'a',0);values.push(effect.stimulus);history.push(entry(0,effect.stimulus,{id:`e${i}`,order:BigInt(i)}));}
 expect(values).toEqual([.18,.09,.02999999999999997,0]);
 expect(socialAffect(praise,history,'a',15000).stimulus).toBeGreaterThan(0);
 expect(socialAffect(praise,history,'a',300000).stimulus).toBeGreaterThan(socialAffect(praise,history,'a',15000).stimulus);
 expect(socialAffect(praise,history,'a',600000).stimulus).toBe(.18);
});
it('C2-H2 actual affect consumption is distinct from recomputed relationship consumption',()=>{
 const history=[entry(0,0,{affectStimulus:.30})];expect(socialAffect(praise,history,'a',0).stimulus).toBe(0);
 expect(socialEffect(praise,history,'a',0).stimulus).toBe(.09);
 expect(socialAffect(praise,[entry(0,.30,{affectStimulus:0})],'a',0).stimulus).toBe(.09);
 expect(socialAffect(praise,[entry(0,.30)],'a',0).stimulus).toBe(0);
});
it('C2-H1 long repetition cannot exhaust another identity, another emotion, or response participation',()=>{
 const history:EvidenceInput[]=[];
 for(let i=0;i<720;i++){const at=i*15000,effect=socialAffect(praise,history,'a',at);history.push(entry(at,0,{id:`e${i}`,order:BigInt(i),affectStimulus:effect.stimulus}));}
 const now=720*15000;expect(socialAffect(praise,history,'b',now).stimulus).toBe(.18);
 expect(socialAffect({...praise,act:'criticism',hostility:3},history,'a',now).stimulus).toBe(.18);
 expect(socialAffect(praise,history,'a',now+600000).stimulus).toBe(.18);
 const exhausted=socialAffect(praise,[entry(now,.3)],'a',now);
 expect(chooseSocial(initialState(now),praise,exhausted,'a',now).participation).toEqual({mode:'speak'});
 const state=apply(initialState(now),{eventId:'10000000-0000-4000-8000-000000000009',targetId:null,now,stimuli:{surprise:.25}});expect(state.affect.surprise.value).toBe(.25);
});
it('C2-H2 relationship v1 replay is unaffected by affect consumption, and future/foreign evidence is ignored',()=>{
 const history=[entry(0,.18),entry(300000,.09),entry(601000,.09)];
 expect(projectRelationships(history)).toEqual(projectRelationships(history.map(e=>({...e,affectStimulus:0}))));
 expect(socialAffect(praise,[entry(1,.3),entry(0,.3,{identityId:'b'})],'a',0).stimulus).toBe(.18);
 for(const a of [{...praise,uncertain:true},{...praise,target:'quoted' as const},{...praise,target:'other' as const}])expect(socialAffect(a,history,'a',602000).stimulus).toBe(0);
});

