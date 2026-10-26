import {readFileSync,writeFileSync,renameSync,openSync,closeSync,unlinkSync,existsSync,mkdirSync} from 'node:fs';
import {dirname} from 'node:path';
import {randomUUID} from 'node:crypto';
import {z} from 'zod';
import {RuntimeError} from '../../contracts/src/domain.ts';

// First-party list prices checked 2026-10-26 (USD per million tokens). Cache
// writes are priced at 1.25x input. Reservations are guards, not invoices.
// Haiku 5.5 is billed at its prompts-over-100K rate here (the higher tier) and
// its cache reads at the full input rate: no smaller rate was confirmed.
export const claudeModels={
  'claude-opus-5-5':{input:4,output:20,cacheRead:.2},
  'claude-sonnet-5-5':{input:2,output:10,cacheRead:.2},
  'claude-haiku-5-5':{input:.5,output:2.5,cacheRead:.5},
} as const;
export type ClaudeModel=keyof typeof claudeModels;
export const isClaudeModel=(value:string):value is ClaudeModel=>Object.hasOwn(claudeModels,value);
// A UTF-8 byte count bounds the token count of the same text from above.
export const claudeInputBoundLimit=400000;
export function claudeInputBound(value:unknown){return Buffer.byteLength(typeof value==='string'?value:JSON.stringify(value),'utf8')+1024;}
const integer=z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
const usageSchema=z.object({input_tokens:integer,output_tokens:integer,cache_creation_input_tokens:integer,cache_read_input_tokens:integer}).strict();
const entrySchema=z.object({id:z.string().min(1),authorization:z.string().min(1),day:z.string().regex(/^\d{4}-\d{2}-\d{2}$/),model:z.string().min(1),
  status:z.enum(['reserved','completed','unknown']),usd:z.number().finite().nonnegative(),inputBound:integer,maxOutputTokens:integer.min(1),usage:usageSchema.optional()}).strict();
const ledgerSchema=z.object({version:z.literal(1),provider:z.literal('anthropic'),limitUsd:z.number().finite().positive(),entries:z.array(entrySchema)}).strict();
export type ClaudeUsage=z.infer<typeof usageSchema>;
type Ledger=z.infer<typeof ledgerSchema>;
export function claudeUsageUsd(model:ClaudeModel,usage:ClaudeUsage){
  const p=claudeModels[model];
  return (usage.input_tokens*p.input+usage.cache_creation_input_tokens*p.input*1.25+usage.cache_read_input_tokens*p.cacheRead+usage.output_tokens*p.output)/1e6;
}
export function claudeReservationUsd(model:ClaudeModel,inputBound:number,maxOutputTokens:number){
  if(!Number.isSafeInteger(inputBound)||inputBound<1||inputBound>claudeInputBoundLimit||!Number.isSafeInteger(maxOutputTokens)||maxOutputTokens<1||maxOutputTokens>32000)throw new RuntimeError('claude_context_limit',400);
  const p=claudeModels[model];return (inputBound*p.input*1.25+maxOutputTokens*p.output)/1e6;
}
// USD and call limits apply per local calendar day (same day as DailyCallCap).
// An entry whose usage is unresolved blocks every later call, on any day.
export class ClaudeBudget {
  constructor(readonly path:string,readonly limitUsd:number,readonly maxCalls:number,readonly authorization:string,private readonly clock:()=>number=Date.now){
    if(!path||!Number.isFinite(limitUsd)||limitUsd<=0||!Number.isSafeInteger(maxCalls)||maxCalls<1||!authorization.trim())throw new RuntimeError('claude_budget_authorization_required',400);
  }
  private today(){return new Date(this.clock()).toLocaleDateString('sv');}
  private read():Ledger{
    try{
      const ledger=ledgerSchema.parse(JSON.parse(readFileSync(this.path,'utf8')));
      if(new Set(ledger.entries.map(e=>e.id)).size!==ledger.entries.length)throw new Error();
      // The configured daily cap is authoritative; the file records the latest one.
      ledger.limitUsd=this.limitUsd;return ledger;
    }catch(error){if((error as NodeJS.ErrnoException).code==='ENOENT')return {version:1,provider:'anthropic',limitUsd:this.limitUsd,entries:[]};throw new RuntimeError('claude_budget_invalid',503);}
  }
  private transaction<T>(fn:(ledger:Ledger)=>T){
    mkdirSync(dirname(this.path),{recursive:true});
    let fd:number;try{fd=openSync(this.path+'.lock','wx');}catch{throw new RuntimeError('claude_budget_locked',503);}
    try{const ledger=this.read(),result=fn(ledger);writeFileSync(this.path+'.tmp',JSON.stringify(ledger,null,2)+'\n');renameSync(this.path+'.tmp',this.path);return result;}
    finally{closeSync(fd);unlinkSync(this.path+'.lock');}
  }
  private counted(ledger:Ledger){const day=this.today();return ledger.entries.filter(e=>e.day===day);}
  private check(ledger:Ledger){
    if(ledger.entries.some(e=>e.status!=='completed'))throw new RuntimeError('claude_usage_unconfirmed',503);
    if(this.counted(ledger).length>=this.maxCalls)throw new RuntimeError('claude_attempt_limit',503);
    if(this.counted(ledger).reduce((sum,e)=>sum+e.usd,0)>=this.limitUsd)throw new RuntimeError('claude_budget_exceeded',503);
  }
  availability(){try{if(existsSync(this.path+'.lock'))throw new RuntimeError('claude_budget_locked',503);this.check(this.read());return null;}catch(e){return e instanceof RuntimeError?e.code:'claude_budget_invalid';}}
  summary(){const ledger=this.read(),today=this.counted(ledger),usd=today.reduce((sum,e)=>sum+e.usd,0);return {provider:'anthropic',billingVerified:false,day:this.today(),limitUsd:this.limitUsd,todayUsd:usd,remainingGuardUsd:Math.max(0,this.limitUsd-usd),todayAttempts:today.length,unresolvedEntries:ledger.entries.filter(e=>e.status!=='completed').length};}
  reserve(model:ClaudeModel,inputBound:number,maxOutputTokens:number){const usd=claudeReservationUsd(model,inputBound,maxOutputTokens);return this.transaction(ledger=>{
    this.check(ledger);if(this.counted(ledger).reduce((sum,e)=>sum+e.usd,0)+usd>this.limitUsd)throw new RuntimeError('claude_budget_exceeded',503);
    const id=randomUUID();ledger.entries.push({id,authorization:this.authorization,day:this.today(),model,status:'reserved',usd,inputBound,maxOutputTokens});return id;
  });}
  // Unknown usage, or usage above the reservation, stays unresolved and blocks.
  finish(id:string,usage?:unknown){return this.transaction(ledger=>{
    const entry=ledger.entries.find(e=>e.id===id);if(!entry||entry.status!=='reserved'||!isClaudeModel(entry.model))throw new RuntimeError('claude_budget_invalid',503);
    const parsed=usageSchema.safeParse(usage);
    if(!parsed.success){entry.status='unknown';return false;}
    entry.usage=parsed.data;const usd=claudeUsageUsd(entry.model,parsed.data);
    if(parsed.data.output_tokens>entry.maxOutputTokens||usd>entry.usd){entry.usd=Math.max(entry.usd,usd);entry.status='unknown';return false;}
    entry.usd=usd;entry.status='completed';return true;
  });}
}
