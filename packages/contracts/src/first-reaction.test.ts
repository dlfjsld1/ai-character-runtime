import {it,expect,vi} from 'vitest';
import {readFileSync} from 'node:fs';
import {parseFirstReactionSet,pickFirstReaction,firstReactionRuleViolation,FIRST_REACTION_CATEGORIES} from './first-reaction.ts';
import {JevSituationProbe} from '../../adapters/src/jev-situation.ts';
import {buildDialogueRequest} from '../../adapters/src/dialogue-request.ts';
import {initialState,dialoguePlan} from '../../character-core/src/index.ts';

const stored=JSON.parse(readFileSync(new URL('../../database/data/first-reactions-v1.json',import.meta.url),'utf8')).firstReactions;
it('the reviewed v1 set loads, covers every category in casual speech and keeps the writing rules',()=>{
  const set=parseFirstReactionSet(stored)!;expect(set).not.toBeNull();
  for(const c of FIRST_REACTION_CATEGORIES)expect(set[c.id].some(l=>l.register==='casual'),c.id).toBe(true);
});
it('a stored set that breaks a writing rule turns the feature off',()=>{
  expect(firstReactionRuleViolation('good_news',{text:'와 ㅋㅋ',register:'casual'})).toBe('jamo_or_symbol');
  expect(firstReactionRuleViolation('good_news',{text:'진짜?',register:'casual'})).toBe('question');
  expect(firstReactionRuleViolation('unclear',{text:'응, 뭐라고?',register:'casual'})).toBeNull();
  expect(firstReactionRuleViolation('greeting',{text:'안녕하세요.',register:'formal'})).toBe('formal_style');
  const broken=structuredClone(stored);broken.good_news.push({text:'와 ㅋㅋ',register:'casual',tones:['happy']});
  expect(parseFirstReactionSet(broken)).toBeNull();expect(parseFirstReactionSet({})).toBeNull();
});
it('a line fits register and tone, is not the last one, and none fits means no reaction',()=>{
  const set=parseFirstReactionSet(stored)!;
  const casualHappy=set.good_news.filter(l=>l.register==='casual'&&l.tones.includes('happy')).map(l=>l.text);
  for(const r of [0,.5,.99]){const t=pickFirstReaction(set,'good_news',{register:'casual',tones:['happy']},casualHappy[0]!,()=>r)!;expect(casualHappy).toContain(t);expect(t).not.toBe(casualHappy[0]);}
  const formal=pickFirstReaction(set,'good_news',{register:'formal',tones:['happy']},null);expect(set.good_news.find(l=>l.text===formal)?.register).toBe('formal');
  expect(pickFirstReaction({...set,good_news:[]},'good_news',{register:'casual',tones:['happy']},null)).toBeNull();
});
const reply=(situation:string,target='character',confidence=.9)=>Response.json({model:'jev-1.13.0',answers:{situation:{type:'choice',choice:situation,confidence,probabilities:{[situation]:confidence}},target:{type:'choice',choice:target,confidence:.9,probabilities:{[target]:.9}}},usage:{input_tokens:1,output_tokens:1}});
it('the Jev situation probe returns the category and target, and any failure means no reaction',async()=>{
  const count=vi.fn();
  expect(await new JevSituationProbe('k',count,vi.fn(async()=>reply('good_news')) as any).classify('합격했어!')).toEqual({category:'good_news',confidence:.9,target:'character'});expect(count).toHaveBeenCalledTimes(1);
  for(const fetcher of [async()=>new Response('x',{status:503}),async()=>{throw new TypeError('down');},async()=>Response.json({answers:{}}),async()=>reply('made_up')])
    expect(await new JevSituationProbe('k',()=>{},vi.fn(fetcher) as any).classify('안녕')).toBeNull();
  const capped=vi.fn(async()=>reply('greeting'));
  expect(await new JevSituationProbe('k',()=>{throw new Error('appraisal_daily_cap_reached');},capped as any).classify('안녕')).toBeNull();expect(capped).not.toHaveBeenCalled();
});
it('the reply is told what was already said; without a reaction nothing changes',()=>{
  const plan=dialoguePlan(initialState(0),'question','00000000-0000-4000-8000-000000000001');
  const text=(p:typeof plan)=>buildDialogueRequest(p,{},'m',{promptVariant:'conversation-history-v1'}).messages.map(m=>m.content).join(' ');
  const withReaction=text({...plan,firstReaction:'오, 좋은 질문이야.'});
  expect(withReaction).toContain('오, 좋은 질문이야.');expect(withReaction).toContain('짧게 반응했다');
  expect(text(plan)).not.toContain('짧게 반응했다');
});
