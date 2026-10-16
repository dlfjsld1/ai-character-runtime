import {it,expect} from 'vitest';
import {randomUUID} from 'node:crypto';
import * as Core from './index.ts';
import type {Plan} from '../../contracts/src/domain.ts';

const identity=randomUUID(),cause=randomUUID();
function state(value:number){const s=Core.initialState(1000);s.affect.frustration.value=value;s.affect.frustration.causes=[{eventId:cause,targetId:identity}];return s;}
const previous=():Plan=>Core.dialoguePlan(state(.18),'question',identity);
it('RC01 hiding keeps an already delivered formal register without disclosing affect',()=>{
 const s=state(.7),before=structuredClone(s),plan={...Core.dialoguePlan(s,'reengage',identity),speechStyle:Core.speechStyle(s,identity,{joy:'mask',discomfort:'mask',embarrassment:'mask'})};
 const kept=Core.continueRegister(s,plan,previous());
 expect(kept.speechStyle).toEqual({register:'formal',positiveTone:'neutral',concealAffect:true});
 expect(Core.stageExpression(kept)).toBe('neutral');expect(s).toEqual(before);expect(plan.speechStyle?.register).toBe('casual');
});
it.each([.1,.099,.06,.05])('RC02 delivered formality persists through the recovery band %s',value=>{
 const s=state(value);for(const purpose of ['question','acknowledge_repair','praise'])expect(Core.continueRegister(s,Core.dialoguePlan(s,purpose,identity),previous()).speechStyle?.register).toBe('formal');
});
it('RC03 real recovery releases formality and does not reenter on a small rebound',()=>{
 const s=state(.049),released=Core.continueRegister(s,Core.dialoguePlan(s,'question',identity),previous());
 expect(released.speechStyle?.register).toBe('casual');s.affect.frustration.value=.08;
 expect(Core.continueRegister(s,Core.dialoguePlan(s,'question',identity),released).speechStyle?.register).toBe('casual');
 s.affect.frustration.value=.1;expect(Core.continueRegister(s,Core.dialoguePlan(s,'question',identity),released).speechStyle?.register).toBe('formal');
});
it('RC04 no prior delivery, other recipient, removed cause and legacy plans do not retain formality',()=>{
 const s=state(.08),plan=Core.dialoguePlan(s,'question',identity);
 expect(Core.continueRegister(s,plan,null).speechStyle?.register).toBe('casual');
 expect(Core.continueRegister(s,plan,{...previous(),targetIdentityId:randomUUID()}).speechStyle?.register).toBe('casual');
 s.affect.frustration.causes=[];expect(Core.continueRegister(s,plan,previous()).speechStyle?.register).toBe('casual');
 expect(Core.continueRegister(s,{...plan,speechStyle:undefined},previous()).speechStyle).toBeUndefined();
});
