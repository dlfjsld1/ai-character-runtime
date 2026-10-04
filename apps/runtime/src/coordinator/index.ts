import { randomUUID } from 'node:crypto';
import { performance } from 'node:perf_hooks';
import { Store } from '../../../../packages/database/src/store.ts';
import { selectAttention } from '../../../../packages/character-core/src/index.ts';
import { neutralAppraisal,type Plan,RuntimeError } from '../../../../packages/contracts/src/domain.ts';
import type { Provider } from '../../../../packages/adapters/src/ollama.ts';
import type { AppraisalProvider } from '../../../../packages/adapters/src/appraisal.ts';
import { appraisalEvaluationSchema,type AppraisalMetadata } from '../../../../packages/contracts/src/appraisal.ts';
export type OutputOwner={clientId:string;outputEpoch:bigint};
export interface Sink {
  owner():OutputOwner|null;
  changed():Promise<void>;
  sendOwner(type:string,payload:object):void;
  inputStatus(eventId:string,status:string):void;
  failure(code:string):void;
}
export class Coordinator {
  private draining=false;
  private solving=false;
  private taskRunning=false;
  private pausedActivity=new Map<string,string>();
  private stopped=false;
  private blockedOutputs=new Set<string>();
  private queue:Promise<unknown>=Promise.resolve();
  private timer:ReturnType<typeof setInterval>|null=null;
  private dispatching=0;
  constructor(public store:Store,public provider:Provider,public sink:Sink,public appraiser:AppraisalProvider){}
  start(){this.timer=setInterval(()=>{void this.tick().catch(()=>this.sink.failure('db_unavailable'));},1000);}
  async stop(){this.stopped=true;if(this.timer)clearInterval(this.timer);while(this.draining||this.solving||this.dispatching||this.taskRunning)await new Promise(resolve=>setTimeout(resolve,5));await this.queue.catch(()=>{});}
  control<T>(fn:()=>Promise<T>):Promise<T>{const result=this.queue.then(fn,fn);this.queue=result.catch(()=>{});return result;}
  async tick(){if(this.stopped||!this.store.db.healthy)return;
    if(!this.taskRunning){this.taskRunning=true;try{const task=await this.store.claimTask();if(task){const renewal=setInterval(()=>{void this.store.renewTask(task).catch(()=>this.sink.failure('db_unavailable'));},10000);try{await this.store.finishTask(task);}catch(e){await this.store.failTask(task,e instanceof RuntimeError?e.code:'task_failed');}finally{clearInterval(renewal);}}}finally{this.taskRunning=false;}}
    const session=await this.store.currentSession();if(!session)return;
    if(!this.draining&&!this.solving&&!await this.store.busy())await this.drain();
    if(!this.draining&&!this.solving&&!await this.store.busy()){
      const pending=(await this.store.candidates(session.id)).length;
      const activity=await this.store.activity();
      if(!pending&&activity?.status==='solving'&&activity.last_session_id===session.id){await this.solve(session.id,activity.id);return;}
      const response=await this.store.agenda(session.id,!!pending);if(response)void this.dispatch(response.id);
    }
  }
  async chat(sessionId:string,requestId:string,payload:any){const result=await this.store.acceptChat(sessionId,requestId,payload);this.sink.inputStatus(result.eventId,'pending');void this.drain().catch(()=>this.sink.failure('db_unavailable'));return result;}
  async drain(){if(this.draining||this.solving||this.stopped||!this.store.db.healthy)return;this.draining=true;
    try{while(!this.stopped&&!await this.store.busy()){
      const session=await this.store.currentSession();if(!session)break;const rows=await this.store.candidates(session.id);const state=await this.store.state();
      const selected=selectAttention(rows.map(e=>({id:e.id,identityId:e.identity_id,receivedAt:e.received_at.getTime(),priority:e.payload.replyToEventId?1:0})),this.store.clock(),state.body.attention.lastIdentityId,state.body.attention.consecutive);if(!selected)break;
      const request=await this.control(()=>this.store.select(selected.id));if(!request)continue;
      this.sink.inputStatus(selected.id,'selected');await this.sink.changed();let appraisal=neutralAppraisal,failureCode:string|undefined;
      let metadata:AppraisalMetadata={provider:this.appraiser.name,model:this.appraiser.model,promptVersion:this.appraiser.promptVersion};
      try{const activity=await this.store.activity();const result=appraisalEvaluationSchema.parse(await this.appraiser.evaluate({id:request.event.id,text:request.event.payload.text,identityId:request.event.identity_id},{activity:activity?{prompt:activity.public_prompt,status:activity.status}:null}));appraisal=result.appraisal;metadata=result.metadata;}
      catch(e){failureCode=e instanceof RuntimeError?e.code:'invalid_output';this.sink.failure(failureCode);}
      const activity=await this.store.activity();const memories=await this.memoryBudget(request.event.identity_id,activity?.id);
      if(this.stopped)break;
      const result=await this.control(()=>this.store.commitAppraisal(request,appraisal,{...metadata,failureCode},memories.map(m=>m.id)));
      this.sink.inputStatus(selected.id,result.status==='stale'?'expired':'observed');await this.sink.changed();if(result.response){void this.dispatch(result.response.id);break;}
    }}finally{this.draining=false;}
  }
  async memoryBudget(identityId?:string,activityId?:string){const rows=await this.store.memories(identityId,activityId);const result:any[]=[];const seen=new Set<string>();let tokens=0;
    for(const memory of rows){if(memory.activity_run_id&&seen.has(memory.activity_run_id))continue;let count:number;try{count=await this.provider.counter.countText(JSON.stringify({id:memory.id,content:memory.content,facts:memory.facts,participants:memory.participants}));}catch{break;}if(tokens+count>600)continue;tokens+=count;result.push(memory);if(memory.activity_run_id)seen.add(memory.activity_run_id);if(result.length===5)break;}return result;
  }
  async dispatch(id:string){if(this.stopped||this.blockedOutputs.has(id)||!this.store.db.healthy)return;
    this.dispatching++;
    try{const {response,context}=await this.store.responseContext(id);if(response.status!=='planned'||!response.plan)return;
      const sentences=await this.provider.dialogue(response.plan as Plan,context);if(this.stopped||this.blockedOutputs.has(id)||!this.store.db.healthy)return;
      const generated=await this.control(()=>this.store.generated(id,sentences,this.sink.owner()));if(!generated)return;
      const common={responseId:id,generationEpoch:generated.response.generation_epoch,outputEpoch:generated.outputEpoch.toString()};
      // The transaction above committed every segment before the first send.
      if(this.blockedOutputs.has(id)||this.stopped)return;
      this.sink.sendOwner('response.start',{...common,expression:response.plan.expression,intensity:1});
      for(const segment of generated.segments)this.sink.sendOwner('speech.segment',{...common,segmentId:segment.id,segmentIndex:segment.index,text:segment.text,modality:'text'});
      this.sink.sendOwner('response.sealed',{...common,segmentCount:generated.segments.length});await this.sink.changed();
    }catch(e){const code=e instanceof RuntimeError?e.code:'invalid_output';await this.store.failResponse(id,code).catch(()=>{});this.sink.failure(code);await this.sink.changed();}finally{this.dispatching--;}
  }
  // This process-wide output barrier is raised before awaiting any DB operation.
  barrier(responseId:string,reason:string,generationEpoch=0n){this.blockedOutputs.add(responseId);this.sink.sendOwner('response.cancel',{responseId,reason,invalidatedGenerationEpoch:generationEpoch.toString(),newGenerationEpoch:(generationEpoch+1n).toString(),outputEpoch:(this.sink.owner()?.outputEpoch??0n).toString()});}
  async cancel(sessionId:string,requestId:string,responseId:string,reason='operator_stop'){
    const {response}=await this.store.responseContext(responseId);if(response.session_id!==sessionId||!['planned','generating','synthesizing','delivering'].includes(response.status))throw new RuntimeError('stale_response');
    this.barrier(responseId,reason,BigInt(response.generation_epoch));const result=await this.control(()=>this.store.cancel(sessionId,requestId,reason,responseId));await this.sink.changed();return result;
  }
  async cancelAll(sessionId:string,reason:string){const active=(await this.store.db.pool.query("SELECT id,generation_epoch FROM response_runs WHERE character_id=$1 AND session_id=$2 AND status IN ('planned','generating','synthesizing','delivering')",[this.store.characterId,sessionId])).rows;for(const r of active)this.barrier(r.id,reason,BigInt(r.generation_epoch));}
  async solve(sessionId:string,activityId:string){if(this.solving||this.draining||this.stopped||await this.store.busy())return;this.solving=true;
    let version:string|undefined;
    try{const {activity,context}=await this.store.activityContext(activityId);version=activity.version;
      if(activity.status!=='solving'||activity.last_session_id!==sessionId||activity.auto_attempts_used>=activity.auto_attempts_granted||this.pausedActivity.get(activityId)===version)return;
      const state=await this.store.state();const expected={generationEpoch:state.generationEpoch,activityVersion:BigInt(activity.version)};
      const lastJudgement=[...context.steps].reverse().find(x=>x.kind==='answer_judged');
      if(lastJudgement?.verdict==='incorrect'&&activity.hints_used===0){const response=await this.control(()=>this.store.needsHint(sessionId,activityId,expected));if(response)void this.dispatch(response.id);return;}
      const candidate=await this.provider.solve(activityId,context);
      if(this.stopped)return;
      if(candidate.needs_hint||candidate.candidate_answer===null){
        const response=await this.control(()=>this.store.needsHint(sessionId,activityId,expected));
        if(response)void this.dispatch(response.id);else this.pausedActivity.set(activityId,version!);
        await this.sink.changed();return;
      }
      const result=await this.control(()=>this.store.submitCandidate(sessionId,activityId,candidate.candidate_answer!,expected,randomUUID()));await this.sink.changed();
      if(result.response)await this.dispatch(result.response.id);
    }catch(e){const code=e instanceof RuntimeError?e.code:'invalid_output';if(code!=='output_busy'&&version!==undefined)this.pausedActivity.set(activityId,version);this.sink.failure(code);}
    finally{this.solving=false;}
  }
  async delivered(){await this.sink.changed();void this.tick().catch(()=>this.sink.failure('db_unavailable'));}
}
