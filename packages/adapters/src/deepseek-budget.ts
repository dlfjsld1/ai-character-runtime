import {readFileSync,writeFileSync,renameSync,openSync,closeSync,unlinkSync,existsSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
import {z} from 'zod';
import {RuntimeError} from '../../contracts/src/domain.ts';

// Peak/cache-miss rates checked 2026-10-17. Reservations are guards, not invoices.
export const deepseekCandidate={model:'deepseek-flash',inputUsdPerMillion:.3,outputUsdPerMillion:1.2,inputBound:32768} as const;
const integer=z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
const usageSchema=z.object({prompt_tokens:integer,completion_tokens:integer}).strict();
const entrySchema=z.object({id:z.string().min(1),authorization:z.string().min(1),day:z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),status:z.enum(['reserved','completed','unknown']),usd:z.number().finite().nonnegative(),inputBound:integer,maxOutputTokens:integer.min(1).max(2048),usage:usageSchema.optional()}).strict();
const ledgerSchema=z.object({version:z.literal(1),provider:z.literal('deepseek'),model:z.literal('deepseek-flash'),inputUsdPerMillion:z.literal(.3),outputUsdPerMillion:z.literal(1.2),limitUsd:z.number().finite().positive(),entries:z.array(entrySchema)}).strict();
export type DeepSeekUsage=z.infer<typeof usageSchema>;
type Ledger=z.infer<typeof ledgerSchema>;
export function deepseekInputBound(value:unknown){return Buffer.byteLength(typeof value==='string'?value:JSON.stringify(value),'utf8')+1024;}
export function deepseekReservationUsd(inputBound:number,maxOutputTokens:number){
  if(!Number.isSafeInteger(inputBound)||inputBound<1||inputBound>deepseekCandidate.inputBound||!Number.isSafeInteger(maxOutputTokens)||maxOutputTokens<1||maxOutputTokens>2048)throw new RuntimeError('deepseek_context_limit',400);
  return (inputBound*deepseekCandidate.inputUsdPerMillion+maxOutputTokens*deepseekCandidate.outputUsdPerMillion)/1e6;
}
// period 'daily' applies the USD and call limits per local calendar day (the
// same day as DailyCallCap); entries recorded before days were stored count as
// past days. Unresolved entries from any day still block.
export class DeepSeekBudget {
  constructor(readonly path:string,readonly limitUsd:number,readonly maxCalls:number,readonly authorization:string,readonly period:'total'|'daily'='total',private readonly clock:()=>number=Date.now){
    if(!path||!Number.isFinite(limitUsd)||limitUsd<=0||!Number.isSafeInteger(maxCalls)||maxCalls<1||!authorization.trim())throw new RuntimeError('deepseek_budget_authorization_required',400);
  }
  private read():Ledger{
    try{
      const ledger=ledgerSchema.parse(JSON.parse(readFileSync(this.path,'utf8')));
      if(ledger.limitUsd!==this.limitUsd||new Set(ledger.entries.map(e=>e.id)).size!==ledger.entries.length)throw new Error();
      return ledger;
    }catch(error){if((error as NodeJS.ErrnoException).code==='ENOENT')return {version:1,provider:'deepseek',...deepseekCandidateFields(),limitUsd:this.limitUsd,entries:[]};throw new RuntimeError('deepseek_budget_invalid',503);}
  }
  private transaction<T>(fn:(ledger:Ledger)=>T){
    let fd:number;try{fd=openSync(this.path+'.lock','wx');}catch{throw new RuntimeError('deepseek_budget_locked',503);}
    try{const ledger=this.read(),result=fn(ledger);writeFileSync(this.path+'.tmp',JSON.stringify(ledger,null,2)+'\n');renameSync(this.path+'.tmp',this.path);return result;}
    finally{closeSync(fd);unlinkSync(this.path+'.lock');}
  }
  private today(){return new Date(this.clock()).toLocaleDateString('sv');}
  private counted(ledger:Ledger){const day=this.today();return this.period==='daily'?ledger.entries.filter(e=>e.day===day):ledger.entries;}
  private check(ledger:Ledger){
    if(ledger.entries.some(e=>e.status!=='completed'))throw new RuntimeError('deepseek_usage_unconfirmed',503);
    if(this.counted(ledger).length>=this.maxCalls)throw new RuntimeError('deepseek_attempt_limit',503);
    if(this.counted(ledger).reduce((sum,e)=>sum+e.usd,0)>=this.limitUsd)throw new RuntimeError('deepseek_budget_exceeded',503);
  }
  availability(){try{if(existsSync(this.path+'.lock'))throw new RuntimeError('deepseek_budget_locked',503);this.check(this.read());return null;}catch(e){return e instanceof RuntimeError?e.code:'deepseek_budget_invalid';}}
  summary(){if(existsSync(this.path+'.lock'))throw new RuntimeError('deepseek_budget_locked',503);const ledger=this.read(),counted=this.counted(ledger),reservedUsd=counted.reduce((sum,e)=>sum+e.usd,0);return {provider:'deepseek',billingVerified:false,limitUsd:this.limitUsd,enforcedTotalUsd:reservedUsd,remainingGuardUsd:Math.max(0,this.limitUsd-reservedUsd),attempts:counted.length,unresolvedEntries:ledger.entries.filter(e=>e.status!=='completed').length};}
  reserve(inputBound:number,maxOutputTokens:number){const usd=deepseekReservationUsd(inputBound,maxOutputTokens);return this.transaction(ledger=>{
    this.check(ledger);if(this.counted(ledger).reduce((sum,e)=>sum+e.usd,0)+usd>this.limitUsd)throw new RuntimeError('deepseek_budget_exceeded',503);
    const id=randomUUID();ledger.entries.push({id,authorization:this.authorization,day:this.today(),status:'reserved',usd,inputBound,maxOutputTokens});return id;
  });}
  finish(id:string,usage?:DeepSeekUsage){return this.transaction(ledger=>{
    const entry=ledger.entries.find(e=>e.id===id);if(!entry||entry.status!=='reserved')throw new RuntimeError('deepseek_budget_invalid',503);
    const parsed=usageSchema.safeParse(usage);
    if(!parsed.success){entry.status='unknown';return false;}
    entry.usage=parsed.data;const usd=(parsed.data.prompt_tokens*.3+parsed.data.completion_tokens*1.2)/1e6;
    if(parsed.data.prompt_tokens>entry.inputBound||parsed.data.completion_tokens>entry.maxOutputTokens||usd>entry.usd){entry.usd=Math.max(entry.usd,usd);entry.status='unknown';return false;}
    entry.usd=usd;entry.status='completed';return true;
  });}
}
function deepseekCandidateFields(){const {model,inputUsdPerMillion,outputUsdPerMillion}=deepseekCandidate;return {model,inputUsdPerMillion,outputUsdPerMillion};}
