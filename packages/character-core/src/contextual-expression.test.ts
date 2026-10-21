import {it,expect} from 'vitest';
import {initialState,speechStyle,dialoguePlan,continueRegister,stageExpression} from './index.ts';
import {buildDialogueRequest} from '../../adapters/src/dialogue-request.ts';
import type {Plan} from '../../contracts/src/domain.ts';

const recipient='a';
function state(){const s=initialState(1000);s.affect.frustration.value=.7;s.affect.frustration.causes=[{eventId:'cause',targetId:recipient}];return s;}
it('CX02 sharp delivery can use casual register without modifying affect',()=>{
 const s=state(),before=structuredClone(s),style=speechStyle(s,recipient,{discomfortTone:'sharp'});
 expect(style).toMatchObject({register:'casual',discomfortTone:'sharp'});expect(s).toEqual(before);
 const plan={...dialoguePlan(s,'question',recipient),speechStyle:style};expect(stageExpression(plan)).toBe('uncomfortable');
 const text=JSON.stringify(buildDialogueRequest(plan,{},'synthetic').messages);
 expect(text).toContain('날 선');expect(text).not.toContain('비꼬거나 모욕하지 않는다');
});
it('CX01 delivered casual distance survives topic change and concealment',()=>{
 const s=state(),previous:Plan={...dialoguePlan(s,'question',recipient),speechStyle:{register:'casual',positiveTone:'neutral',discomfortTone:'sharp'}};
 const next=continueRegister(s,dialoguePlan(s,'question',recipient),previous);
 expect(next.speechStyle?.register).toBe('casual');
 const hidden=continueRegister(s,{...next,speechStyle:speechStyle(s,recipient,{joy:'mask',discomfort:'mask',embarrassment:'mask'})},previous);
 expect(hidden.speechStyle).toEqual({register:'casual',positiveTone:'neutral',concealAffect:true});
 expect(continueRegister(s,dialoguePlan(s,'question',recipient),hidden).speechStyle?.register).toBe('casual');
});
it('CX02 default public distance permits contextual expression instead of compulsory sharpness',()=>{
 expect(dialoguePlan(state(),'question',recipient).speechStyle).toMatchObject({register:'formal',discomfortTone:'contextual'});
});
it.each(['sharp','restrained','contextual'] as const)('CX03/04 %s needs a current recipient cause and visible discomfort',tone=>{
 const s=state();
 expect(speechStyle(s,'other',{discomfortTone:tone}).discomfortTone).toBeUndefined();
 expect(speechStyle(s,recipient,{discomfortTone:tone,discomfort:'mask'}).discomfortTone).toBe('masked');
 s.affect.frustration.causes=[];
 expect(speechStyle(s,recipient,{discomfortTone:tone}).discomfortTone).toBeUndefined();
});
it('CX04 concealed style overrides a contradictory injected sharp intent at rendering',()=>{
 const plan:Plan={...dialoguePlan(state(),'reengage',recipient),speechStyle:{register:'formal',positiveTone:'neutral',concealAffect:true,discomfortTone:'sharp'}};
 const text=JSON.stringify(buildDialogueRequest(plan,{},'synthetic').messages);
 expect(text).toContain('날 선 표현으로 속마음을 새로 드러내지 않는다');
 expect(text).not.toContain('날 선 말끝');expect(stageExpression(plan)).toBe('neutral');
});
it('CX01 incomplete or unrelated prior delivery cannot be inferred by pure policy',()=>{
 const s=state(),plan=dialoguePlan(s,'question',recipient);
 expect(continueRegister(s,plan,null)).toBe(plan);
 expect(continueRegister(s,plan,{...plan,targetIdentityId:'other'})).toBe(plan);
 s.affect.frustration.value=.049;
 expect(continueRegister(s,dialoguePlan(s,'question',recipient),plan).speechStyle?.register).toBe('casual');
});
it('CX01/04 casual continuity and partial hiding survive the .05-.1 recovery band',()=>{
 const s=state();let previous:Plan={...dialoguePlan(s,'question',recipient),speechStyle:speechStyle(s,recipient,{discomfortTone:'sharp'})};
 for(const value of [.08,.06,.05]){
  s.affect.frustration.value=value;
  const masked=continueRegister(s,{...dialoguePlan(s,'question',recipient),speechStyle:speechStyle(s,recipient,{discomfort:'mask'})},previous);
  expect(masked.speechStyle).toMatchObject({register:'casual',discomfortTone:'masked'});expect(stageExpression(masked)).toBe('neutral');
  previous=continueRegister(s,dialoguePlan(s,'question',recipient),masked);
  expect(previous.speechStyle).toMatchObject({register:'casual',discomfortTone:'restrained'});
 }
 s.affect.frustration.value=.049;previous=continueRegister(s,dialoguePlan(s,'question',recipient),previous);
 expect(previous.speechStyle?.discomfortTone).toBeUndefined();
 s.affect.frustration.value=.1;expect(continueRegister(s,dialoguePlan(s,'question',recipient),previous).speechStyle?.register).toBe('formal');
});
it.each([
 {name:'no other public emotion',joy:0,cautious:false,all:false,expected:'neutral'},
 {name:'public joy',joy:.7,cautious:false,all:false,expected:'happy'},
 {name:'public caution',joy:.7,cautious:true,all:false,expected:'embarrassed'},
 {name:'full concealment',joy:.7,cautious:true,all:true,expected:'neutral'},
] as const)('CX01/04 formal continuity does not disclose masked discomfort: $name',({joy,cautious,all,expected})=>{
 const s=state();s.affect.joy.value=joy;
 if(cautious){s.affect.embarrassment.value=.7;s.expression={kind:'embarrassed',since:1000};}
 const before=structuredClone(s),previous=dialoguePlan(s,'question',recipient);
 const mask=all?{joy:'mask' as const,discomfort:'mask' as const,embarrassment:'mask' as const}:{discomfort:'mask' as const};
 const current=continueRegister(s,{...dialoguePlan(s,'question',recipient),speechStyle:speechStyle(s,recipient,mask)},previous);
 expect(current.speechStyle?.register).toBe('formal');
 expect(stageExpression(current)).toBe(expected);expect(s).toEqual(before);
 const text=JSON.stringify(buildDialogueRequest(current,{},'synthetic').messages);
 expect(text).toContain('이어 오던 사무적인 존댓말을 담담하게 유지한다');expect(text).not.toContain('사무적인 존댓말로 거리를 둔다');
 if(all){expect(current.speechStyle?.concealAffect).toBe(true);expect(text).toContain('감정을 숨기는 선택이다');}
 else {
  expect(current.speechStyle?.discomfortTone).toBe('masked');expect(text).toContain('불편함을 숨기는 선택이다');expect(text).not.toContain('감정을 숨기는 선택이다');
  if(joy)expect(text).toContain('기쁜 여운을 표현한다');
  if(cautious)expect(text).toContain('당황한 여운을 조심스럽게');
 }
});
