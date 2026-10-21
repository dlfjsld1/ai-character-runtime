import {readFileSync,writeFileSync,mkdirSync,renameSync,existsSync} from 'node:fs';
import {dirname} from 'node:path';
import {RuntimeError} from '../../contracts/src/domain.ts';
import type {AppraisalProvider,AppraisalEvent,AppraisalContext,AppraisalReadiness} from '../../contracts/src/ai-ports.ts';

// Caps appraisal attempts per local calendar day. Every attempt counts once
// before the call, including failures; there is no pending state, so a
// timeout never locks later turns or later days.
export class DailyCallCap implements AppraisalProvider{
  readonly name:string;readonly model:string;readonly promptVersion:string;
  constructor(private readonly inner:AppraisalProvider,private readonly path:string,private readonly maxCalls:number,private readonly clock:()=>number=Date.now){
    this.name=inner.name;this.model=inner.model;this.promptVersion=inner.promptVersion;
  }
  private today(){return new Date(this.clock()).toLocaleDateString('sv');}
  private used(){
    if(!existsSync(this.path))return 0;
    const value=JSON.parse(readFileSync(this.path,'utf8')) as {day?:unknown;calls?:unknown};
    if(typeof value.day!=='string'||!Number.isSafeInteger(value.calls)||(value.calls as number)<0)throw new RuntimeError('appraisal_call_count_invalid',503);
    return value.day===this.today()?value.calls as number:0;
  }
  private blocked(){try{return this.used()>=this.maxCalls?'appraisal_daily_cap_reached':null;}catch{return 'appraisal_call_count_invalid';}}
  readiness():AppraisalReadiness{const code=this.blocked(),inner=this.inner.readiness();return code?{status:'blocked',inferenceVerified:inner.inferenceVerified,errorCode:code}:inner;}
  async evaluate(event:AppraisalEvent,context:AppraisalContext){
    const code=this.blocked();if(code)throw new RuntimeError(code,503);
    mkdirSync(dirname(this.path),{recursive:true});
    const next=this.path+'.tmp';writeFileSync(next,JSON.stringify({day:this.today(),calls:this.used()+1}));renameSync(next,this.path);
    return this.inner.evaluate(event,context);
  }
}
