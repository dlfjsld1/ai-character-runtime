import {z} from 'zod';

// Situation categories for a first reaction. Shared by every character: Jev
// classifies the input into one of these; the words come from the character's
// own reviewed set (character_configs.body.firstReactions), never from code.
export const FIRST_REACTION_CATEGORIES=[
  {id:'greeting',description:'인사·만남'},
  {id:'farewell',description:'작별·마무리'},
  {id:'thanks_received',description:'상대가 고마워함'},
  {id:'good_news',description:'상대의 좋은 소식·성공'},
  {id:'hardship',description:'상대의 힘든 일·피곤·속상함'},
  {id:'worry',description:'상대의 걱정·긴장'},
  {id:'surprise_interest',description:'새롭거나 신기한 이야기'},
  {id:'question_asked',description:'정보·설명을 묻는 질문'},
  {id:'request_received',description:'무언가 해 달라는 부탁'},
  {id:'recommendation_request',description:'골라 달라·추천해 달라'},
  {id:'praise_received',description:'캐릭터를 칭찬함'},
  {id:'correction_received',description:'캐릭터 말이 틀렸다·고쳐 줌'},
  {id:'apology_received',description:'상대가 사과함'},
  {id:'agreement',description:'동의·맞장구가 어울리는 말'},
  {id:'story_telling',description:'자기 이야기를 이어서 하는 중'},
  {id:'plans',description:'계획·일정 이야기'},
  {id:'joke',description:'농담·장난'},
  {id:'wait_request',description:'잠깐 기다려 달라'},
  {id:'returning',description:'다시 돌아옴'},
  {id:'unclear',description:'무엇을 말하는지 모름'},
] as const;
export type FirstReactionCategory=typeof FIRST_REACTION_CATEGORIES[number]['id'];
export const firstReactionLineSchema=z.object({
  text:z.string().trim().min(1).max(30),register:z.enum(['casual','formal']),
  tones:z.array(z.enum(['neutral','happy','embarrassed','uncomfortable'])).min(1),
}).strict();
export const firstReactionSetSchema=z.object(Object.fromEntries(FIRST_REACTION_CATEGORIES.map(c=>[c.id,z.array(firstReactionLineSchema)])) as Record<FirstReactionCategory,z.ZodArray<typeof firstReactionLineSchema>>).strict();
export type FirstReactionSet=z.infer<typeof firstReactionSetSchema>;
// Writing rules a reaction line must keep (checked when a set is generated and
// when it is loaded): speakable text only; no question except when asking what
// was meant; formal lines in the -습니다/-ㅂ니까/-십시오 style.
export function firstReactionRuleViolation(category:string,line:{text:string;register:string}):string|null{
  if(/[ㄱ-ㅎㅏ-ㅣ]|[^\p{Script=Hangul}\s.,!?…~'"·-]/u.test(line.text))return 'jamo_or_symbol';
  if(category!=='unclear'&&/\?\s*$/.test(line.text))return 'question';
  if(line.register==='formal'&&!/(니다|니까|십시오)[.!?…]*$/.test(line.text))return 'formal_style';
  return null;
}
// Loads a stored set; any schema or writing-rule violation turns the feature off.
export function parseFirstReactionSet(value:unknown):FirstReactionSet|null{
  const parsed=firstReactionSetSchema.safeParse(value);if(!parsed.success)return null;
  for(const [category,lines] of Object.entries(parsed.data))if(lines.some(l=>firstReactionRuleViolation(category,l)))return null;
  return parsed.data;
}
// Jev situation answers a reaction is shown at (2026-10-27 dev set, 60 items:
// at 0.6 with quoted/other targets excluded, 52 of 53 shown were right; the one
// miss was an utterance addressed to someone else). The user chose 0.6.
export const FIRST_REACTION_THRESHOLD=0.6;
export type ReactionTone='neutral'|'happy'|'embarrassed'|'uncomfortable';
// tones: the line tones the current state allows (see reactionStyle in the runtime).
export type ReactionStyle={register:'casual'|'formal';tones:readonly ReactionTone[]};
// A line of the category that fits the current register and tone, not the last one used.
export function pickFirstReaction(set:FirstReactionSet,category:FirstReactionCategory,style:ReactionStyle,last:string|null,random:()=>number=Math.random){
  const fitting=set[category].filter(l=>l.register===style.register&&l.tones.some(t=>style.tones.includes(t)));
  const options=fitting.length>1?fitting.filter(l=>l.text!==last):fitting;
  return options.length?options[Math.floor(random()*options.length)]!.text:null;
}
// Port: classifies the current input's situation for a first reaction.
// Implementations never throw; null means no reaction.
export type Situation={category:FirstReactionCategory|'none';confidence:number;target:string};
export interface SituationClassifier {classify(utterance:string,previous?:{speaker:'user'|'character';text:string}):Promise<Situation|null>}
