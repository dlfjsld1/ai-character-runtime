// Drafts a persona's first-reaction lines per situation category with Claude,
// for human review. Not part of the runtime: run when a persona is created or
// changed; the reviewed set is stored in that config version.
// Usage: node --experimental-transform-types scripts/generate-first-reactions.ts --out <file.json> [--config-version 1]
import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import {parseEnv} from 'node:util';
import {loadLocalEnv} from './env.ts';
import {parseConfig} from '../packages/contracts/src/local-config.ts';
import {Database} from '../packages/database/src/connection.ts';
import {CHARACTER_ID} from '../packages/database/src/seed.ts';
import {ClaudeBudget} from '../packages/adapters/src/claude-budget.ts';
import {claudeKey} from '../apps/runtime/src/providers.ts';
import Anthropic from '@anthropic-ai/sdk';
import {FIRST_REACTION_CATEGORIES,firstReactionSetSchema,firstReactionRuleViolation} from '../packages/contracts/src/first-reaction.ts';

const arg=(name:string)=>{const i=process.argv.indexOf(name);return i>0?process.argv[i+1]:undefined;};
const out=arg('--out');if(!out||existsSync(out))throw new Error('--out <new file> required');
const ledgerOverride=arg('--ledger');
loadLocalEnv();const config=parseConfig(process.env),version=arg('--config-version')??'1';
const db=new Database(config.DATABASE_URL);
const persona=(await db.pool.query('SELECT text FROM character_persona_values WHERE character_id=$1 AND config_version=$2 ORDER BY ordinal',[CHARACTER_ID,version])).rows.map(r=>r.text as string);
await db.close();if(!persona.length)throw new Error('persona_missing');
const tones=['neutral','happy','embarrassed','uncomfortable'];
// One flat list keeps the structured-output grammar small (a per-category
// object schema was rejected as too large); lines are grouped afterwards.
const line={type:'object',properties:{category:{type:'string',enum:FIRST_REACTION_CATEGORIES.map(c=>c.id)},text:{type:'string'},register:{type:'string',enum:['casual','formal']},tones:{type:'array',items:{type:'string',enum:tones}}},required:['category','text','register','tones'],additionalProperties:false};
const schema={type:'object',properties:{lines:{type:'array',items:line}},required:['lines'],additionalProperties:false};
const system=`너는 대화 캐릭터의 "첫 반응" 문장을 쓴다. 첫 반응은 상대 말을 듣자마자 1초 안에 내는 아주 짧은 말이고, 내용 있는 대답은 바로 뒤에 따로 이어진다.
조건:
- 캐릭터 성격(persona)에 맞는 말투로 쓴다. 성격을 드러내되 과장하지 않는다.
- 사실, 약속, 답, 판단, 조언을 담지 않는다. 어떤 대답이 이어져도 어긋나지 않는 중립적인 반응만 쓴다.
- 한국어, 대략 20자 이내, 한 문장 또는 감탄 하나.
- 범주마다 반말(casual) 4~6개와 존댓말(formal) 1~2개를 쓴다. 같은 범주 안에서 서로 확실히 다르게 쓴다.
- 질문으로 끝내지 않는다(이어지는 대답이 그 질문을 다루지 않을 수 있다). 단, unclear 범주는 되묻는 말을 쓴다.
- 소리 내어 읽을 수 있게 쓴다. ㅋㅋ·ㅎㅎ 같은 자모, 이모티콘, 기호를 쓰지 않는다.
- 존댓말(formal)은 \"~습니다/~입니다\"체로 쓴다.
- tones에는 그 문장이 어울리는 표정을 고른다(neutral, happy, embarrassed, uncomfortable 중).`;
const user=JSON.stringify({persona,categories:FIRST_REACTION_CATEGORIES});
const model='claude-opus-5-5' as const,budget=new ClaudeBudget(ledgerOverride??config.CLAUDE_BUDGET_PATH,config.CLAUDE_BUDGET_USD,config.CLAUDE_MAX_CALLS,config.CLAUDE_BUDGET_AUTHORIZATION);
const body={model,max_tokens:16000,system,messages:[{role:'user' as const,content:user}],output_config:{effort:'medium' as const,format:{type:'json_schema' as const,schema}}};
const id=budget.reserve(model,Buffer.byteLength(JSON.stringify(body))+1024,16000);
const client=new Anthropic({apiKey:claudeKey(config),maxRetries:0,timeout:300000});
let message:Anthropic.Message;
try{message=await client.messages.create(body);}
catch(e){
  if(e instanceof Anthropic.APIError&&typeof e.status==='number'){budget.finish(id,{input_tokens:0,output_tokens:0,cache_creation_input_tokens:0,cache_read_input_tokens:0});console.error('api_error',e.status,String(e.message).slice(0,400));process.exit(1);}
  budget.finish(id);throw e;
}
const u=message.usage;budget.finish(id,{input_tokens:u.input_tokens,output_tokens:u.output_tokens,cache_creation_input_tokens:u.cache_creation_input_tokens??0,cache_read_input_tokens:u.cache_read_input_tokens??0});
const text=message.content.find((b):b is Anthropic.TextBlock=>b.type==='text')?.text;
if(message.stop_reason!=='end_turn'||!text)throw new Error('generation_incomplete:'+message.stop_reason);
const flat=JSON.parse(text).lines as {category:string;text:string;register:string;tones:string[]}[];
const lines=Object.fromEntries(FIRST_REACTION_CATEGORIES.map(c=>[c.id,flat.filter(l=>l.category===c.id).map(({category:_c,...rest})=>rest)]));
// The writing rules are checked here too; a line that breaks one is dropped and reported.
const dropped:{category:string;text:string;rule:string}[]=[];
for(const [category,list] of Object.entries(lines) as [string,{text:string;register:string;tones:string[]}[]][])lines[category]=list.filter(l=>{
  const rule=firstReactionRuleViolation(category,l);
  if(rule)dropped.push({category,text:l.text,rule});return !rule;});
const parsed=firstReactionSetSchema.safeParse(lines);if(!parsed.success)console.error('schema_issues',JSON.stringify(parsed.error.issues.slice(0,5)));
writeFileSync(out,JSON.stringify({status:'DRAFT_FOR_REVIEW',configVersion:version,persona,model,generatedAt:new Date().toISOString(),firstReactions:lines,dropped},null,2));
console.log(JSON.stringify({out,lines:Object.values(lines).flat().length,dropped:dropped.length,usage:{input:u.input_tokens,output:u.output_tokens}}));
