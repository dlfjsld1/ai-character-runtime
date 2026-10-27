import { randomUUID } from 'node:crypto';
import { performance } from 'node:perf_hooks';
import { Store } from '../../../../packages/database/src/store.ts';
import { selectAttention,stageExpression } from '../../../../packages/character-core/src/index.ts';
import { neutralAppraisal,type Plan,RuntimeError } from '../../../../packages/contracts/src/domain.ts';
import type {DialogueGenerator,ActivitySolver,AppraisalProvider,EventInterpreter} from '../../../../packages/contracts/src/ai-ports.ts';
import type {EventAffectAttempt} from '../../../../packages/database/src/store.ts';
import { appraisalEvaluationSchema,type AppraisalMetadata } from '../../../../packages/contracts/src/appraisal.ts';
import {budgetAppraisalConversation} from '../../../../packages/contracts/src/conversation.ts';
import {THINKING_CUE_DELAY_MS,thinkingCueAllowed,pickThinkingCue} from './thinking-cue.ts';
import {firstReactionAllowed,reactionStyle} from './first-reaction.ts';
import {FIRST_REACTION_THRESHOLD,pickFirstReaction,type Situation,type SituationClassifier} from '../../../../packages/contracts/src/first-reaction.ts';
import {dialoguePlan} from '../../../../packages/character-core/src/index.ts';
import type {KnowledgeRetriever} from '../../../../packages/contracts/src/knowledge.ts';
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
  private ticking=0;
  private cues=new Map<string,{timer:ReturnType<typeof setTimeout>;shown:boolean}>();
  private lastCue:string|null=null;
  private lastReaction:string|null=null;
  constructor(public store:Store,public provider:DialogueGenerator,public sink:Sink,public appraiser:AppraisalProvider,public solver?:ActivitySolver,public knowledge?:KnowledgeRetriever,public interpreter?:EventInterpreter,public situation?:SituationClassifier){}
  start(){this.timer=setInterval(()=>{void this.tick().catch(()=>this.sink.failure('db_unavailable'));},1000);}
  async stop(){this.stopped=true;if(this.timer)clearInterval(this.timer);for(const cue of this.cues.values())clearTimeout(cue.timer);this.cues.clear();while(this.draining||this.solving||this.dispatching||this.taskRunning||this.ticking)await new Promise(resolve=>setTimeout(resolve,5));await this.queue.catch(()=>{});}
  control<T>(fn:()=>Promise<T>):Promise<T>{const result=this.queue.then(fn,fn);this.queue=result.catch(()=>{});return result;}
  async tick(){if(this.stopped||!this.store.db.healthy)return;
    this.ticking++;try{
    if(!this.taskRunning){this.taskRunning=true;try{const task=await this.store.claimTask();if(task){const renewal=setInterval(()=>{void this.store.renewTask(task).catch(()=>this.sink.failure('db_unavailable'));},10000);try{await this.store.finishTask(task);}catch(e){await this.store.failTask(task,e instanceof RuntimeError?e.code:'task_failed');}finally{clearInterval(renewal);}}}finally{this.taskRunning=false;}}
    const session=await this.store.currentSession();if(!session||this.stopped)return;
    if(!this.draining&&!this.solving&&!await this.store.busy())await this.drain();
    if(!this.draining&&!this.solving&&!await this.store.busy()){
      const pending=(await this.store.candidates(session.id)).length;
      const activity=await this.store.activity();
      if(!pending&&activity?.status==='solving'&&activity.last_session_id===session.id){await this.solve(session.id,activity.id);return;}
      const response=await this.store.agenda(session.id,!!pending);if(response)void this.dispatch(response.id);
    }
    }finally{this.ticking--;}
  }
  async chat(sessionId:string,requestId:string,payload:any){const result=await this.store.acceptChat(sessionId,requestId,payload);this.sink.inputStatus(result.eventId,'pending');void this.drain().catch(()=>this.sink.failure('db_unavailable'));return result;}
  async drain(){if(this.draining||this.solving||this.stopped||!this.store.db.healthy)return;this.draining=true;
    try{while(!this.stopped&&!await this.store.busy()){
      const session=await this.store.currentSession();if(!session)break;const rows=await this.store.candidates(session.id);const state=await this.store.state();
      const selected=selectAttention(rows.map(e=>({id:e.id,identityId:e.identity_id,receivedAt:e.received_at.getTime(),priority:e.payload.replyToEventId?1:0})),this.store.clock(),state.body.attention.lastIdentityId,state.body.attention.consecutive);if(!selected)break;
      const request=await this.control(()=>this.store.select(selected.id));if(!request)continue;
      if(request.event.payload.intent==='knowledge'){
        this.sink.inputStatus(selected.id,'searching');await this.sink.changed();
        try{
          if(!this.knowledge||!this.provider.answerKnowledge)throw new RuntimeError('knowledge_unavailable',503);
          const revisions=await this.store.knowledgeRevisions(session.id,request.event.identity_id);
          const result=await this.knowledge.search({scope:{characterId:this.store.characterId,sessionId:session.id,identityId:request.event.identity_id},query:request.event.payload.text,limit:5});
          if(this.stopped)break;
          const committed=await this.control(()=>this.store.commitKnowledge(request,result,revisions.revision,revisions.libraryRevision));
          this.sink.inputStatus(selected.id,'observed');await this.sink.changed();void this.dispatch(committed.response.id);break;
        }catch(e){const code=e instanceof RuntimeError?e.code:'knowledge_search_failed';await this.store.failKnowledge(selected.id,code);this.sink.inputStatus(selected.id,'failed');this.sink.failure(code);await this.sink.changed();continue;}
      }
      this.sink.inputStatus(selected.id,'selected');await this.sink.changed();let appraisal=neutralAppraisal,failureCode:string|undefined;
      // The situation question runs beside the social appraisal; it never blocks the turn.
      const situation=this.situation?this.situation.classify(request.event.payload.text,this.previousTurn(request)):Promise.resolve(null);
      // Event affect runs beside the social appraisal; its failure never blocks the turn.
      const eventAffect=this.interpretAffect(request);
      let metadata:AppraisalMetadata={provider:this.appraiser.name,model:this.appraiser.model,promptVersion:this.appraiser.promptVersion};
      try{const readiness=this.appraiser.readiness();if(readiness.status==='blocked'||readiness.status==='unavailable')throw new RuntimeError(readiness.errorCode??'appraisal_unavailable',503);request.conversation=budgetAppraisalConversation(request.conversation);request.conversationContext.history=request.conversation;const activity=await this.store.activity();const result=appraisalEvaluationSchema.parse(await this.appraiser.evaluate({id:request.event.id,text:request.event.payload.text,identityId:request.event.identity_id,revision:String(request.revision)},{activity:activity?{prompt:activity.public_prompt,status:activity.status}:null,recentPraise:request.praiseSnapshot.context,conversation:request.conversation,conversationContext:request.conversationContext}));appraisal=result.appraisal;metadata=result.metadata;}
      catch(e){failureCode=e instanceof RuntimeError?e.code:'invalid_output';this.sink.failure(failureCode);}
      const firstReaction=await this.showFirstReaction(request,await situation,appraisal,metadata,!!failureCode).catch(()=>null);
      // A first reaction replaces the 4 s thinking cue for this input.
      if(!firstReaction)await this.armThinkingCue(request,appraisal,metadata,!!failureCode).catch(()=>{});
      const activity=await this.store.activity();const dialogueReady=this.provider.readiness?.();
      const memories=dialogueReady?.status==='blocked'||dialogueReady?.status==='unavailable'?[]:await this.memoryBudget(request.event.identity_id,activity?.id);
      if(this.stopped)break;
      const affect=await eventAffect;if(this.stopped)break;
      const result=await this.control(()=>this.store.commitAppraisal(request,appraisal,{...metadata,failureCode},memories.map(m=>m.id),affect,firstReaction??undefined));
      this.sink.inputStatus(selected.id,result.status==='stale'?'expired':'observed');await this.sink.changed();if(result.response){void this.dispatch(result.response.id,selected.id);break;}this.endThinkingCue(selected.id);
    }}finally{this.draining=false;}
  }
  private async interpretAffect(request:NonNullable<Awaited<ReturnType<Store['select']>>>):Promise<EventAffectAttempt|undefined>{
    if(!this.interpreter)return;
    const promptVersion=this.interpreter.promptVersion;
    try{
      const built=await this.store.affectRequest(request);if(!built)return;
      const started=performance.now(),result=await this.interpreter.interpret(built);
      return {request:built,result,promptVersion,latencyMs:Math.round(performance.now()-started)};
    }catch{return {request:null,result:{status:'unavailable',reason:'transport_failed',promptVersion},promptVersion,latencyMs:0};}
  }
  private previousTurn(request:NonNullable<Awaited<ReturnType<Store['select']>>>){
    const last=request.conversation.turns.filter(t=>t.source.id!==request.event.id).at(-1);
    return last?{speaker:(last.source.kind==='event'?'user':'character') as 'user'|'character',text:last.text}:undefined;
  }
  // Say a short first reaction from the character's reviewed lines when the
  // situation is clear (Jev, threshold 0.6) and nothing points to silence. It is
  // cleared like the cue and passed to the reply as already said.
  private async showFirstReaction(request:NonNullable<Awaited<ReturnType<Store['select']>>>,situation:Situation|null,appraisal:typeof neutralAppraisal,metadata:AppraisalMetadata,failed:boolean){
    const e=request.event;
    if(!situation||situation.category==='none'||situation.confidence<FIRST_REACTION_THRESHOLD||['quoted','other'].includes(situation.target))return null;
    if(!firstReactionAllowed(appraisal,metadata,failed,await this.store.recentlyWithheld(e.identity_id,this.store.clock())))return null;
    const set=await this.store.firstReactions(request.configVersion);const owner=this.sink.owner();if(!set||!owner||this.stopped)return null;
    // Style from the state before this turn; the reaction precedes this turn's appraisal.
    const text=pickFirstReaction(set,situation.category,reactionStyle(dialoguePlan((await this.store.state()).body,'other',e.identity_id)),this.lastReaction);if(!text)return null;
    this.lastReaction=text;this.cues.set(e.id,{timer:setTimeout(()=>{},0),shown:true});
    this.sink.sendOwner('character.reaction',{eventId:e.id,text,outputEpoch:owner.outputEpoch.toString()});
    return text;
  }
  // Show a thinking cue if the reply has not started 4 s after the input arrived.
  private async armThinkingCue(request:NonNullable<Awaited<ReturnType<Store['select']>>>,appraisal:typeof neutralAppraisal,metadata:AppraisalMetadata,failed:boolean){
    const e=request.event,now=this.store.clock();
    if(this.cues.has(e.id)||!thinkingCueAllowed(appraisal,metadata,failed,await this.store.recentlyWithheld(e.identity_id,now)))return;
    const cues=await this.store.thinkingCues(request.configVersion);if(!cues.length)return;
    const delay=Math.max(0,new Date(e.received_at).getTime()+THINKING_CUE_DELAY_MS-now);
    const timer=setTimeout(()=>{const entry=this.cues.get(e.id),owner=this.sink.owner();if(!entry||!owner||this.stopped)return;
      const text=pickThinkingCue(cues,this.lastCue);if(!text)return;this.lastCue=text;entry.shown=true;
      this.sink.sendOwner('character.thinking',{eventId:e.id,text,outputEpoch:owner.outputEpoch.toString()});},delay);
    this.cues.set(e.id,{timer,shown:false});
  }
  private endThinkingCue(eventId:string|undefined,notify=true){
    if(!eventId)return;const entry=this.cues.get(eventId);if(!entry)return;
    clearTimeout(entry.timer);this.cues.delete(eventId);
    if(entry.shown&&notify)this.sink.sendOwner('character.thinking.end',{eventId});
  }
  async memoryBudget(identityId?:string,activityId?:string){const rows=await this.store.memories(identityId,activityId);const result:any[]=[];const seen=new Set<string>();let tokens=0;
    const labels=await this.store.dialogueIdentities(rows.flatMap(m=>[...(m.participants??[]),m.facts?.identityId]));
    for(const memory of rows){if(memory.activity_run_id&&seen.has(memory.activity_run_id))continue;let count:number;try{const ids=[...(memory.participants??[]),memory.facts?.identityId];count=await this.provider.counter.countText(JSON.stringify({id:memory.id,content:memory.content,facts:memory.facts,participants:memory.participants,identities:labels.filter(label=>ids.includes(label.id))}));}catch{break;}if(tokens+count>600)continue;tokens+=count;result.push(memory);if(memory.activity_run_id)seen.add(memory.activity_run_id);if(result.length===5)break;}return result;
  }
  async dispatch(id:string,cueEventId?:string){if(this.stopped||this.blockedOutputs.has(id)||!this.store.db.healthy)return this.endThinkingCue(cueEventId);
    this.dispatching++;let started=false;
    try{const initial=await this.store.responseContext(id);if(initial.response.status!=='planned'||!initial.response.plan)return;
      const fit=await this.provider.fitConversation(initial.response.plan as Plan,initial.context);if(this.stopped||this.blockedOutputs.has(id)||!this.store.db.healthy)return;
      const prepared=await this.control(()=>this.store.fitResponseConversation(id,fit.conversation));if(!prepared)return;
      const {response,context}=prepared;
      if(context.knowledge&&!this.provider.answerKnowledge)throw new RuntimeError('knowledge_unavailable',503);
      const answer=context.knowledge?await this.provider.answerKnowledge!(response.plan as Plan,context):undefined;
      // A generator that can annotate its own suggestions does so on every ordinary reply.
      const turn=answer||!this.provider.generateTurn?undefined:await this.provider.generateTurn(response.plan as Plan,context);
      const sentences=answer?answer.sentences:turn?turn.sentences:await this.provider.dialogue(response.plan as Plan,context);if(this.stopped||this.blockedOutputs.has(id)||!this.store.db.healthy)return;
      const generated=await this.control(()=>this.store.generated(id,sentences,this.sink.owner(),answer,turn));if(!generated)return;
      const common={responseId:id,generationEpoch:generated.response.generation_epoch,outputEpoch:generated.outputEpoch.toString()};
      // The transaction above committed every segment before the first send.
      if(this.blockedOutputs.has(id)||this.stopped)return;
      // The real reply replaces the cue on Stage.
      this.endThinkingCue(cueEventId,false);started=true;
      this.sink.sendOwner('response.start',{...common,expression:stageExpression(response.plan),intensity:1,...(generated.knowledge?{knowledge:generated.knowledge}:{})});
      for(const segment of generated.segments)this.sink.sendOwner('speech.segment',{...common,segmentId:segment.id,segmentIndex:segment.index,text:segment.text,modality:'text'});
      this.sink.sendOwner('response.sealed',{...common,segmentCount:generated.segments.length});await this.sink.changed();
    }catch(e){const code=e instanceof RuntimeError?e.code:'invalid_output';await this.store.failResponse(id,code).catch(()=>{});this.sink.failure(code);await this.sink.changed();}finally{this.dispatching--;if(!started)this.endThinkingCue(cueEventId);}
  }
  // This process-wide output barrier is raised before awaiting any DB operation.
  barrier(responseId:string,reason:string,generationEpoch=0n,advanceEpoch=true){this.blockedOutputs.add(responseId);this.sink.sendOwner('response.cancel',{responseId,reason,invalidatedGenerationEpoch:generationEpoch.toString(),newGenerationEpoch:(generationEpoch+(advanceEpoch?1n:0n)).toString(),outputEpoch:(this.sink.owner()?.outputEpoch??0n).toString()});}
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
      if(!this.solver)throw new RuntimeError('activity_solver_missing',503);
      const candidate=await this.solver.solve(activityId,context);
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
