import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import type pg from 'pg';
import { Database } from './connection.ts';
import { characterState } from './schema.ts';
import { CHARACTER_ID } from './seed.ts';
import { stateSchema,neutralAppraisal,RuntimeError,type State,type Appraisal,type Plan,type EvidenceInput,type AffectEvidence,type SilenceRecord } from '../../contracts/src/domain.ts';
import { appraisalMetadataSchema,evidenceEnvelopeSchema,type AppraisalMetadata } from '../../contracts/src/appraisal.ts';
import { apply,applyRepair,decay,socialEffect,socialAffect,selectPraiseGroup,chooseSocial,dialoguePlan,continueRegister,projectRelationships,koreanDate,agendaEligible,type SocialContext } from '../../character-core/src/index.ts';
import { normalizeAnswer,judge } from '../../adapters/src/puzzle.ts';
import type {AppraisalEvidenceVerifier,DialogueContext,RecentPraise,PraiseGroupSource} from '../../contracts/src/ai-ports.ts';
import {conversationSnapshotSchema,conversationRefsSchema,conversationContextSchema,isConversationSuffix,canAttemptRepair,type ConversationSnapshot,type ConversationRefs,type ConversationContext,type ConversationEvidence} from '../../contracts/src/conversation.ts';
import type {KnowledgeSearchResult} from '../../contracts/src/knowledge.ts';
import type {DialogueKnowledge,KnowledgeAnswer} from '../../contracts/src/ai-ports.ts';
import {currentKnowledgeRevision,knowledgeFences,listKnowledgeDocuments,putKnowledgeDocument,deleteKnowledgeDocument,type KnowledgePut} from './knowledge-store.ts';
import {readPersonalFacts,changePersonalFact} from './personal-fact-store.ts';
import {personalFactChangeSchema,personalFactSnapshotSchema,type PersonalFactChange} from '../../contracts/src/personal-facts.ts';
import {eventAffectRecordSchema,type AffectSource,type EventAffectRecord,type EventInterpretationRequest,type EventInterpretationResult} from '../../contracts/src/affect-appraisal.ts';
import {appendEventAffect,projectEventAffect,removeEventAffectSources,eventAffectStimuli,eventAffectPolicy} from '../../character-core/src/event-affect.ts';
import {actionEpisodeSchema,confirmDeliveredRecommendation,episodeAffectSource,type DialogueTurn} from '../../contracts/src/outcomes.ts';
type Client=pg.PoolClient;
type Row=Record<string,any>;
export type VersionedState={body:State;version:bigint;generationEpoch:bigint;configVersion:bigint;snapshotAt:Date};
const activeResponses="('planned','generating','synthesizing','delivering')";
export type EventAffectAttempt={request:EventInterpretationRequest|null;result:EventInterpretationResult;promptVersion:string;latencyMs:number};
// Contributions halve every 20 minutes; older records cannot move the snapshot.
const affectWindowMs=6*3600000;
// Delivered suggestions the interpreter may link to a later report: the newest
// five within thirty days. More than five marks the read truncated.
const episodeWindowMs=30*86400000,episodeLimit=5;
export class Store {
  constructor(public db:Database,public characterId=CHARACTER_ID,public clock=()=>Date.now(),private evidenceVerifier?:AppraisalEvidenceVerifier){}
  async state():Promise<VersionedState>{const rows=await this.db.orm.select().from(characterState).where(eq(characterState.characterId,this.characterId));const r=rows[0];if(!r)throw new RuntimeError('character_not_found',404);return {...r,body:stateSchema.parse(r.body)};}
  async locked<T>(fn:(c:Client,s:VersionedState)=>Promise<T>):Promise<T>{return this.db.transaction(async c=>{const r=(await c.query('SELECT * FROM character_state WHERE character_id=$1 FOR UPDATE',[this.characterId])).rows[0];if(!r)throw new RuntimeError('character_not_found',404);return fn(c,{body:stateSchema.parse(r.body),version:BigInt(r.version),generationEpoch:BigInt(r.generation_epoch),configVersion:BigInt(r.config_version),snapshotAt:r.snapshot_at});});}
  private async session(c:Client,id:string,requireActive=true){const r=(await c.query('SELECT * FROM sessions WHERE id=$1 AND character_id=$2 FOR UPDATE',[id,this.characterId])).rows[0];if(!r)throw new RuntimeError('session_not_found',404);if(requireActive&&r.status!=='active')throw new RuntimeError('session_closed');return r;}
  private now(s:VersionedState){return Math.max(this.clock(),s.snapshotAt.getTime(),s.body.mood.asOf);}
  private async event(c:Client,sessionId:string,kind:string,key:string,payload:object|null,identityId:string|null=null,parentId:string|null=null,namespace='core'):Promise<Row>{
    const id=randomUUID(),now=new Date(this.clock());
    const r=await c.query("INSERT INTO events(id,character_id,session_id,identity_id,parent_event_id,source_namespace,source_key,kind,occurred_at,received_at,observed_at,applied_at,attention_status,data_status,revision,schema_version,payload) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$9,$9,$9,'observed','active',1,1,$10) ON CONFLICT(character_id,source_namespace,source_key) DO NOTHING RETURNING *",[id,this.characterId,sessionId,identityId,parentId,namespace,key,kind,now,payload??{}]);
    if(r.rowCount)return r.rows[0];
    const previous=(await c.query('SELECT *, payload=$4::jsonb AS same_payload FROM events WHERE character_id=$1 AND source_namespace=$2 AND source_key=$3',[this.characterId,namespace,key,payload??{}])).rows[0];
    if(!previous.same_payload||previous.session_id!==sessionId||previous.kind!==kind||previous.identity_id!==identityId||previous.parent_event_id!==parentId)throw new RuntimeError('idempotency_conflict');
    return {...previous,duplicate:true};
  }
  private async bump(c:Client,s:VersionedState,event:Row,body:State,effects:object={},appraisalId:string|null=null){
    if((await c.query('SELECT 1 FROM transitions WHERE character_id=$1 AND source_event_id=$2',[this.characterId,event.id])).rowCount)return;
    const now=this.now(s);s.version++;
    await c.query("INSERT INTO transitions(id,character_id,source_event_id,appraisal_id,state_version,config_version,core_version,evaluated_at,effects,replay_status) VALUES($1,$2,$3,$4,$5,$6,'core-rules-v1',$7,$8,'available')",[randomUUID(),this.characterId,event.id,appraisalId,s.version.toString(),s.configVersion.toString(),new Date(now),effects]);
    s.body=stateSchema.parse(body);s.snapshotAt=new Date(now);
    await c.query('UPDATE character_state SET version=$2,generation_epoch=$3,snapshot_at=$4,body=$5 WHERE character_id=$1',[this.characterId,s.version.toString(),s.generationEpoch.toString(),s.snapshotAt,s.body]);
  }
  async currentSession(){return (await this.db.pool.query("SELECT * FROM sessions WHERE character_id=$1 AND status='active'",[this.characterId])).rows[0]??null;}
  async startSession(sessionId:string,requestId:string,configVersion='1') {
    return this.locked(async(c,s)=>{
      const existing=(await c.query('SELECT * FROM sessions WHERE id=$1',[sessionId])).rows[0];
      if(existing&&(existing.character_id!==this.characterId||existing.config_version!==configVersion))throw new RuntimeError('idempotency_conflict');
      const command=(await c.query("SELECT * FROM events WHERE character_id=$1 AND source_namespace='studio:session.start' AND source_key=$2",[this.characterId,requestId])).rows[0];
      if(command){if(command.session_id!==sessionId||command.payload.configVersion!==configVersion)throw new RuntimeError('idempotency_conflict');return {eventId:command.id,sessionId,status:'duplicate'};}
      if(existing)throw new RuntimeError('idempotency_conflict');
      await c.query("INSERT INTO sessions(id,character_id,config_version,status,visibility,started_at) VALUES($1,$2,$3,'active','test_public',$4)",[sessionId,this.characterId,configVersion,new Date(this.now(s))]);
      const event=await this.event(c,sessionId,'session.started',requestId,{sessionId,configVersion},null,null,'studio:session.start');
      s.body=decay(s.body,this.now(s));s.body.workingMemoryEventIds=[];s.body.attention.eventId=null;s.body.turn.listening=false;
      await this.bump(c,s,event,s.body);return {eventId:event.id,sessionId,status:'committed'};
    });
  }
  async acceptChat(sessionId:string,requestId:string,payload:{identityId:string;text:string;replyToEventId?:string;intent?:'knowledge'}) {
    return this.db.transaction(async c=>{
      const session=(await c.query('SELECT status FROM sessions WHERE character_id=$1 AND id=$2 FOR UPDATE',[this.characterId,sessionId])).rows[0];
      if(!session||session.status!=='active')throw new RuntimeError('session_closed');
      if(!(await c.query('SELECT 1 FROM identities WHERE id=$1',[payload.identityId])).rowCount)throw new RuntimeError('identity_not_found',404);
      if(payload.replyToEventId&&!(await c.query("SELECT 1 FROM events WHERE id=$1 AND character_id=$2 AND session_id=$3 AND data_status='active'",[payload.replyToEventId,this.characterId,sessionId])).rowCount)throw new RuntimeError('invalid_reply',400);
      const count=await c.query("SELECT count(*) FROM events WHERE character_id=$1 AND session_id=$2 AND attention_status='pending' AND received_at>now()-interval '20 seconds'",[this.characterId,sessionId]);
      const namespace=`studio:chat:${sessionId}`;
      const prior=(await c.query('SELECT *,payload=$4::jsonb AS same_payload FROM events WHERE character_id=$1 AND source_namespace=$2 AND source_key=$3',[this.characterId,namespace,requestId,payload])).rows[0];
      if(prior){if(!prior.same_payload)throw new RuntimeError('idempotency_conflict');return {status:'duplicate',eventId:prior.id};}
      if(Number(count.rows[0].count)>=100)throw new RuntimeError('busy',429);
      const id=randomUUID(),now=new Date(this.clock());
      const insert=await c.query("INSERT INTO events(id,character_id,session_id,identity_id,source_namespace,source_key,kind,occurred_at,received_at,attention_status,data_status,revision,schema_version,payload) VALUES($1,$2,$3,$4,$5,$6,'chat.final',$7,$7,'pending','active',1,1,$8) ON CONFLICT(character_id,source_namespace,source_key) DO NOTHING RETURNING id",[id,this.characterId,sessionId,payload.identityId,namespace,requestId,now,payload]);
      if(!insert.rowCount){const row=(await c.query('SELECT id,payload=$4::jsonb AS same_payload FROM events WHERE character_id=$1 AND source_namespace=$2 AND source_key=$3',[this.characterId,namespace,requestId,payload])).rows[0];if(!row.same_payload)throw new RuntimeError('idempotency_conflict');return {status:'duplicate',eventId:row.id};}
      await c.query('UPDATE sessions SET last_user_input_at=$2 WHERE id=$1',[sessionId,now]);return {status:'committed',eventId:id};
    });
  }
  async candidates(sessionId:string){await this.db.pool.query("UPDATE events SET attention_status='expired' WHERE character_id=$1 AND session_id=$2 AND attention_status='pending' AND received_at<=$3",[this.characterId,sessionId,new Date(this.clock()-20000)]);return (await this.db.pool.query("SELECT * FROM events WHERE character_id=$1 AND session_id=$2 AND attention_status='pending' AND data_status='active' ORDER BY received_at,id LIMIT 100",[this.characterId,sessionId])).rows;}
  async select(eventId:string){return this.locked(async(c,s)=>{
    const e=(await c.query("SELECT * FROM events WHERE character_id=$1 AND id=$2 AND data_status='active' AND attention_status='pending' FOR UPDATE",[this.characterId,eventId])).rows[0];if(!e)return null;
    await this.session(c,e.session_id);if(e.received_at.getTime()<=this.clock()-20000){await c.query("UPDATE events SET attention_status='expired' WHERE id=$1",[e.id]);return null;}
    const phase=await this.event(c,e.session_id,'attention.selected',`attention_selected:${e.id}`,{eventId:e.id},e.identity_id,e.id);
    await c.query("UPDATE events SET attention_status='selected',observed_at=$2 WHERE id=$1",[e.id,new Date(this.now(s))]);
    const body=apply(s.body,{eventId:e.id,targetId:e.identity_id,now:this.now(s),observe:true});body.attention={eventId:e.id,lastIdentityId:e.identity_id,consecutive:s.body.attention.lastIdentityId===e.identity_id?s.body.attention.consecutive+1:1};
    await this.bump(c,s,phase,body);const asOf=s.snapshotAt.getTime(),conversation=await this.recentConversation(c,e);return {event:e,generationEpoch:s.generationEpoch,revision:BigInt(e.revision),configVersion:s.configVersion,praiseSnapshot:await this.praiseSnapshot(c,e.identity_id,asOf),conversation,conversationContext:await this.conversationContext(c,s,e,conversation,asOf)};
  });}
  private async conversationCutoff(c:Client,eventId:string){return (await c.query("SELECT t.state_version FROM transitions t JOIN events p ON p.id=t.source_event_id WHERE t.character_id=$1 AND p.kind='attention.selected' AND p.parent_event_id=$2",[this.characterId,eventId])).rows[0]?.state_version;}
  private async affectRecords(c:Client|pg.Pool,ownerId:string,now:number):Promise<EventAffectRecord[]>{
    const rows=(await c.query("SELECT record FROM affective_appraisals WHERE character_id=$1 AND owner_id=$2 AND status='active' AND created_at>$3 AND created_at<=$4 ORDER BY created_at DESC,id DESC LIMIT 100",[this.characterId,ownerId,new Date(now-affectWindowMs),new Date(now)])).rows;
    return rows.reverse().map(r=>eventAffectRecordSchema.parse(r.record));
  }
  // Read-only snapshot for the event interpreter: the selected input, the
  // version-bound persona values and the delivered conversation it may read.
  async affectRequest(selected:NonNullable<Awaited<ReturnType<Store['select']>>>):Promise<EventInterpretationRequest|null>{
    const pool=this.db.pool,e=selected.event,configVersion=selected.configVersion.toString();
    const persona=(await pool.query('SELECT id,kind,text,created_at FROM character_persona_values WHERE character_id=$1 AND config_version=$2 ORDER BY ordinal',[this.characterId,configVersion])).rows;
    if(!persona.length||typeof e.payload?.text!=='string'||!e.identity_id)return null;
    const scope={ownerId:e.identity_id as string,characterId:this.characterId},current=e.received_at.getTime();
    const label=(await pool.query('SELECT display_name FROM identities WHERE id=$1',[e.identity_id])).rows[0]?.display_name??'사용자';
    const source=(id:string,revision:string,kind:AffectSource['kind'],text:string,at:number,speakerId:string|null):AffectSource=>({id,revision,kind,scope,text:text.slice(0,8000),at,speakerId,delivered:kind==='response',truth:'unresolved'});
    const sources:AffectSource[]=[source(e.id,String(e.revision),'input',e.payload.text,current,e.identity_id),...persona.map(v=>source(v.id,configVersion,v.kind,v.text,Math.min(v.created_at.getTime(),current),null))];
    const turns=selected.conversation.turns,eventIds=turns.filter(t=>t.source.kind==='event').map(t=>t.source.id),responseIds=turns.filter(t=>t.source.kind==='response').map(t=>t.source.id);
    const episodeRows=(await pool.query("SELECT episode FROM action_episodes WHERE character_id=$1 AND owner_id=$2 AND status='active' AND delivered_at>$3 AND delivered_at<=$4 ORDER BY delivered_at DESC,id DESC LIMIT $5",[this.characterId,e.identity_id,new Date(current-episodeWindowMs),new Date(current),episodeLimit+1])).rows;
    const episodes=episodeRows.slice(0,episodeLimit).map(r=>actionEpisodeSchema.parse(r.episode)).reverse(),truncated=episodeRows.length>episodeLimit;
    sources.push(...episodes.map(episodeAffectSource));
    const timed=[...(await pool.query('SELECT id,received_at AS at FROM events WHERE character_id=$1 AND id=ANY($2::uuid[])',[this.characterId,eventIds])).rows,...(await pool.query('SELECT id,COALESCE(finished_at,created_at) AS at FROM response_runs WHERE character_id=$1 AND id=ANY($2::uuid[])',[this.characterId,responseIds])).rows];
    const times=new Map<string,number>(timed.map(r=>[r.id,Math.min(r.at.getTime(),current)]));
    for(const t of turns){const at=times.get(t.source.id);if(at===undefined||t.source.id===e.id)continue;
      sources.push(t.source.kind==='event'?source(t.source.id,t.source.revision,'input',t.text,at,e.identity_id):source(t.source.id,'1','response',t.text,at,this.characterId));}
    const now=Math.max(this.clock(),current),records=(await this.affectRecords(pool,e.identity_id,now)).filter(r=>r.eventId!==e.id);
    return {scope,eventId:e.id,eventRevision:String(e.revision),configVersion,eventKind:'input',now,sources:sources.slice(0,40),speakerId:e.identity_id,
      actors:[{id:e.identity_id,label:String(label).slice(0,80)||'사용자'},{id:this.characterId,label:'캐릭터'}],experience:{status:episodes.length?'found':'empty',revision:'1',truncated},
      currentAffect:projectEventAffect(records,now).levels,stateSourceRefs:records.map(r=>({sourceId:r.eventId,revision:r.eventRevision}))};
  }
  private async applyEventAffect(c:Client,s:VersionedState,e:Row,body:State,now:number,attempt:EventAffectAttempt|undefined,socialCategory:string|null):Promise<{body:State;effect?:object}>{
    if(!attempt)return {body};
    const base={promptVersion:attempt.promptVersion,latencyMs:attempt.latencyMs};
    if(attempt.result.status!=='interpreted'||!attempt.request)return {body,effect:{...base,status:'unavailable',reason:attempt.result.status==='unavailable'?attempt.result.reason:'invalid_input'}};
    const request=attempt.request;
    const refs=(list:{sourceId:string;revision:string}[])=>JSON.stringify(list.map(r=>r.sourceId+':'+r.revision).sort());
    const history=request.eventId===e.id?(await this.affectRecords(c,e.identity_id,request.now)).filter(r=>r.eventId!==e.id):[];
    if(request.eventId!==e.id||request.eventRevision!==String(e.revision)||request.configVersion!==s.configVersion.toString()||request.scope.ownerId!==e.identity_id||request.scope.characterId!==this.characterId||refs(history.map(r=>({sourceId:r.eventId,revision:r.eventRevision})))!==refs(request.stateSourceRefs))return {body,effect:{...base,status:'stale'}};
    const readEpisodes=request.sources.filter(x=>x.kind==='episode').map(x=>x.id);
    if(readEpisodes.length&&(await c.query("SELECT count(*)::int n FROM action_episodes WHERE character_id=$1 AND id=ANY($2::uuid[]) AND status='active'",[this.characterId,readEpisodes])).rows[0].n!==readEpisodes.length)return {body,effect:{...base,status:'stale'}};
    let appended:ReturnType<typeof appendEventAffect>;
    try{appended=appendEventAffect(history,request,attempt.result.interpretation,e.id);}catch{return {body,effect:{...base,status:'invalid'}};}
    if(appended.status!=='applied'||(await c.query('SELECT 1 FROM affective_appraisals WHERE character_id=$1 AND event_id=$2 AND event_revision=$3',[this.characterId,e.id,e.revision])).rowCount)return {body,effect:{...base,status:'duplicate'}};
    const record=appended.records.find(r=>r.eventId===e.id)!,raw=eventAffectStimuli(record,appended.snapshot);
    // The verified social act owns its channel for this input: no double count,
    // and its interpersonal target is never replaced by an untargeted cause.
    const stimuli={joy:socialCategory==='praise'?0:raw.joy,frustration:socialCategory==='direct_insult'?0:raw.frustration,embarrassment:raw.embarrassment};
    await c.query("INSERT INTO affective_appraisals(id,character_id,owner_id,event_id,event_revision,config_version,policy_version,prompt_version,status,record,stimuli,latency_ms,created_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,'active',$9,$10,$11,$12)",[randomUUID(),this.characterId,e.identity_id,e.id,e.revision,s.configVersion.toString(),eventAffectPolicy.version,attempt.promptVersion,record,stimuli,attempt.latencyMs,new Date(record.at)]);
    const applied=Object.values(stimuli).some(v=>v>0)?apply(body,{eventId:e.id,targetId:null,now,stimuli}):body;
    return {body:applied,effect:{...base,status:'applied',interpretation:record.interpretation.status,stimuli}};
  }
  private async removeEventAffect(c:Client,s:VersionedState,ids:string[]){
    if(!ids.length)return;
    const rows=(await c.query("SELECT record FROM affective_appraisals WHERE character_id=$1 AND status='active'",[this.characterId])).rows;
    const records=rows.map(r=>eventAffectRecordSchema.parse(r.record)),kept=new Set(removeEventAffectSources(records,new Set(ids)).map(r=>r.eventId));
    const removed=records.filter(r=>!kept.has(r.eventId)).map(r=>r.eventId);if(!removed.length)return;
    await c.query("UPDATE affective_appraisals SET status='deleted',record=NULL,stimuli=NULL,deleted_at=$3 WHERE character_id=$1 AND status='active' AND event_id=ANY($2::uuid[])",[this.characterId,removed,new Date(this.now(s))]);
    for(const a of Object.values(s.body.affect))a.causes=a.causes.filter(x=>!(x.targetId===null&&removed.includes(x.eventId)));
  }
  private async recentConversation(c:Client,current:Row):Promise<ConversationSnapshot>{
    const cutoff=await this.conversationCutoff(c,current.id);
    const rows=(await c.query("SELECT e.*,t.state_version,p.id AS phase_id FROM events e JOIN events p ON p.parent_event_id=e.id AND p.kind='appraisal.applied' JOIN transitions t ON t.source_event_id=p.id WHERE e.character_id=$1 AND e.session_id=$2 AND e.identity_id=$3 AND e.kind='chat.final' AND e.attention_status='observed' AND e.data_status='active' AND t.state_version<$4 ORDER BY t.state_version DESC,e.id DESC LIMIT 5",[this.characterId,current.session_id,current.identity_id,cutoff])).rows;
    const turns:ConversationSnapshot['turns']=[];
    for(const e of rows.slice(0,4).reverse()){
      if(typeof e.payload?.text!=='string'||!e.payload.text.length)continue;
      turns.push({role:'user',text:e.payload.text,source:{kind:'event',id:e.id,revision:String(e.revision)},order:e.state_version});
      const response=(await c.query("SELECT r.* FROM response_runs r WHERE r.character_id=$1 AND r.session_id=$2 AND r.trigger_event_id=$3 AND r.status='completed' AND r.plan IS NOT NULL AND r.segment_count>0 AND (SELECT count(*) FROM speech_segments ss WHERE ss.response_id=r.id)=r.segment_count AND NOT EXISTS(SELECT 1 FROM speech_segments ss WHERE ss.response_id=r.id AND (ss.text IS NULL OR ss.text_shown_at IS NULL OR ss.delivery_status<>'finished'))",[this.characterId,current.session_id,e.phase_id])).rows[0];
      if(response&&(!response.knowledge_context||await this.knowledgeValid(c,current.session_id,current.identity_id,response.knowledge_context))&&(!response.personal_context||await this.personalValid(c,current.session_id,current.identity_id,response.personal_context))){const segments=(await c.query('SELECT text FROM speech_segments WHERE response_id=$1 ORDER BY segment_index',[response.id])).rows;turns.push({role:'assistant',text:segments.map(s=>s.text).join(' '),source:{kind:'response',id:response.id,generationEpoch:response.generation_epoch},order:e.state_version});}
    }
    return conversationSnapshotSchema.parse({version:1,sessionId:current.session_id,identityId:current.identity_id,cutoffEventId:current.id,turns,truncated:rows.length>4});
  }
  private async conversationRefs(snapshot:ConversationSnapshot):Promise<ConversationRefs>{return {...snapshot,turns:await Promise.all(snapshot.turns.map(async({text,...turn})=>({...turn,textDigest:await this.digest(text)})))};}
  private async readConversation(c:Client,refs:ConversationRefs):Promise<ConversationSnapshot|null>{
    const parsed=conversationRefsSchema.safeParse(refs);if(!parsed.success)return null;refs=parsed.data;
    const cutoff=(await c.query("SELECT e.session_id,e.identity_id,t.state_version FROM events e JOIN events p ON p.parent_event_id=e.id AND p.kind='attention.selected' JOIN transitions t ON t.source_event_id=p.id WHERE e.character_id=$1 AND e.id=$2 AND e.data_status='active'",[this.characterId,refs.cutoffEventId])).rows[0];
    if(!cutoff||cutoff.session_id!==refs.sessionId||cutoff.identity_id!==refs.identityId)return null;
    const turns:ConversationSnapshot['turns']=[];
    for(const {textDigest,...turn} of refs.turns){let text:string|undefined;
      const row=(await c.query(turn.source.kind==='event'
        ?"SELECT e.payload->>'text' AS text,e.revision,t.state_version FROM events e JOIN events p ON p.parent_event_id=e.id AND p.kind='appraisal.applied' JOIN transitions t ON t.source_event_id=p.id WHERE e.character_id=$1 AND e.session_id=$2 AND e.identity_id=$3 AND e.id=$4 AND e.data_status='active' AND e.attention_status='observed' AND e.kind='chat.final'"
        :"SELECT r.knowledge_context,r.personal_context,r.generation_epoch,t.state_version,r.segment_count,(SELECT count(*) FROM speech_segments ss WHERE ss.response_id=r.id) AS actual_count,(SELECT string_agg(ss.text,' ' ORDER BY ss.segment_index) FROM speech_segments ss WHERE ss.response_id=r.id) AS text FROM response_runs r JOIN events p ON p.id=r.trigger_event_id AND p.kind='appraisal.applied' JOIN events e ON e.id=p.parent_event_id JOIN transitions t ON t.source_event_id=p.id WHERE r.character_id=$1 AND r.session_id=$2 AND e.identity_id=$3 AND r.id=$4 AND r.status='completed' AND r.plan IS NOT NULL AND e.data_status='active' AND NOT EXISTS(SELECT 1 FROM speech_segments ss WHERE ss.response_id=r.id AND (ss.text IS NULL OR ss.text_shown_at IS NULL OR ss.delivery_status<>'finished'))",
        [this.characterId,refs.sessionId,refs.identityId,turn.source.id])).rows[0];
      if(!row||row.state_version!==turn.order||BigInt(turn.order)>=BigInt(cutoff.state_version))return null;
      if(turn.source.kind==='response'&&row.knowledge_context&&!await this.knowledgeValid(c,refs.sessionId,refs.identityId,row.knowledge_context))return null;
      if(turn.source.kind==='response'&&row.personal_context&&!await this.personalValid(c,refs.sessionId,refs.identityId,row.personal_context))return null;
      if(turn.source.kind==='event'?String(row.revision)!==turn.source.revision:row.generation_epoch!==turn.source.generationEpoch||Number(row.actual_count)!==row.segment_count||!row.segment_count)return null;
      text=row.text;if(typeof text!=='string'||!text.length||await this.digest(text)!==textDigest)return null;
      turns.push({...turn,text});
    }return {...refs,turns};
  }
  private async praiseSnapshot(c:Client,identityId:string,asOf:number):Promise<{context:RecentPraise;groups:PraiseGroupSource[]}>{
    const rows=(await c.query(`SELECT r.applied,
      (SELECT jsonb_agg(jsonb_build_object('eventId',e.id,'revision',e.revision::text,'sourceRevision',src.event_revision::text,'text',e.payload->>'text','kind',e.kind,'status',e.data_status,'observed',e.observed_at IS NOT NULL,'identityId',e.identity_id))
       FROM relationship_evidence_sources src LEFT JOIN events e ON e.id=src.event_id AND e.character_id=r.character_id WHERE src.evidence_id=r.id) AS sources
      FROM relationship_evidence r WHERE r.character_id=$1 AND r.identity_id=$2 AND r.status='active' AND r.kind='praise' AND r.effective_at>$3 AND r.effective_at<=$4 ORDER BY r.effective_at,r.order_version,r.id LIMIT 9`,[this.characterId,identityId,new Date(asOf-600000),new Date(asOf)])).rows;
    const items:RecentPraise['items'][number][]=[],groups:PraiseGroupSource[]=[];
    const incomplete=()=>({context:{asOf,complete:false,items:[]},groups:[]});
    if(rows.length>8)return incomplete();let bytes=0;
    for(const row of rows){
      const source=row.sources?.[0],groupId=row.applied?.affect?.version===3?row.applied.affect.groupId:null;
      if(row.sources?.length!==1||!source?.eventId||source.kind!=='chat.final'||source.status!=='active'||!source.observed||source.identityId!==identityId||source.revision!==source.sourceRevision||typeof source.text!=='string'||!source.text.length||[...source.text].length>1000||Buffer.byteLength(source.text)>4096||typeof groupId!=='string'||!groupId)return incomplete();
      bytes+=Buffer.byteLength(source.text);if(bytes>6000)return incomplete();
      items.push({eventId:source.eventId,revision:source.revision,text:source.text});groups.push({eventId:source.eventId,revision:source.revision,groupId});
    }
    return {context:{asOf,complete:true,items},groups};
  }
  private async evidence(c:Client,s:VersionedState,sessionId:string,identityId:string,key:string,kind:EvidenceInput['kind'],sources:{event:Row;role:string}[],group:string,features:object={},applied:object={},problemId:string|null=null){
    const now=this.now(s),id=randomUUID();
    const r=await c.query("INSERT INTO relationship_evidence(id,character_id,identity_id,evidence_key,kind,status,problem_id,effective_at,local_date,order_version,config_version,features,applied) VALUES($1,$2,$3,$4,$5,'active',$6,$7,$8,$9,$10,$11,$12) ON CONFLICT(character_id,identity_id,evidence_key) DO NOTHING RETURNING id",[id,this.characterId,identityId,key,kind,problemId,new Date(now),koreanDate(now),(s.version+1n).toString(),s.configVersion.toString(),features,applied]);
    const evidenceId=r.rowCount?id:(await c.query('SELECT id FROM relationship_evidence WHERE character_id=$1 AND identity_id=$2 AND evidence_key=$3',[this.characterId,identityId,key])).rows[0].id;
    for(const source of sources)await c.query('INSERT INTO relationship_evidence_sources(evidence_id,event_id,character_id,event_revision,role,support_group) VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT DO NOTHING',[evidenceId,source.event.id,this.characterId,source.event.revision,source.role,group]);
    if(kind==='first_observed'&&!r.rowCount)await c.query("UPDATE relationship_evidence SET status='active',effective_at=$2,local_date=$3,order_version=$4,config_version=$5 WHERE id=$1 AND status='invalidated'",[evidenceId,new Date(now),koreanDate(now),(s.version+1n).toString(),s.configVersion.toString()]);
    return {id:evidenceId,inserted:!!r.rowCount};
  }
  private async evidenceInputs(c:Client):Promise<EvidenceInput[]>{return (await c.query("SELECT * FROM relationship_evidence WHERE character_id=$1 AND status='active' ORDER BY effective_at,order_version,id",[this.characterId])).rows.map(r=>({id:r.id,identityId:r.identity_id,kind:r.kind,at:r.effective_at.getTime(),order:BigInt(r.order_version),problemId:r.problem_id??undefined,strength:r.features?.strength,relationshipEligible:r.features?.relationshipEligible!==false,appliedStimulus:r.applied?.stimulus??0,affectStimulus:[2,3].includes(r.applied?.affect?.version)?r.applied.affect.stimulus:undefined,affectGroupId:r.applied?.affect?.version===3?r.applied.affect.groupId??undefined:undefined}));}
  private async project(c:Client,s:VersionedState){const inputs=await this.evidenceInputs(c),projection=projectRelationships(inputs);
    await c.query('DELETE FROM relationships WHERE character_id=$1',[this.characterId]);
    for(const [id,r]of projection)await c.query('INSERT INTO relationships(character_id,identity_id,familiarity,affinity,interaction_days,verified_problem_count,verified_help_days,last_help_at,projection_version,updated_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)',[this.characterId,id,r.familiarity,r.affinity,r.interactionDays,r.verifiedProblemCount,r.verifiedHelpDays,r.lastHelpAt===null?null:new Date(r.lastHelpAt),(s.version+1n).toString(),new Date(this.now(s))]);
  }
  private async memory(c:Client,sessionId:string,activityId:string|null,key:string,kind:string,content:string,facts:object,sources:{event:Row;role:string}[],participants:string[]){
    const id=randomUUID(),now=new Date(this.clock());
    const inserted=await c.query("INSERT INTO memories(id,character_id,session_id,activity_run_id,memory_key,kind,status,content_version,fact_kind,visibility,content,facts,occurred_at,updated_at) VALUES($1,$2,$3,$4,$5,$6,'active',1,'observed','test_public',$7,$8,$9,$9) ON CONFLICT(character_id,memory_key) DO NOTHING RETURNING *",[id,this.characterId,sessionId,activityId,key,kind,content,facts,now]);
    if(!inserted.rowCount)return (await c.query('SELECT * FROM memories WHERE character_id=$1 AND memory_key=$2',[this.characterId,key])).rows[0];
    for(const source of sources){if(source.event.data_status!=='active'||!source.event.observed_at)throw new RuntimeError('invalid_memory_source');await c.query('INSERT INTO memory_sources(memory_id,event_id,character_id,event_revision,role) VALUES($1,$2,$3,$4,$5)',[id,source.event.id,this.characterId,source.event.revision,source.role]);}
    for(const identityId of new Set(participants))await c.query("INSERT INTO memory_participants(memory_id,identity_id,character_id,role) VALUES($1,$2,$3,'participant')",[id,identityId,this.characterId]);return inserted.rows[0];
  }
  async memories(identityId?:string,activityId?:string){return (await this.db.pool.query(`SELECT m.*, COALESCE((SELECT jsonb_agg(identity_id) FROM memory_participants mp WHERE mp.memory_id=m.id),'[]'::jsonb) AS participants, COALESCE((SELECT jsonb_agg(ms.event_id) FROM memory_sources ms WHERE ms.memory_id=m.id),'[]'::jsonb) AS source_event_ids FROM memories m WHERE m.character_id=$1 AND m.status='active' AND NOT EXISTS(SELECT 1 FROM memory_sources ms JOIN events e ON e.id=ms.event_id WHERE ms.memory_id=m.id AND (e.data_status<>'active' OR e.revision<>ms.event_revision)) ORDER BY CASE WHEN m.activity_run_id=$3 AND m.kind='unfinished_activity' THEN 0 WHEN EXISTS(SELECT 1 FROM memory_participants p WHERE p.memory_id=m.id AND p.identity_id=$2) THEN 1 ELSE 2 END,m.occurred_at DESC,CASE WHEN m.kind='verified_help' AND m.facts->>'result'='verified_help' THEN 0 ELSE 1 END,m.id LIMIT 100`,[this.characterId,identityId??null,activityId??null])).rows;}
  private async response(c:Client,s:VersionedState,sessionId:string,trigger:Row,plan:Plan,extraSources:Row[]=[],conversation?:ConversationSnapshot){
    if((await c.query(`SELECT 1 FROM response_runs WHERE character_id=$1 AND status IN ${activeResponses}`,[this.characterId])).rowCount)return null;
    if(plan.speechStyle){
      // Delivery history, not an unspoken plan, supplies register continuity.
      // Do not skip a later casual/redacted response to resurrect older formality.
      const previous=plan.targetIdentityId?(await c.query(`SELECT r.id,r.plan,r.segment_count,
        (SELECT count(*) FROM speech_segments ss WHERE ss.response_id=r.id AND ss.text IS NOT NULL AND ss.text_shown_at IS NOT NULL AND ss.delivery_status='finished') AS delivered_count
        FROM response_runs r JOIN events trigger ON trigger.id=r.trigger_event_id
        WHERE r.character_id=$1 AND r.session_id=$2 AND r.status='completed'
        AND (r.plan->>'targetIdentityId'=$3 OR EXISTS(SELECT 1 FROM events input WHERE input.id=trigger.parent_event_id AND input.identity_id::text=$3))
        ORDER BY r.finished_at DESC,r.created_at DESC,r.id DESC LIMIT 1`,[this.characterId,sessionId,plan.targetIdentityId])).rows[0]:null;
      if(previous?.plan?.speechStyle&&previous.segment_count>0&&Number(previous.delivered_count)===previous.segment_count){
        const causes=s.body.affect.frustration.causes.filter(cause=>cause.targetId===plan.targetIdentityId).map(cause=>cause.eventId);
        const shared=(await c.query(`SELECT 1 FROM response_sources rs JOIN events e ON e.id=rs.event_id AND e.character_id=rs.character_id
          WHERE rs.response_id=$1 AND rs.event_id=ANY($2::uuid[]) AND e.data_status='active' AND e.revision=rs.source_version LIMIT 1`,[previous.id,causes])).rowCount;
        if(shared)plan=continueRegister(s.body,plan,previous.plan);
      }
      const style=plan.speechStyle!;
      const joyCauses=style.positiveTone==='neutral'?[]:s.body.affect.joy.causes;
      const distanceCauses=style.register==='formal'||style.discomfortTone||style.concealAffect?s.body.affect.frustration.causes.filter(cause=>cause.targetId===plan.targetIdentityId):[];
      const ids=[...new Set([...joyCauses,...distanceCauses].map(cause=>cause.eventId))];
      // Social affect requires the exact accepted revision and applied category.
      // Raw active events or forged target IDs cannot authorize interpersonal distance.
      const rows=ids.length?(await c.query(`SELECT DISTINCT e.id,e.revision,e.identity_id,e.kind,t.effects->>'category' AS category
        FROM events e JOIN transitions t ON t.character_id=e.character_id
        LEFT JOIN appraisals a ON a.id=t.appraisal_id
        WHERE e.character_id=$1 AND e.id=ANY($2::uuid[]) AND e.data_status='active' AND e.observed_at IS NOT NULL
        AND ((e.kind='chat.final' AND a.character_id=e.character_id AND a.event_id=e.id AND a.event_revision=e.revision AND a.status='accepted' AND (t.effects->>'stimulus')::numeric>0)
          OR (e.kind<>'chat.final' AND t.source_event_id=e.id AND t.replay_status='available'))`,[this.characterId,ids])).rows:[];
      const related=(causes:State['affect']['joy']['causes'],row:Row)=>causes.some(cause=>cause.eventId===row.id&&cause.targetId===row.identity_id);
      const distance=rows.filter(row=>row.category==='direct_insult'&&related(distanceCauses,row));
      if(!distance.length||style.concealAffect){
        const {discomfortTone:_tone,...remaining}=style;
        plan={...plan,speechStyle:{...remaining,register:distance.length?style.register:'casual'}};
      }
      const positive=rows.filter(row=>row.kind==='chat.final'&&row.category==='praise'&&related(joyCauses,row));
      // Activity joy targets a problem or a verified helper, never the null
      // identity on answer_judged. Reuse the recorded judgement revision and
      // help evidence rather than treating every non-chat event as positive.
      for(const row of rows.filter(row=>row.kind==='activity.answer_judged')){
        const result=(await c.query(`SELECT ar.problem_id FROM activity_steps st
          JOIN activity_runs ar ON ar.character_id=st.character_id AND ar.id=st.activity_run_id
          JOIN events e ON e.character_id=st.character_id AND e.id=st.event_id
          WHERE st.character_id=$1 AND st.event_id=$2 AND st.kind='answer_judged' AND st.data_status='active' AND st.verdict='correct'
          AND e.payload->>'activityId'=ar.id::text AND e.payload->>'problemId'=ar.problem_id AND e.payload->>'verdict'='correct'
          AND EXISTS(SELECT 1 FROM memory_sources ms JOIN memories m ON m.id=ms.memory_id AND m.character_id=ms.character_id
            WHERE ms.character_id=e.character_id AND ms.event_id=e.id AND ms.event_revision=e.revision
            AND m.activity_run_id=ar.id AND m.kind='activity_result')`,[this.characterId,row.id])).rows[0];
        if(!result)continue;
        for(const cause of joyCauses.filter(cause=>cause.eventId===row.id)){
          if(cause.targetId===result.problem_id){positive.push(row);continue;}
          const help=(await c.query(`SELECT e.id,e.revision FROM relationship_evidence re
            JOIN relationship_evidence_sources judge ON judge.character_id=re.character_id AND judge.evidence_id=re.id AND judge.event_id=$2 AND judge.event_revision=$5
            JOIN relationship_evidence_sources rs ON rs.character_id=re.character_id AND rs.evidence_id=re.id AND rs.support_group=judge.support_group
            JOIN events e ON e.character_id=rs.character_id AND e.id=rs.event_id AND e.revision=rs.event_revision
            WHERE re.character_id=$1 AND re.identity_id::text=$3 AND re.kind='verified_hint' AND re.status='active' AND re.problem_id=$4
            AND NOT EXISTS(SELECT 1 FROM relationship_evidence_sources src JOIN events ev ON ev.character_id=src.character_id AND ev.id=src.event_id
              WHERE src.character_id=re.character_id AND src.evidence_id=re.id AND src.support_group=judge.support_group
              AND (ev.data_status<>'active' OR ev.observed_at IS NULL OR ev.revision<>src.event_revision))`,[this.characterId,row.id,cause.targetId,result.problem_id,row.revision])).rows;
          if(help.length)positive.push(row,...help);
        }
      }
      extraSources=[...extraSources,...distance,...positive];
    }
    // Untargeted event affect shapes delivery too; bind its accepted inputs so
    // deleting one invalidates this output like any other cause.
    const affectCauses=[...new Set(Object.values(s.body.affect).flatMap(a=>a.causes.filter(cause=>cause.targetId===null).map(cause=>cause.eventId)))];
    if(affectCauses.length)extraSources=[...extraSources,...(await c.query("SELECT e.id,e.revision FROM affective_appraisals a JOIN events e ON e.character_id=a.character_id AND e.id=a.event_id AND e.revision=a.event_revision WHERE a.character_id=$1 AND a.status='active' AND a.event_id=ANY($2::uuid[]) AND e.data_status='active'",[this.characterId,affectCauses])).rows];
    const id=randomUUID();await c.query("INSERT INTO response_runs(id,character_id,session_id,trigger_event_id,generation_epoch,config_version,status,plan,deadline_at) VALUES($1,$2,$3,$4,$5,$6,'planned',$7,$8)",[id,this.characterId,sessionId,trigger.id,s.generationEpoch.toString(),s.configVersion.toString(),plan,new Date(this.now(s)+30000)]);
    for(const e of [trigger,...extraSources])await c.query('INSERT INTO response_sources(id,character_id,response_id,event_id,source_version) VALUES($1,$2,$3,$4,$5) ON CONFLICT DO NOTHING',[randomUUID(),this.characterId,id,e.id,e.revision]);
    for(const memoryId of plan.memoryIds){const m=(await c.query("SELECT * FROM memories WHERE character_id=$1 AND id=$2 AND status='active'",[this.characterId,memoryId])).rows[0];if(!m)throw new RuntimeError('stale_source');await c.query('INSERT INTO response_sources(id,character_id,response_id,memory_id,source_version) VALUES($1,$2,$3,$4,$5)',[randomUUID(),this.characterId,id,m.id,m.content_version]);}
    if(conversation){const refs=await this.conversationRefs(conversation);if(refs.sessionId!==sessionId||refs.identityId!==plan.targetIdentityId||!await this.readConversation(c,refs))throw new RuntimeError('stale_source');await c.query('UPDATE response_runs SET conversation_refs=$2 WHERE id=$1',[id,refs]);
      for(const turn of refs.turns)await c.query(`INSERT INTO response_sources(id,character_id,response_id,${turn.source.kind==='event'?'event_id':'source_response_id'},source_version) VALUES($1,$2,$3,$4,$5) ON CONFLICT DO NOTHING`,[randomUUID(),this.characterId,id,turn.source.id,turn.source.kind==='event'?turn.source.revision:turn.source.generationEpoch]);}
    if(plan.purpose!=='knowledge_answer'&&plan.targetIdentityId){
      const personal=await readPersonalFacts(c,{characterId:this.characterId,sessionId,identityId:plan.targetIdentityId});
      await c.query('UPDATE response_runs SET personal_context=$2 WHERE id=$1',[id,personal]);
      for(const fact of personal.facts)await c.query('INSERT INTO response_sources(id,character_id,response_id,personal_fact_id,source_version) VALUES($1,$2,$3,$4,$5)',[randomUUID(),this.characterId,id,fact.id,fact.revision]);
    }
    return {id,sessionId,generationEpoch:s.generationEpoch,plan};
  }
  private emotion(body:State){return {joy:body.affect.joy.value,frustration:body.affect.frustration.value,surprise:body.affect.surprise.value,embarrassment:body.affect.embarrassment.value,pleasantness:body.mood.pleasantness};}
  private async conversationContext(c:Client,s:VersionedState,e:Row,history:ConversationSnapshot,asOf:number):Promise<ConversationContext>{
    const previous=s.body.turn.recentSilences.find(r=>r.identityId===e.identity_id)??null;
    const validSilence=previous&&await this.silenceSources(c,previous)&&!await this.previousOutputFailed(c,e.identity_id,previous)?previous:null;
    const cutoff=await this.conversationCutoff(c,e.id);
    const candidate=(await c.query("SELECT source.id,source.revision,source.identity_id,source.session_id,source.payload->>'text' AS text,t.evaluated_at FROM transitions t JOIN events phase ON phase.id=t.source_event_id AND phase.kind='appraisal.applied' JOIN events source ON source.id=phase.parent_event_id WHERE t.character_id=$1 AND source.session_id=$2 AND source.identity_id=$3 AND source.data_status='active' AND source.kind='chat.final' AND t.replay_status='available' AND t.effects->>'category'='direct_insult' AND (t.effects->>'stimulus')::numeric>0 AND t.evaluated_at>=$4 AND t.evaluated_at<=$5 AND t.state_version<$6 ORDER BY t.state_version DESC LIMIT 1",[this.characterId,e.session_id,e.identity_id,new Date(asOf-600000),new Date(asOf),cutoff])).rows[0];
    const used=candidate?!!(await c.query("SELECT 1 FROM transitions WHERE character_id=$1 AND effects->'repairUsed'->>'candidateEventId'=$2 LIMIT 1",[this.characterId,candidate.id])).rowCount:false;
    return conversationContextSchema.parse({version:1,sessionId:e.session_id,identityId:e.identity_id,asOf,history,silence:validSilence,repairCandidate:candidate?{eventId:candidate.id,revision:String(candidate.revision),identityId:e.identity_id,sessionId:e.session_id,at:candidate.evaluated_at.getTime(),text:candidate.text,used}:null});
  }
  private async repairEligible(c:Client,body:State,context:ConversationContext,now:number){
    const candidate=context.repairCandidate,causes=body.affect.frustration.causes;
    if(!candidate||candidate.used||now-candidate.at>600000||!causes.length||!causes.some(x=>x.eventId===candidate.eventId)||causes.some(x=>x.targetId!==context.identityId))return false;
    for(const cause of causes){const valid=(await c.query("SELECT source.revision FROM events source JOIN events phase ON phase.parent_event_id=source.id AND phase.kind='appraisal.applied' JOIN transitions t ON t.source_event_id=phase.id WHERE source.character_id=$1 AND source.id=$2 AND source.identity_id=$3 AND source.data_status='active' AND t.replay_status='available' AND t.effects->>'category'='direct_insult' AND (t.effects->>'stimulus')::numeric>0",[this.characterId,cause.eventId,context.identityId])).rows[0];if(!valid||cause.eventId===candidate.eventId&&String(valid.revision)!==candidate.revision)return false;}
    return !(await c.query("SELECT 1 FROM transitions WHERE character_id=$1 AND effects->'repairUsed'->>'candidateEventId'=$2 LIMIT 1",[this.characterId,candidate.eventId])).rowCount;
  }
  private async silenceSources(c:Client,record:SilenceRecord){
    const judgement=(await c.query("SELECT t.replay_status,a.status FROM transitions t JOIN events phase ON phase.id=t.source_event_id LEFT JOIN appraisals a ON a.id=t.appraisal_id WHERE t.character_id=$1 AND phase.parent_event_id=$2 AND phase.kind='appraisal.applied'",[this.characterId,record.eventId])).rows;
    if(judgement.some(t=>t.replay_status==='source_redacted'||t.status!==null&&t.status!=='accepted'))return null;
    const events:Row[]=[],memoryIds:string[]=[];
    for(const ref of [{kind:'event',id:record.eventId,version:record.eventRevision},...record.sourceRefs]){
      if(ref.kind==='event'){
        const row=(await c.query("SELECT * FROM events WHERE character_id=$1 AND id=$2 AND revision=$3 AND data_status='active' AND observed_at IS NOT NULL",[this.characterId,ref.id,ref.version])).rows[0];
        if(!row)return null;if(!events.some(e=>e.id===row.id))events.push(row);
      }else{
        if(!(await c.query("SELECT 1 FROM memories m WHERE m.character_id=$1 AND m.id=$2 AND m.content_version=$3 AND m.status='active' AND NOT EXISTS(SELECT 1 FROM memory_sources ms JOIN events e ON e.id=ms.event_id WHERE ms.memory_id=m.id AND (e.data_status<>'active' OR e.revision<>ms.event_revision))",[this.characterId,ref.id,ref.version])).rowCount)return null;
        memoryIds.push(ref.id);
      }
    }
    return {events,memoryIds};
  }
  private async previousOutputFailed(c:Client,identityId:string,record:SilenceRecord|null){
    const response=(await c.query("SELECT r.status,t.state_version FROM response_runs r JOIN events e ON e.id=r.trigger_event_id JOIN transitions t ON t.source_event_id=e.id WHERE r.character_id=$1 AND COALESCE(r.plan->>'targetIdentityId',e.identity_id::text)=$2 ORDER BY t.state_version DESC LIMIT 1",[this.characterId,identityId])).rows[0];
    if(response&&['failed','cancelled','interrupted'].includes(response.status)&&(!record||BigInt(response.state_version)>BigInt(record.stateVersion)))return true;
    const decision=(await c.query("SELECT t.state_version,t.effects FROM transitions t JOIN events e ON e.id=t.source_event_id WHERE t.character_id=$1 AND e.identity_id=$2 AND e.kind='appraisal.applied' ORDER BY t.state_version DESC LIMIT 1",[this.characterId,identityId])).rows[0];
    return !!(decision?.effects?.participation?.mode==='defer'&&(!record||BigInt(decision.state_version)>BigInt(record.stateVersion)));
  }
  private participationEvidence(appraisal:Appraisal,metadata:AppraisalMetadata,eventId:string,identityId:string,eventRevision:string,conversationContext?:ConversationContext):SocialContext['participationEvidence']{
    if(metadata.failureCode!==undefined||appraisal.target!=='character'||appraisal.act==='unknown'||!appraisal.evidence_refs.includes(eventId))return;
    try{const evidence=this.evidenceVerifier?.verify(appraisal,metadata,{eventId,identityId,eventRevision,conversationContext});
      if(evidence?.target===appraisal.target&&evidence.act===appraisal.act)return evidence;
    }catch{/* Malformed or unsupported evidence cannot authorize participation. */}
  }
  private affectEvidence(appraisal:Appraisal,metadata:AppraisalMetadata,eventId:string,identityId:string,eventRevision:string,conversationContext?:ConversationContext):AffectEvidence|undefined{
    if(metadata.failureCode!==undefined||!appraisal.uncertain||appraisal.target!=='character'||!['praise','criticism'].includes(appraisal.act)||!appraisal.evidence_refs.includes(eventId))return;
    try{const evidence=this.evidenceVerifier?.verifyAffect?.(appraisal,metadata,{eventId,identityId,eventRevision,conversationContext});
      if(evidence&&((evidence.kind==='praise'&&appraisal.act==='praise')||(evidence.kind==='direct_insult'&&appraisal.act==='criticism'))&&[1,2,3].includes(evidence.strength))return evidence;
    }catch{/* Unsupported evidence cannot authorize an emotional increase. */}
  }
  async commitAppraisal(selected:NonNullable<Awaited<ReturnType<Store['select']>>>,appraisal:Appraisal,metadata:AppraisalMetadata,memoryIds:string[]=[],eventAffect?:EventAffectAttempt){metadata=appraisalMetadataSchema.parse(metadata);return this.locked(async(c,s)=>{
    const e=(await c.query('SELECT * FROM events WHERE id=$1 AND character_id=$2 FOR UPDATE',[selected.event.id,this.characterId])).rows[0];
    const session=(await c.query('SELECT status FROM sessions WHERE id=$1',[e.session_id])).rows[0];
    if(e.data_status!=='active'||e.attention_status!=='selected'||BigInt(e.revision)!==selected.revision||s.generationEpoch!==selected.generationEpoch||session.status!=='active')return {status:'stale',response:null};
    const conversation=conversationSnapshotSchema.safeParse(selected.conversation);
    if(!conversation.success||conversation.data.cutoffEventId!==e.id||conversation.data.sessionId!==e.session_id||conversation.data.identityId!==e.identity_id||!await this.readConversation(c,await this.conversationRefs(conversation.data)))return {status:'stale',response:null};
    const selectedContext=conversationContextSchema.safeParse(selected.conversationContext);
    if(!selectedContext.success||JSON.stringify(selectedContext.data.history)!==JSON.stringify(conversation.data))return {status:'stale',response:null};
    const selection=(await c.query("SELECT t.evaluated_at FROM transitions t JOIN events phase ON phase.id=t.source_event_id WHERE t.character_id=$1 AND phase.kind='attention.selected' AND phase.parent_event_id=$2",[this.characterId,e.id])).rows[0];
    if(!selection||selectedContext.data.asOf!==selection.evaluated_at.getTime())return {status:'stale',response:null};
    const conversationContext=await this.conversationContext(c,s,e,conversation.data,selectedContext.data.asOf);
    if(JSON.stringify(conversationContext)!==JSON.stringify(selectedContext.data))return {status:'stale',response:null};
    if(this.evidenceVerifier?.validate){
      let valid=false;if(!metadata.failureCode){try{valid=this.evidenceVerifier.validate(appraisal,metadata,{eventId:e.id,identityId:e.identity_id,eventRevision:String(e.revision),conversationContext});}catch{/* Invalid provenance is a technical failure, not intentional silence. */}}
      if(!valid){metadata={...metadata,failureCode:metadata.failureCode??'appraisal_evidence_invalid'};appraisal={...neutralAppraisal,evidence_refs:[e.id]};}
    }
    let conversationEvidence:ConversationEvidence|undefined;
    if(!metadata.failureCode){try{conversationEvidence=this.evidenceVerifier?.verifyConversation?.(appraisal,metadata,{eventId:e.id,identityId:e.identity_id,eventRevision:String(e.revision),conversationContext});}catch{/* Unsupported or stale semantic evidence grants nothing. */}}
    const phase=await this.event(c,e.session_id,'appraisal.applied',`appraisal_applied:${e.id}:${e.revision}`,{eventId:e.id},e.identity_id,e.id);
    if(phase.duplicate)return {status:'duplicate',response:null};
    const now=this.now(s),history=await this.evidenceInputs(c),affectEvidence=this.affectEvidence(appraisal,metadata,e.id,e.identity_id,String(e.revision),conversationContext);
    const snapshot=selected.praiseSnapshot,current=await this.praiseSnapshot(c,e.identity_id,now);
    let groupId:string|undefined;
    const eligible=!metadata.failureCode&&appraisal.target==='character'&&appraisal.act==='praise'&&(appraisal.uncertain?!!affectEvidence:appraisal.strength>0);
    if(eligible&&snapshot?.context.complete&&current.context.complete&&JSON.stringify(snapshot.context.items)===JSON.stringify(current.context.items)&&JSON.stringify(snapshot.groups)===JSON.stringify(current.groups)){
      try{
        const evidence=this.evidenceVerifier?.verifyRepetition?.(appraisal,metadata,{eventId:e.id,identityId:e.identity_id,eventRevision:String(e.revision),recentPraise:snapshot.context});
        const selection=selectPraiseGroup(snapshot.groups,evidence,true);
        if(selection.kind==='new')groupId=randomUUID();else if(selection.kind==='existing')groupId=selection.groupId;
      }catch{/* An invalid comparison only removes grouping authority. */}
    }
    const effect=socialAffect(appraisal,history,e.identity_id,now,affectEvidence,groupId),relationshipEffect=socialEffect(appraisal,history,e.identity_id,now),appraisalId=randomUUID();
    const contextRefs:Record<string,string>[]=[{id:e.id,revision:String(e.revision)},...conversation.data.turns.map(t=>({kind:t.source.kind,id:t.source.id,version:t.source.kind==='event'?t.source.revision:t.source.generationEpoch}))],envelope=evidenceEnvelopeSchema.safeParse(metadata.providerResult);
    let conversationSources:Row[]=[];const conversationMemoryIds:string[]=[];
    if(envelope.success&&envelope.data.version===3&&envelope.data.eventId===e.id&&envelope.data.identityId===e.identity_id&&envelope.data.eventRevision===String(e.revision)&&snapshot?.context.complete&&envelope.data.comparison.complete&&envelope.data.comparison.asOf===snapshot.context.asOf&&JSON.stringify(envelope.data.comparison.sources)===JSON.stringify(snapshot.context.items.map(({eventId,revision})=>({eventId,revision}))))contextRefs.push(...snapshot.context.items.map(({eventId,revision})=>({id:eventId,revision})));
    if(envelope.success&&envelope.data.version===4&&envelope.data.contextHash===await this.digest(JSON.stringify(conversationContext))){
      if(conversationContext.repairCandidate)contextRefs.push({id:conversationContext.repairCandidate.eventId,revision:conversationContext.repairCandidate.revision});
      if(conversationContext.silence)contextRefs.push(...conversationContext.silence.sourceRefs.filter(r=>r.kind==='event').map(r=>({id:r.id,revision:r.version})));
      const ids=[...(conversationContext.repairCandidate?[conversationContext.repairCandidate.eventId]:[]),...(conversationContext.silence?[conversationContext.silence.eventId,...conversationContext.silence.sourceRefs.filter(r=>r.kind==='event').map(r=>r.id)]:[])];
      conversationSources=(await c.query("SELECT id,revision FROM events WHERE character_id=$1 AND id=ANY($2::uuid[]) AND data_status='active'",[this.characterId,[...new Set(ids)]])).rows;
      conversationMemoryIds.push(...(conversationContext.silence?.sourceRefs.filter(r=>r.kind==='memory').map(r=>r.id)??[]));
    }
    await c.query("INSERT INTO appraisals(id,character_id,event_id,event_revision,request_id,generation_epoch,config_version,provider,model,prompt_version,status,result,context_refs,failure_code,latency_ms,usage,provider_result) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$13,'accepted',$10,$11,$12,$14,$15,$16)",[appraisalId,this.characterId,e.id,e.revision,randomUUID(),s.generationEpoch.toString(),s.configVersion.toString(),metadata.provider,metadata.model,appraisal,JSON.stringify(contextRefs),metadata.failureCode??null,metadata.promptVersion??'appraisal-v1',metadata.latencyMs??null,metadata.usage??null,metadata.providerResult??null]);
    await c.query("UPDATE events SET attention_status='observed',applied_at=$2 WHERE id=$1",[e.id,new Date(now)]);
    e.attention_status='observed';
    await this.evidence(c,s,e.session_id,e.identity_id,`first_observed:${koreanDate(now)}`,'first_observed',[{event:e,role:'observed'}],e.id);
    if(effect.category)await this.evidence(c,s,e.session_id,e.identity_id,`${effect.category}:${e.id}`,effect.category,[{event:e,role:'appraisal'}],e.id,{strength:appraisal.strength,...(affectEvidence?{relationshipEligible:false}:{})},{stimulus:relationshipEffect.stimulus,habituation:relationshipEffect.habituation,affect:{version:3,stimulus:effect.stimulus,habituation:effect.habituation,groupId:groupId??null}});
    let body=apply(s.body,{eventId:e.id,targetId:e.identity_id,now,stimuli:effect.category==='praise'?{joy:effect.stimulus}:effect.category==='direct_insult'?{frustration:effect.stimulus}:{},holdEligible:effect.n===0});body.attention.eventId=null;
    const affectApplied=await this.applyEventAffect(c,s,e,body,now,eventAffect,effect.category);body=affectApplied.body;
    const repair=applyRepair(body,now,effect.category!=='direct_insult'&&canAttemptRepair(conversationEvidence)&&conversationEvidence?.repairTarget==='candidate'&&await this.repairEligible(c,body,conversationContext,now));body=repair.state;
    const repairUsed=repair.amount>0?{candidateEventId:conversationContext.repairCandidate!.eventId,candidateRevision:conversationContext.repairCandidate!.revision}:undefined;
    const previous=body.turn.recentSilences.find(record=>record.identityId===e.identity_id)??null;
    const previousSources=previous?await this.silenceSources(c,previous):null;
    const recentWithholdingEventId=previousSources&&previous?.reason==='withholding'&&conversation.data.turns.some(t=>t.source.kind==='event'&&t.source.id===previous.eventId&&t.source.revision===previous.eventRevision)?previous.eventId:undefined;
    // readConversation already checked ownership, revision, transcript digest and
    // completed delivery. Use those response refs, never arbitrary old utterances.
    const explained=previousSources&&previous?.reason==='withholding'?(await c.query("SELECT 1 FROM response_runs WHERE character_id=$1 AND session_id=$2 AND id=ANY($3::uuid[]) AND status='completed' AND plan->>'purpose'='reengage' AND plan->>'targetIdentityId'=$4 AND plan->'reengagement'->>'silenceEventId'=$5 AND plan->'reengagement'->>'disclosure' IN ('explain','partial') LIMIT 1",[this.characterId,e.session_id,conversation.data.turns.filter(t=>t.source.kind==='response').map(t=>t.source.id),e.identity_id,previous.eventId])).rowCount:false;
    const boundaryDelivered=previousSources&&previous?.reason==='withholding'?(await c.query("SELECT 1 FROM response_runs WHERE character_id=$1 AND session_id=$2 AND id=ANY($3::uuid[]) AND status='completed' AND plan->>'purpose'='set_boundary' AND plan->>'targetIdentityId'=$4 LIMIT 1",[this.characterId,e.session_id,conversation.data.turns.filter(t=>t.source.kind==='response').map(t=>t.source.id),e.identity_id])).rowCount:false;
    const plan=chooseSocial(body,appraisal,effect,e.identity_id,now,{text:e.payload.text,previousSilence:previousSources?previous:null,explainedSilenceEventId:explained?previous!.eventId:undefined,recentWithholdingEventId,recentBoundaryDelivered:!!boundaryDelivered,appraisalFailed:!!metadata.failureCode,previousOutputFailed:await this.previousOutputFailed(c,e.identity_id,previous),participationEvidence:this.participationEvidence(appraisal,metadata,e.id,e.identity_id,String(e.revision),conversationContext),conversationEvidence});plan.memoryIds=[...memoryIds];
    let silence:SilenceRecord|undefined;
    let acknowledgement:Row|undefined;
    if(plan.participation?.mode==='silent'&&plan.participation.reason==='no_addition'){
      acknowledgement=(await c.query("SELECT source.id,source.revision FROM transitions t JOIN events phase ON phase.id=t.source_event_id JOIN events source ON source.id=phase.parent_event_id JOIN appraisals a ON a.id=t.appraisal_id WHERE t.character_id=$1 AND phase.identity_id=$2 AND COALESCE(t.effects->>'category',a.result->>'act')=$3 AND t.effects->>'action' NOT IN ('listen','ignore') AND source.data_status='active' ORDER BY t.state_version DESC LIMIT 1",[this.characterId,e.identity_id,effect.category??appraisal.act])).rows[0];
      // A legacy or removed acknowledgement cannot support an intentional reason.
      if(!acknowledgement)plan.participation={mode:'defer'};
    }
    if(plan.participation?.mode==='silent'){
      // Only sources actually used by this decision, never arbitrary retrieved memories.
      const reasonIds=[...new Set([e.id,...appraisal.evidence_refs,...(acknowledgement?[acknowledgement.id]:[])])];
      // Zero additional stimulus does not erase existing same-person affect.
      // Bind its actual causes as dependencies; deletion/revision must invalidate
      // the reason instead of making a different speaker's mood its evidence.
      const affectIds=plan.participation.reason==='withholding'&&body.affect.frustration.value>0?body.affect.frustration.causes.filter(cause=>cause.targetId===e.identity_id&&!reasonIds.includes(cause.eventId)).map(cause=>cause.eventId):[];
      const sourceIds=[...reasonIds,...affectIds.slice(0,Math.max(0,40-reasonIds.length))];
      const refs=(await c.query("SELECT id,revision FROM events WHERE character_id=$1 AND id=ANY($2::uuid[]) AND data_status='active' AND observed_at IS NOT NULL ORDER BY id",[this.characterId,sourceIds])).rows;
      silence={eventId:e.id,eventRevision:String(e.revision),stateVersion:String(s.version+1n),identityId:e.identity_id,at:now,reason:plan.participation.reason,sourceRefs:refs.map(ref=>({kind:'event',id:ref.id,version:String(ref.revision)})),affect:this.emotion(body)};
      body.turn.recentSilences=[...body.turn.recentSilences.filter(record=>record.identityId!==e.identity_id),silence].slice(-20);
    }
    const reasonSources=plan.reengagement?.silenceEventId===previous?.eventId?previousSources:null;
    if(reasonSources)plan.memoryIds=[...new Set([...plan.memoryIds,...reasonSources.memoryIds])];
    if(conversationMemoryIds.length)plan.memoryIds=[...new Set([...plan.memoryIds,...conversationMemoryIds])];
    if(!['ignore','listen'].includes(plan.action)){body.turn.acknowledgements[`${e.identity_id}:${effect.category??appraisal.act}`]=now;}
    await this.project(c,s);await this.bump(c,s,phase,body,{stimulus:effect.stimulus,category:effect.category,...(affectEvidence?{affectEvidence}:{}),...(conversationEvidence?{conversationEvidence}:{}),...(repairUsed?{repairUsed,repair:{amount:repair.amount,inputEventId:e.id}}:{}),action:plan.action,participation:plan.participation,silence,reengagement:plan.reengagement,...(affectApplied.effect?{eventAffect:affectApplied.effect}:{})},appraisalId);
    const response=['ignore','listen'].includes(plan.action)?null:await this.response(c,s,e.session_id,phase,plan,[e,...(reasonSources?.events??[]),...conversationSources],conversation.data);return {status:'committed',response};
  });}
  async personalFacts(sessionId:string,identityId:string){return this.locked(c=>readPersonalFacts(c,{characterId:this.characterId,sessionId,identityId}));}
  async mutatePersonalFact(sessionId:string,identityId:string,requestId:string,input:PersonalFactChange,beforeInvalidate?:(responses:Row[])=>void){return this.locked(async(c,s)=>{
    await this.session(c,sessionId);const change=personalFactChangeSchema.parse(input),namespace=`studio:personal:${sessionId}`,inputHash=await this.digest(JSON.stringify({identityId,change}));
    const prior=(await c.query('SELECT * FROM events WHERE character_id=$1 AND source_namespace=$2 AND source_key=$3',[this.characterId,namespace,requestId])).rows[0];
    if(prior){if(prior.payload.inputHash!==inputHash)throw new RuntimeError('idempotency_conflict');return {status:'duplicate',eventId:prior.id,result:prior.payload.result};}
    const result=await changePersonalFact(c,{characterId:this.characterId,sessionId,identityId},change);
    // Empty snapshots depend on the collection too; completed replies may be reused by a later session.
    const ids=(await c.query("SELECT id FROM response_runs WHERE character_id=$1 AND personal_context->>'identityId'=$2",[this.characterId,identityId])).rows.map(row=>row.id);
    const active=ids.length?(await c.query(`SELECT id,generation_epoch FROM response_runs WHERE character_id=$1 AND status IN ${activeResponses}`,[this.characterId])).rows:[];
    if(ids.length)await this.invalidateOutputs(c,s,[],[],ids);
    const event=await this.event(c,sessionId,'personal.changed',requestId,{inputHash,result},identityId,null,namespace);
    await this.bump(c,s,event,decay(s.body,this.now(s)));beforeInvalidate?.(active);
    return {status:'committed',eventId:event.id,result};
  });}
  async knowledgeRevisions(sessionId:string,identityId:string){return this.locked(c=>knowledgeFences(c,{characterId:this.characterId,sessionId,identityId}));}
  async knowledgeDocuments(sessionId:string,identityId:string){return this.locked(c=>listKnowledgeDocuments(c,{characterId:this.characterId,sessionId,identityId}));}
  async knowledgeRevision(sessionId:string,identityId:string){return this.locked(c=>currentKnowledgeRevision(c,{characterId:this.characterId,sessionId,identityId}));}
  async mutateKnowledge(sessionId:string,identityId:string,requestId:string,input:KnowledgePut|{documentId:string;expectedRevision:string;delete:true},beforeInvalidate?:(responses:Row[])=>void){return this.locked(async(c,s)=>{
    await this.session(c,sessionId);const namespace=`studio:knowledge:${sessionId}`,inputHash=await this.digest(JSON.stringify({identityId,input}));
    const prior=(await c.query('SELECT * FROM events WHERE character_id=$1 AND source_namespace=$2 AND source_key=$3',[this.characterId,namespace,requestId])).rows[0];
    if(prior){if(prior.payload.inputHash!==inputHash)throw new RuntimeError('idempotency_conflict');return {status:'duplicate',eventId:prior.id,result:prior.payload.result};}
    const scope={characterId:this.characterId,sessionId,identityId};
    const result='delete' in input?await deleteKnowledgeDocument(c,scope,input):await putKnowledgeDocument(c,scope,input);
    // Even an empty retrieval depends on the collection revision. Added material
    // can change an absence or conflict answer while its model call is running.
    const knowledgeIds=(await c.query("SELECT id FROM response_runs WHERE character_id=$1 AND knowledge_context IS NOT NULL AND ((NOT $4 AND session_id=$2) OR ($4 AND plan->>'targetIdentityId'=$3))",[this.characterId,sessionId,identityId,result.retention==='persistent'])).rows.map(row=>row.id);
    const active=knowledgeIds.length?(await c.query(`SELECT id,generation_epoch FROM response_runs WHERE character_id=$1 AND status IN ${activeResponses}`,[this.characterId])).rows:[];
    // Reuse source-response closure: later ordinary replies may quote a search
    // answer. Redact those derived answers and their appraisal context as well.
    if(knowledgeIds.length)await this.invalidateOutputs(c,s,[],[],knowledgeIds);
    const event=await this.event(c,sessionId,'knowledge.changed',requestId,{inputHash,result},identityId,null,namespace);
    await this.bump(c,s,event,decay(s.body,this.now(s)));
    beforeInvalidate?.(active);return {status:'committed',eventId:event.id,result};
  });}
  private async cancelKnowledgeIn(c:Client,id:string,reason='knowledge_changed'){
    await c.query(`UPDATE response_runs SET status='cancelled',cancel_reason=$3,finished_at=$2 WHERE id=$1 AND status IN ${activeResponses}`,[id,new Date(this.clock()),reason]);
    await c.query("UPDATE speech_segments SET delivery_status='cancelled' WHERE response_id=$1 AND delivery_status<>'finished'",[id]);
    await this.resolveAttempt(c,id,'not_delivered');
  }
  private async personalValid(c:Client,sessionId:string,identityId:string,snapshot:unknown){
    const parsed=personalFactSnapshotSchema.safeParse(snapshot);if(!parsed.success)return false;
    const personal=parsed.data;if(personal.characterId!==this.characterId||personal.identityId!==identityId)return false;
    if(!(await c.query("SELECT 1 FROM sessions WHERE id=$1 AND character_id=$2 AND status='active'",[sessionId,this.characterId])).rowCount)return false;
    const current=await readPersonalFacts(c,{characterId:this.characterId,sessionId,identityId});
    return current.revision===personal.revision&&current.facts.length===personal.facts.length&&current.facts.every((fact,i)=>{const expected=personal.facts[i]!;return fact.id===expected.id&&fact.revision===expected.revision&&fact.key===expected.key&&fact.value===expected.value;});
  }
  private async knowledgeValid(c:Client,sessionId:string,identityId:string,knowledge:DialogueKnowledge){
    if(!knowledge||typeof knowledge.query!=='string'||!Array.isArray(knowledge.chunks)||knowledge.chunks.length>5)return false;
    const session=(await c.query("SELECT knowledge_revision FROM sessions WHERE id=$1 AND character_id=$2 AND status='active'",[sessionId,this.characterId])).rows[0];
    if(!session||String(session.knowledge_revision)!==knowledge.revision)return false;
    if(knowledge.libraryRevision!==undefined){const library=(await c.query('SELECT revision FROM knowledge_libraries WHERE character_id=$1 AND identity_id=$2',[this.characterId,identityId])).rows[0];if(String(library?.revision??'0')!==knowledge.libraryRevision)return false;}
    const seen=new Set<string>();
    for(const chunk of knowledge.chunks){
      if(!chunk||typeof chunk.documentId!=='string'||typeof chunk.revision!=='string'||typeof chunk.chunkId!=='string')return false;
      const key=`${chunk.documentId}:${chunk.revision}:${chunk.chunkId}`;if(seen.has(key))return false;seen.add(key);
      const row=(await c.query(`SELECT d.title,c.body,c.ordinal FROM knowledge_documents d JOIN knowledge_chunks c ON c.document_id=d.id AND c.revision=d.revision
        WHERE d.id::text=$1 AND d.revision::text=$2 AND c.chunk_id=$3 AND d.character_id=$4 AND ((d.retention='session' AND d.session_id=$5) OR (d.retention='persistent' AND $7)) AND d.identity_id=$6 AND d.deleted_at IS NULL`,[chunk.documentId,chunk.revision,chunk.chunkId,this.characterId,sessionId,identityId,knowledge.libraryRevision!==undefined])).rows[0];
      if(!row||row.title!==chunk.title||row.body!==chunk.text||row.ordinal!==chunk.ordinal)return false;
    }return true;
  }
  async commitKnowledge(selected:NonNullable<Awaited<ReturnType<Store['select']>>>,result:KnowledgeSearchResult,revision:string,libraryRevision?:string){return this.locked(async(c,s)=>{
    const e=(await c.query("SELECT * FROM events WHERE character_id=$1 AND id=$2 AND attention_status='selected' AND data_status='active'",[this.characterId,selected.event.id])).rows[0];
    if(!e||BigInt(e.revision)!==selected.revision||s.generationEpoch!==selected.generationEpoch||s.configVersion!==selected.configVersion)throw new RuntimeError('stale_source');
    if(e.payload.intent!=='knowledge'||result.query!==e.payload.text)throw new RuntimeError('invalid_knowledge_source');
    const knowledge:DialogueKnowledge={query:result.query,chunks:result.chunks,revision,...(libraryRevision===undefined?{}:{libraryRevision})};
    if(!await this.knowledgeValid(c,e.session_id,e.identity_id,knowledge))throw new RuntimeError('knowledge_changed');
    const phase=await this.event(c,e.session_id,'appraisal.applied',`knowledge_applied:${e.id}:${e.revision}`,{eventId:e.id},e.identity_id,e.id);
    const body=decay(s.body,this.now(s));body.attention.eventId=null;
    const plan:Plan={...dialoguePlan(body,'knowledge_answer',e.identity_id),action:'answer',maxSentences:2,participation:{mode:'speak'}};
    await c.query("UPDATE events SET attention_status='observed',applied_at=$2 WHERE id=$1",[e.id,new Date(this.now(s))]);
    await this.bump(c,s,phase,body,{action:'answer',purpose:'knowledge_answer'});
    const response=await this.response(c,s,e.session_id,phase,plan,[e]);if(!response)throw new RuntimeError('output_busy');
    await c.query('UPDATE response_runs SET knowledge_context=$2 WHERE id=$1',[response.id,knowledge]);return {status:'committed',response};
  });}
  async failKnowledge(eventId:string,code:string){return this.locked(async(c,s)=>{
    const e=(await c.query("SELECT * FROM events WHERE id=$1 AND character_id=$2 AND attention_status='selected'",[eventId,this.characterId])).rows[0];if(!e)return;
    await c.query("UPDATE events SET attention_status='expired' WHERE id=$1",[e.id]);
    const phase=await this.event(c,e.session_id,'knowledge.failed',`knowledge_failed:${e.id}:${e.revision}`,{eventId,code},e.identity_id,e.id),body=decay(s.body,this.now(s));
    if(body.attention.eventId===e.id)body.attention.eventId=null;await this.bump(c,s,phase,body,{failureCode:code});
  });}
  async latestKnowledgeAnswer(sessionId:string,identityId:string){return this.locked(async(c)=>{
    await currentKnowledgeRevision(c,{characterId:this.characterId,sessionId,identityId});
    const r=(await c.query("SELECT * FROM response_runs WHERE character_id=$1 AND session_id=$2 AND plan->>'targetIdentityId'=$3 AND knowledge_context IS NOT NULL ORDER BY created_at DESC,id DESC LIMIT 1",[this.characterId,sessionId,identityId])).rows[0];
    if(!r||!await this.knowledgeValid(c,sessionId,identityId,r.knowledge_context))return null;
    const answer=r.knowledge_context.answer as KnowledgeAnswer|undefined;
    // No unspoken or cancelled generated answer is presented as a delivered fact.
    if(!['delivering','completed'].includes(r.status)||!answer)return {responseId:r.id,status:r.status,sentences:[],citations:[]};
    const shown=(await c.query('SELECT text FROM speech_segments WHERE response_id=$1 AND text_shown_at IS NOT NULL ORDER BY segment_index',[r.id])).rows.map(row=>row.text);
    return {responseId:r.id,status:r.status,sentences:shown,answerStatus:answer.status,citations:shown.length?this.knowledgeCitations(r.knowledge_context,answer):[]};
  });}
  private knowledgeCitations(knowledge:DialogueKnowledge,answer:KnowledgeAnswer){
    if(!['answered','not_found','conflict'].includes(answer.status)||!Array.isArray(answer.citationIds)||new Set(answer.citationIds).size!==answer.citationIds.length||answer.status==='not_found'&&answer.citationIds.length!==0||answer.status==='answered'&&!answer.citationIds.length||answer.status==='conflict'&&answer.citationIds.length<2)throw new RuntimeError('invalid_knowledge_answer',503);
    return answer.citationIds.map(id=>{if(!/^K[1-5]$/.test(id))throw new RuntimeError('invalid_knowledge_citation',503);const chunk=knowledge.chunks[Number(id.slice(1))-1];if(!chunk)throw new RuntimeError('invalid_knowledge_citation',503);return chunk;});
  }
  async busy(){return !!(await this.db.pool.query(`SELECT 1 FROM response_runs WHERE character_id=$1 AND status IN ${activeResponses}`,[this.characterId])).rowCount;}
  async validResponse(c:Client,id:string,s:VersionedState){const r=(await c.query(`SELECT r.* FROM response_runs r JOIN sessions ses ON ses.id=r.session_id WHERE r.id=$1 AND r.character_id=$2 AND r.status IN ${activeResponses} AND ses.status='active' AND r.generation_epoch=$3 AND NOT EXISTS(SELECT 1 FROM response_sources rs LEFT JOIN events e ON e.id=rs.event_id LEFT JOIN memories m ON m.id=rs.memory_id WHERE rs.response_id=r.id AND ((rs.event_id IS NOT NULL AND (e.data_status<>'active' OR e.revision<>rs.source_version)) OR (rs.memory_id IS NOT NULL AND (m.status<>'active' OR m.content_version<>rs.source_version))))`,[id,this.characterId,s.generationEpoch.toString()])).rows[0];if(r?.knowledge_context&&!await this.knowledgeValid(c,r.session_id,r.plan?.targetIdentityId,r.knowledge_context)){await this.cancelKnowledgeIn(c,r.id);return null;}if(r?.personal_context&&!await this.personalValid(c,r.session_id,r.plan?.targetIdentityId,r.personal_context)){await this.cancelKnowledgeIn(c,r.id,'personal_changed');return null;}if(r?.conversation_refs&&!await this.readConversation(c,r.conversation_refs))return null;return r??null;}
  async dialogueIdentities(ids:(string|null|undefined)[]){
    const referenced=[...new Set(ids.filter((id):id is string=>typeof id==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)))];
    return (await this.db.pool.query('SELECT id,display_name AS "displayName" FROM identities WHERE id=ANY($1::uuid[]) ORDER BY id',[referenced])).rows as {id:string;displayName:string}[];
  }
  async responseContext(id:string){return this.locked((c,s)=>this.responseContextIn(c,s,id));}
  async fitResponseConversation(id:string,conversation:ConversationSnapshot|undefined){return this.locked(async(c,s)=>{
    const r=await this.validResponse(c,id,s);if(!r||r.status!=='planned'||!r.plan)return null;
    const original=r.conversation_refs?await this.readConversation(c,r.conversation_refs):undefined;
    if(original?!conversation||!isConversationSuffix(original,conversation):conversation!==undefined)throw new RuntimeError('invalid_conversation',400);
    if(conversation)await c.query('UPDATE response_runs SET conversation_refs=$2 WHERE id=$1',[id,await this.conversationRefs(conversation)]);
    return this.responseContextIn(c,s,id);
  });}
  private async responseContextIn(c:Client,s:VersionedState,id:string){
    const r=(await c.query('SELECT * FROM response_runs WHERE id=$1 AND character_id=$2',[id,this.characterId])).rows[0];if(!r)throw new RuntimeError('response_not_found',404);
    if(r.knowledge_context&&!await this.knowledgeValid(c,r.session_id,r.plan?.targetIdentityId,r.knowledge_context))throw new RuntimeError('knowledge_changed');
    if(r.personal_context&&!await this.personalValid(c,r.session_id,r.plan?.targetIdentityId,r.personal_context))throw new RuntimeError('personal_changed');
    const allSources=(await c.query("SELECT e.id,e.kind,e.payload,e.parent_event_id FROM response_sources rs JOIN events e ON e.id=rs.event_id WHERE rs.response_id=$1 AND e.data_status='active' AND e.revision=rs.source_version",[id])).rows;
    const originalHistory=(await c.query("SELECT ref->>'id' AS id FROM transitions t JOIN appraisals a ON a.id=t.appraisal_id CROSS JOIN LATERAL jsonb_array_elements(a.context_refs) ref WHERE t.source_event_id=$1 AND a.character_id=$2 AND ref->>'kind'='event'",[r.trigger_event_id,this.characterId])).rows.map(row=>row.id);
    const memories=(await c.query("SELECT m.id,m.content,m.content_version,m.facts,(SELECT jsonb_agg(identity_id) FROM memory_participants p WHERE p.memory_id=m.id) AS participants FROM response_sources rs JOIN memories m ON m.id=rs.memory_id WHERE rs.response_id=$1 AND m.status='active' AND m.content_version=rs.source_version",[id])).rows;
    const record:SilenceRecord|undefined=r.plan?.reengagement?.silenceEventId?(await c.query("SELECT effects->'silence' AS record FROM transitions WHERE character_id=$1 AND effects->'silence'->>'eventId'=$2 ORDER BY state_version DESC LIMIT 1",[this.characterId,r.plan.reengagement.silenceEventId])).rows[0]?.record:undefined;
    const silence=record&&record.identityId===r.plan.targetIdentityId&&await this.silenceSources(c,record)?record:null;
    const reasonEvents=silence?[silence.eventId,...silence.sourceRefs.filter(ref=>ref.kind==='event').map(ref=>ref.id)]:[];
    const trigger=allSources.find(source=>source.id===r.trigger_event_id),inputId=trigger?.payload?.eventId;
    // Tone dependencies are deletion/revision fences, not permission to retell
    // old input. Recent conversation and an authorized reason have their own paths.
    const sources=allSources.filter(source=>(!originalHistory.includes(source.id)||reasonEvents.includes(source.id))&&(!r.plan?.speechStyle||[r.trigger_event_id,inputId,trigger?.parent_event_id,...reasonEvents].includes(source.id)));
    const currentInput=sources.find(source=>source.id===inputId)??null;
    const identities=await this.dialogueIdentities([r.plan?.targetIdentityId,...sources.map(e=>e.payload?.identityId),...memories.flatMap(m=>[...(m.participants??[]),m.facts?.identityId])]);
    const conversation=r.conversation_refs?await this.readConversation(c,r.conversation_refs):undefined;if(r.conversation_refs&&!conversation)throw new RuntimeError('stale_source');
    // Persona values are bound to the response's config version and never edited in place.
    const persona=(await c.query('SELECT kind,text FROM character_persona_values WHERE character_id=$1 AND config_version=$2 ORDER BY ordinal',[this.characterId,r.config_version])).rows.map(v=>({kind:v.kind,text:v.text}));
    return {response:r,context:{...(persona.length?{persona}:{}),...(r.knowledge_context?{knowledge:r.knowledge_context}:{}),...(r.personal_context?{personalFacts:r.personal_context}:{}),currentInput,sources,memories,identities,silence,conversation:conversation??undefined,emotion:this.emotion(decay(s.body,this.now(s)))} satisfies DialogueContext};
  }
  async generated(id:string,sentences:string[],owner:{clientId:string;outputEpoch:bigint}|null,answer?:KnowledgeAnswer,turn?:DialogueTurn){return this.locked(async(c,s)=>{const r=await this.validResponse(c,id,s);if(!r)return null;if(!owner){await c.query("UPDATE response_runs SET status='failed',cancel_reason='stage_unavailable',finished_at=$2 WHERE id=$1",[id,new Date(this.clock())]);await this.resolveAttempt(c,id,'not_delivered');return null;}
    const session=await this.session(c,r.session_id);if(BigInt(session.output_epoch)!==owner.outputEpoch)return null;
    let knowledge: {status:KnowledgeAnswer['status'];citations:ReturnType<Store['knowledgeCitations']>}|undefined;
    if(r.knowledge_context){
      if(!answer||JSON.stringify(answer.sentences)!==JSON.stringify(sentences))throw new RuntimeError('invalid_knowledge_answer',503);
      knowledge={status:answer.status,citations:this.knowledgeCitations(r.knowledge_context,answer)};
      await c.query('UPDATE response_runs SET knowledge_context=$2 WHERE id=$1',[id,{...r.knowledge_context,answer}]);
    }else if(answer)throw new RuntimeError('invalid_knowledge_answer',503);
    await c.query("UPDATE response_runs SET status='delivering',segment_count=$2 WHERE id=$1",[id,sentences.length]);const segments=[];
    if(turn&&JSON.stringify(turn.sentences)!==JSON.stringify(sentences))throw new RuntimeError('invalid_output',503);
    // A suggestion annotation stays a candidate until every segment is delivered.
    if(turn?.annotationStatus==='candidate'&&turn.recommendations[0]&&!r.knowledge_context&&r.plan?.targetIdentityId)await c.query("INSERT INTO action_episodes(id,character_id,owner_id,response_id,status,annotation) VALUES($1,$2,$3,$4,'candidate',$5)",[randomUUID(),this.characterId,r.plan.targetIdentityId,id,turn.recommendations[0]]);
    for(let i=0;i<sentences.length;i++){const segmentId=randomUUID();await c.query("INSERT INTO speech_segments(id,character_id,response_id,segment_index,text,synthesis_status,delivery_status,output_epoch,playback_client_id) VALUES($1,$2,$3,$4,$5,'ready','sent',$6,$7)",[segmentId,this.characterId,id,i,sentences[i],owner.outputEpoch.toString(),owner.clientId]);segments.push({id:segmentId,text:sentences[i],index:i});}
    return {response:r,segments,outputEpoch:owner.outputEpoch,...(knowledge?{knowledge}:{})};
  });}
  private async confirmEpisode(c:Client,responseId:string){
    const a=(await c.query("SELECT a.id,a.owner_id,a.annotation,r.segment_count,r.trigger_event_id FROM action_episodes a JOIN response_runs r ON r.id=a.response_id WHERE a.character_id=$1 AND a.response_id=$2 AND a.status='candidate' FOR UPDATE OF a",[this.characterId,responseId])).rows[0];if(!a)return;
    const segments=(await c.query('SELECT id,segment_index,text,text_shown_at,delivery_status,updated_at FROM speech_segments WHERE response_id=$1 ORDER BY segment_index',[responseId])).rows;
    const input=(await c.query("SELECT i.id,i.revision FROM events p JOIN events i ON i.id=p.parent_event_id WHERE p.id=$1 AND i.data_status='active'",[a.trigger_event_id])).rows[0];
    const episode=input?confirmDeliveredRecommendation({id:a.id,scope:{ownerId:a.owner_id,characterId:this.characterId},responseId,responseRevision:'1',status:'completed',expectedSegments:a.segment_count,
      segments:segments.map(x=>({id:x.id,index:x.segment_index,text:x.text,shownAt:x.text_shown_at?.getTime()??null,finishedAt:x.delivery_status==='finished'?x.updated_at.getTime():null})),annotation:a.annotation,sourceRefs:[{sourceId:input.id,revision:String(input.revision)}]}):null;
    if(episode)await c.query("UPDATE action_episodes SET status='active',annotation=NULL,episode=$2,delivered_at=$3 WHERE id=$1",[a.id,episode,new Date(episode.deliveredAt)]);
    else await c.query("UPDATE action_episodes SET status='rejected',annotation=NULL,closed_at=$2 WHERE id=$1",[a.id,new Date(this.clock())]);
  }
  async failResponse(id:string,code:string){return this.locked(async(c,s)=>{await c.query(`UPDATE response_runs SET status='failed',cancel_reason=$3,finished_at=$4 WHERE id=$1 AND character_id=$2 AND status IN ${activeResponses}`,[id,this.characterId,code,new Date(this.clock())]);await this.resolveAttempt(c,id,'not_delivered');});}
  private async resolveAttempt(c:Client,responseId:string,status:'not_delivered'|'unknown') {const a=(await c.query("UPDATE agenda_attempts SET delivery_status=$2,resolved_at=$3 WHERE response_id=$1 AND delivery_status='reserved' RETURNING agenda_id",[responseId,status,new Date(this.clock())])).rows[0];if(a)await c.query("UPDATE agendas SET status=$2,closed_reason=$3 WHERE id=$1 AND status='reserved'",[a.agenda_id,status==='not_delivered'?'pending':'expired',status]);}
  async report(sessionId:string,requestId:string,type:'caption.shown'|'caption.finished',body:{responseId:string;segmentId:string;generationEpoch:string;outputEpoch:string},clientId:string){return this.locked(async(c,s)=>{
    await this.session(c,sessionId);const segment=(await c.query('SELECT ss.*,r.session_id,r.generation_epoch,r.status AS response_status,r.segment_count,r.personal_context,r.knowledge_context,r.plan FROM speech_segments ss JOIN response_runs r ON r.id=ss.response_id WHERE ss.id=$1 AND ss.character_id=$2 FOR UPDATE OF ss',[body.segmentId,this.characterId])).rows[0];
    if(!segment||segment.response_id!==body.responseId||segment.session_id!==sessionId||segment.playback_client_id!==clientId||segment.output_epoch!==body.outputEpoch||segment.generation_epoch!==body.generationEpoch)throw new RuntimeError('forbidden',403);
    const namespace=`stage:${body.outputEpoch}:${clientId}`;
    const existing=(await c.query('SELECT *,payload=$4::jsonb AS same_payload FROM events WHERE character_id=$1 AND source_namespace=$2 AND source_key=$3',[this.characterId,namespace,requestId,body])).rows[0];
    if(existing){if(existing.kind!==type||!existing.same_payload)throw new RuntimeError('idempotency_conflict');return {status:'duplicate',eventId:existing.id};}
    if(['cancelled','interrupted','failed'].includes(segment.response_status)||s.generationEpoch.toString()!==body.generationEpoch)throw new RuntimeError('stale_epoch');
    if(segment.personal_context&&!await this.personalValid(c,sessionId,segment.plan?.targetIdentityId,segment.personal_context))throw new RuntimeError('personal_changed');
    if(segment.knowledge_context&&!await this.knowledgeValid(c,sessionId,segment.plan?.targetIdentityId,segment.knowledge_context))throw new RuntimeError('knowledge_changed');
    if(type==='caption.finished'&&!segment.text_shown_at)throw new RuntimeError('report_out_of_order');
    const event=await this.event(c,sessionId,type,requestId,body,null,null,namespace);
    if(type==='caption.shown')await c.query('UPDATE speech_segments SET text_shown_at=COALESCE(text_shown_at,$2),updated_at=$2 WHERE id=$1',[segment.id,new Date(this.clock())]);
    else await c.query("UPDATE speech_segments SET delivery_status='finished',updated_at=$2 WHERE id=$1",[segment.id,new Date(this.clock())]);
    const all=(await c.query('SELECT * FROM speech_segments WHERE response_id=$1 ORDER BY segment_index',[body.responseId])).rows;
    if(all.length===segment.segment_count&&all.every(x=>x.text_shown_at)) {
      const attempt=(await c.query("UPDATE agenda_attempts SET delivery_status='delivered_text',resolved_at=COALESCE(resolved_at,$2) WHERE response_id=$1 AND delivery_status='reserved' RETURNING *",[body.responseId,new Date(this.clock())])).rows[0];
      if(attempt){await c.query("UPDATE agendas SET status='offered',offered_at=$2 WHERE id=$1 AND status='reserved'",[attempt.agenda_id,new Date(this.clock())]);const agenda=(await c.query('SELECT * FROM agendas WHERE id=$1',[attempt.agenda_id])).rows[0];await this.memory(c,sessionId,agenda.activity_run_id,`delivered_proposal:${agenda.activity_run_id}:${attempt.id}`,'delivered_proposal','남겨 둔 퍼즐을 이어 하자고 제안했다.',{agendaId:agenda.id,result:'offered'},[{event,role:'delivered'}],[]);}
    }
    if(all.length===segment.segment_count&&all.every(x=>x.delivery_status==='finished')){const done=await c.query("UPDATE response_runs SET status='completed',finished_at=$2 WHERE id=$1 AND status='delivering'",[body.responseId,new Date(this.clock())]);if(done.rowCount)await this.confirmEpisode(c,body.responseId);await c.query('UPDATE sessions SET last_output_end_at=$2 WHERE id=$1',[sessionId,new Date(this.clock())]);}
    await this.bump(c,s,event,decay(s.body,this.now(s)));return {status:'committed',eventId:event.id};
  });}
  async cancel(sessionId:string,requestId:string,reason:string,responseId?:string){return this.locked(async(c,s)=>{await this.session(c,sessionId,false);
    const prior=(await c.query("SELECT *,payload=$3::jsonb AS same_payload FROM events WHERE character_id=$1 AND source_namespace='studio:cancel' AND source_key=$2",[this.characterId,requestId,{reason,responseId:responseId??null}])).rows[0];if(prior){if(!prior.same_payload)throw new RuntimeError('idempotency_conflict');return {status:'duplicate',eventId:prior.id,generationEpoch:s.generationEpoch};}
    if(responseId&&!(await c.query(`SELECT 1 FROM response_runs WHERE id=$1 AND character_id=$2 AND session_id=$3 AND status IN ${activeResponses}`,[responseId,this.characterId,sessionId])).rowCount)throw new RuntimeError('stale_response');
    const e=await this.event(c,sessionId,'output.cancelled',requestId,{reason,responseId:responseId??null},null,null,'studio:cancel');s.generationEpoch++;
    const responses=(await c.query(`UPDATE response_runs SET status='cancelled',cancel_reason=$3,finished_at=$4 WHERE character_id=$1 AND session_id=$2 AND status IN ${activeResponses} RETURNING id`,[this.characterId,sessionId,reason,new Date(this.clock())])).rows;
    for(const r of responses){const any=(await c.query('SELECT 1 FROM speech_segments WHERE response_id=$1 AND text_shown_at IS NOT NULL',[r.id])).rowCount;await c.query("UPDATE speech_segments SET delivery_status=CASE WHEN delivery_status='finished' THEN delivery_status ELSE 'cancelled' END WHERE response_id=$1",[r.id]);await this.resolveAttempt(c,r.id,any?'unknown':'not_delivered');}
    await this.bump(c,s,e,decay(s.body,this.now(s)));return {status:'committed',eventId:e.id,generationEpoch:s.generationEpoch};
  });}
  async grantOwner(sessionId:string,requestId:string,clientId:string){return this.locked(async(c,s)=>{
    const ses=await this.session(c,sessionId);const old=(await c.query("SELECT * FROM events WHERE character_id=$1 AND source_namespace='studio:owner' AND source_key=$2",[this.characterId,requestId])).rows[0];
    if(old){if(old.session_id!==sessionId||old.payload.clientId!==clientId)throw new RuntimeError('idempotency_conflict');return {status:'duplicate',eventId:old.id,outputEpoch:BigInt(old.payload.outputEpoch)};}
    const epoch=BigInt(ses.output_epoch)+1n;const e=await this.event(c,sessionId,'output.owner_changed',requestId,{clientId,outputEpoch:epoch.toString()},null,null,'studio:owner');
    await c.query('UPDATE sessions SET output_epoch=$2 WHERE id=$1',[sessionId,epoch.toString()]);await this.bump(c,s,e,decay(s.body,this.now(s)));return {status:'committed',eventId:e.id,outputEpoch:epoch};
  });}
  async problems(){return (await this.db.pool.query('SELECT problem_id,public_prompt,answer_format, (SELECT jsonb_agg(h->>\'id\') FROM jsonb_array_elements(registered_hints) h) AS hint_ids FROM problems ORDER BY problem_id')).rows;}
  async activity(){return (await this.db.pool.query("SELECT a.*,p.public_prompt,p.answer_format FROM activity_runs a JOIN problems p USING(problem_id) WHERE a.character_id=$1 AND a.status IN ('ready','solving','awaiting_hint')",[this.characterId])).rows[0]??null;}
  async activityContext(id:string){
    const a=(await this.db.pool.query('SELECT a.*,p.public_prompt,p.answer_format FROM activity_runs a JOIN problems p USING(problem_id) WHERE a.id=$1 AND a.character_id=$2',[id,this.characterId])).rows[0];if(!a)throw new RuntimeError('activity_not_found',404);
    const steps=(await this.db.pool.query("SELECT s.kind,s.normalized_answer,s.verdict,e.payload FROM activity_steps s JOIN events e ON e.id=s.event_id WHERE s.activity_run_id=$1 AND s.data_status='active' AND e.data_status='active' ORDER BY s.step_no",[id])).rows;
    return {activity:a,context:{prompt:a.public_prompt,answerFormat:a.answer_format,steps:steps.map(x=>({kind:x.kind,answer:x.normalized_answer,verdict:x.verdict,...(x.kind==='hint_used'?{hint:x.payload.hint}:{} )}))}};
  }
  async startActivity(sessionId:string,requestId:string,problemId:string){return this.locked(async(c,s)=>{
    await this.session(c,sessionId);const namespace=`studio:activity.start:${sessionId}`;
    const old=(await c.query('SELECT * FROM events WHERE character_id=$1 AND source_namespace=$2 AND source_key=$3',[this.characterId,namespace,requestId])).rows[0];if(old){if(old.payload.problemId!==problemId)throw new RuntimeError('idempotency_conflict');return {status:'duplicate',eventId:old.id,activityId:old.payload.activityId};}
    if((await c.query("SELECT 1 FROM activity_runs WHERE character_id=$1 AND status IN ('ready','solving','awaiting_hint')",[this.characterId])).rowCount)throw new RuntimeError('activity_exists');
    if(!(await c.query('SELECT 1 FROM problems WHERE problem_id=$1',[problemId])).rowCount)throw new RuntimeError('problem_not_found',404);
    const activityId=randomUUID(),now=this.now(s);
    await c.query("INSERT INTO activity_runs(id,character_id,problem_id,started_session_id,last_session_id,status,version,hints_used,auto_attempts_used,auto_attempts_granted,last_step_no,started_at) VALUES($1,$2,$3,$4,$4,'solving',1,0,0,3,0,$5)",[activityId,this.characterId,problemId,sessionId,new Date(now)]);
    const e=await this.event(c,sessionId,'activity.started',requestId,{activityId,problemId},null,null,namespace);
    const previous=(await c.query("SELECT 1 FROM events WHERE character_id=$1 AND kind='activity.started' AND payload->>'problemId'=$2 AND id<>$3 AND data_status='active'",[this.characterId,problemId,e.id])).rowCount;
    await this.bump(c,s,e,apply(s.body,{eventId:e.id,targetId:problemId,now,stimuli:previous?{}:{surprise:.12}}));return {status:'committed',eventId:e.id,activityId};
  });}
  async needsHint(sessionId:string,activityId:string,expected?:{generationEpoch:bigint;activityVersion:bigint}){return this.locked(async(c,s)=>{
    await this.session(c,sessionId);const a=(await c.query('SELECT * FROM activity_runs WHERE character_id=$1 AND id=$2 FOR UPDATE',[this.characterId,activityId])).rows[0];
    if(!a||a.status!=='solving'||a.hints_used>=1||a.auto_attempts_used>=a.auto_attempts_granted)return null;
    if((await c.query(`SELECT 1 FROM response_runs WHERE character_id=$1 AND status IN ${activeResponses}`,[this.characterId])).rowCount)throw new RuntimeError('output_busy');
    if(expected&&(s.generationEpoch!==expected.generationEpoch||BigInt(a.version)!==expected.activityVersion))throw new RuntimeError('stale_result');
    const e=await this.event(c,sessionId,'activity.hint_requested',`hint_request:${activityId}:${a.version}`,{activityId},null,null);
    await c.query("UPDATE activity_runs SET status='awaiting_hint',version=version+1,last_session_id=$2 WHERE id=$1",[activityId,sessionId]);
    const target=(await c.query("SELECT DISTINCT e.identity_id, (SELECT count(*) FROM relationship_evidence re WHERE re.character_id=$1 AND re.identity_id=e.identity_id AND re.kind='verified_hint' AND re.status='active' AND re.problem_id=$3) AS help, max(e.observed_at) AS recent FROM events e WHERE e.character_id=$1 AND e.session_id=$2 AND e.identity_id IS NOT NULL AND e.attention_status='observed' AND e.kind='chat.final' AND e.data_status='active' GROUP BY e.identity_id ORDER BY help DESC,recent DESC,e.identity_id LIMIT 1",[this.characterId,sessionId,a.problem_id])).rows[0]?.identity_id??null;
    await this.bump(c,s,e,decay(s.body,this.now(s)));const plan=dialoguePlan(s.body,'request_hint',target);plan.activityId=activityId;return this.response(c,s,sessionId,e,plan);
  });}
  async hint(sessionId:string,requestId:string,activityId:string,hintId:string,identityId:string){return this.locked(async(c,s)=>{
    await this.session(c,sessionId);const namespace=`studio:hint:${activityId}`;
    const existing=(await c.query('SELECT * FROM events WHERE character_id=$1 AND source_namespace=$2 AND source_key=$3',[this.characterId,namespace,requestId])).rows[0];if(existing){if(existing.payload.hintId!==hintId||existing.identity_id!==identityId)throw new RuntimeError('idempotency_conflict');return {status:'duplicate',eventId:existing.id};}
    const a=(await c.query('SELECT a.*,p.registered_hints FROM activity_runs a JOIN problems p USING(problem_id) WHERE a.character_id=$1 AND a.id=$2 FOR UPDATE OF a',[this.characterId,activityId])).rows[0];
    if(!a||!['solving','awaiting_hint'].includes(a.status)||a.hints_used>=1)throw new RuntimeError('hint_budget_exhausted');
    const h=a.registered_hints.find((h:Row)=>h.id===hintId);if(!h)throw new RuntimeError('hint_not_found',404);
    if(!(await c.query("SELECT 1 FROM events WHERE character_id=$1 AND session_id=$2 AND identity_id=$3 AND kind='chat.final' AND attention_status='observed' AND data_status='active'",[this.characterId,sessionId,identityId])).rowCount)throw new RuntimeError('participant_not_observed');
    const event=await this.event(c,sessionId,'activity.hint_used',requestId,{activityId,hintId,hint:h.text},identityId,null,namespace);
    await c.query("INSERT INTO activity_steps(id,character_id,activity_run_id,step_no,event_id,kind,identity_id,hint_id,data_status,applied_at) VALUES($1,$2,$3,$4,$5,'hint_used',$6,$7,'active',$8)",[randomUUID(),this.characterId,activityId,(BigInt(a.last_step_no)+1n).toString(),event.id,identityId,hintId,new Date(this.now(s))]);
    await c.query("UPDATE activity_runs SET hints_used=hints_used+1,status='solving',version=version+1,last_step_no=last_step_no+1,last_session_id=$2 WHERE id=$1",[activityId,sessionId]);
    await this.memory(c,sessionId,activityId,`verified_help:${activityId}:${event.id}`,'verified_help','등록된 힌트를 사용했다.',{identityId,hintId,result:'hint_used'},[{event,role:'hint_used'}],[identityId]);
    await this.bump(c,s,event,decay(s.body,this.now(s)));return {status:'committed',eventId:event.id};
  });}
  async submitCandidate(sessionId:string,activityId:string,answer:string,expected:{generationEpoch:bigint;activityVersion:bigint},submissionId=randomUUID()){return this.locked(async(c,s)=>{
    await this.session(c,sessionId);const a=(await c.query('SELECT a.*,p.answer_format,p.validator_spec FROM activity_runs a JOIN problems p USING(problem_id) WHERE a.character_id=$1 AND a.id=$2 FOR UPDATE OF a',[this.characterId,activityId])).rows[0];
    if(!a||a.status!=='solving'||s.generationEpoch!==expected.generationEpoch||BigInt(a.version)!==expected.activityVersion)throw new RuntimeError('stale_result');
    if((await c.query(`SELECT 1 FROM response_runs WHERE character_id=$1 AND status IN ${activeResponses}`,[this.characterId])).rowCount)throw new RuntimeError('output_busy');
    if(a.auto_attempts_used>=a.auto_attempts_granted)throw new RuntimeError('attempt_budget_exhausted');
    const normalized=normalizeAnswer(answer,a.answer_format);
    if((await c.query("SELECT 1 FROM activity_steps WHERE activity_run_id=$1 AND kind='answer_submitted' AND normalized_answer=$2",[activityId,normalized])).rowCount)throw new RuntimeError('duplicate_candidate');
    const submitted=await this.event(c,sessionId,'activity.answer_submitted',`submit:${submissionId}`,{activityId,candidateAnswer:normalized});
    const verdict=judge(normalized,a.answer_format,a.validator_spec);
    const judged=await this.event(c,sessionId,'activity.answer_judged',`judge:${submissionId}`,{activityId,problemId:a.problem_id,verdict},null,submitted.id);
    for(const [offset,e,kind,value]of [[1,submitted,'answer_submitted',normalized],[2,judged,'answer_judged',verdict]] as const)await c.query('INSERT INTO activity_steps(id,character_id,activity_run_id,step_no,event_id,kind,normalized_answer,verdict,data_status,applied_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,\'active\',$9)',[randomUUID(),this.characterId,activityId,(BigInt(a.last_step_no)+BigInt(offset)).toString(),e.id,kind,kind==='answer_submitted'?value:null,kind==='answer_judged'?value:null,new Date(this.now(s))]);
    await c.query("UPDATE activity_runs SET status=$2,version=version+1,auto_attempts_used=auto_attempts_used+1,last_step_no=last_step_no+2,last_session_id=$3,ended_at=$4 WHERE id=$1",[activityId,verdict==='correct'?'solved':'solving',sessionId,verdict==='correct'?new Date(this.now(s)):null]);
    const firstSuccess=verdict==='correct'&&!(await c.query("SELECT 1 FROM events WHERE character_id=$1 AND kind='activity.answer_judged' AND payload->>'problemId'=$2 AND payload->>'verdict'='correct' AND id<>$3 AND data_status='active'",[this.characterId,a.problem_id,judged.id])).rowCount;
    let body=apply(s.body,{eventId:judged.id,targetId:a.problem_id,now:this.now(s),stimuli:verdict==='correct'?(firstSuccess?{joy:.3}:{}):{frustration:.2,embarrassment:.2}});
    await this.memory(c,sessionId,activityId,`activity_result:${activityId}:${judged.id}`,'activity_result',`문제 ${a.problem_id}에 제출한 답이 ${verdict==='correct'?'정답':'오답'}으로 확인됐다.`,{problemId:a.problem_id,verdict},[{event:submitted,role:'submission'},{event:judged,role:'judgement'}],[]);
    if(verdict==='correct'){
      const hints=(await c.query("SELECT e.*,st.identity_id FROM activity_steps st JOIN events e ON e.id=st.event_id WHERE st.activity_run_id=$1 AND st.kind='hint_used' AND st.data_status='active' AND e.data_status='active' ORDER BY st.step_no",[activityId])).rows;
      for(const hint of hints){const evidence=await this.evidence(c,s,sessionId,hint.identity_id,`verified_hint:${a.problem_id}`,'verified_hint',[{event:hint,role:'hint_used'},{event:judged,role:'correct_result'}],activityId,{}, {},a.problem_id);if(evidence.inserted)body=apply(body,{eventId:judged.id,targetId:hint.identity_id,now:this.now(s),stimuli:{joy:.12}});
        await this.memory(c,sessionId,activityId,`verified_help:${activityId}:${evidence.id}`,'verified_help',`문제 ${a.problem_id}에서 상대의 등록 힌트를 사용한 뒤 정답을 확인했다.`,{identityId:hint.identity_id,problemId:a.problem_id,result:'verified_help'},[{event:hint,role:'hint_used'},{event:judged,role:'correct_result'}],[hint.identity_id]);}
      await c.query("UPDATE agendas SET status='expired',closed_reason='activity_solved' WHERE character_id=$1 AND activity_run_id=$2 AND status IN ('pending','reserved','offered')",[this.characterId,activityId]);
      await c.query("UPDATE memories SET status='invalidated' WHERE character_id=$1 AND activity_run_id=$2 AND kind='unfinished_activity' AND status='active'",[this.characterId,activityId]);
    }
    await this.project(c,s);await this.bump(c,s,judged,body,{verdict});const plan=dialoguePlan(body,verdict==='correct'?'activity_correct':'activity_incorrect',null);plan.activityId=activityId;
    return {verdict,response:await this.response(c,s,sessionId,judged,plan,[submitted])};
  });}
  async activityCommand(sessionId:string,requestId:string,id:string,kind:'retry'|'end'|'resume'){return this.locked(async(c,s)=>{
    await this.session(c,sessionId);const namespace=`studio:activity.${kind}:${id}`;
    const prior=(await c.query('SELECT * FROM events WHERE character_id=$1 AND source_namespace=$2 AND source_key=$3',[this.characterId,namespace,requestId])).rows[0];if(prior)return {status:'duplicate',eventId:prior.id};
    const a=(await c.query('SELECT * FROM activity_runs WHERE character_id=$1 AND id=$2 FOR UPDATE',[this.characterId,id])).rows[0];if(!a||['solved','ended'].includes(a.status))throw new RuntimeError('activity_closed');
    const e=await this.event(c,sessionId,`activity.${kind}`,requestId,{activityId:id},null,null,namespace);
    if(kind==='retry')await c.query("UPDATE activity_runs SET auto_attempts_granted=auto_attempts_granted+1,status='solving',version=version+1,last_session_id=$2 WHERE id=$1",[id,sessionId]);
    if(kind==='resume')await c.query("UPDATE activity_runs SET status='solving',version=version+1,last_session_id=$2 WHERE id=$1",[id,sessionId]);
    if(kind==='end'){await c.query("UPDATE activity_runs SET status='ended',ended_at=$2,version=version+1 WHERE id=$1",[id,new Date(this.now(s))]);await c.query("UPDATE agendas SET status='expired',closed_reason='activity_ended' WHERE character_id=$1 AND activity_run_id=$2 AND status IN ('pending','reserved','offered')",[this.characterId,id]);}
    if(kind!=='resume') {await c.query("INSERT INTO activity_steps(id,character_id,activity_run_id,step_no,event_id,kind,data_status,applied_at) VALUES($1,$2,$3,$4,$5,$6,'active',$7)",[randomUUID(),this.characterId,id,(BigInt(a.last_step_no)+1n).toString(),e.id,kind==='retry'?'retry_granted':'ended',new Date(this.now(s))]);await c.query('UPDATE activity_runs SET last_step_no=last_step_no+1 WHERE id=$1',[id]);}
    await this.bump(c,s,e,decay(s.body,this.now(s)));return {status:'committed',eventId:e.id};
  });}
  private async consolidate(c:Client,s:VersionedState,sessionId:string){
    const a=(await c.query("SELECT * FROM activity_runs WHERE character_id=$1 AND last_session_id=$2 AND status IN ('ready','solving','awaiting_hint')",[this.characterId,sessionId])).rows[0];if(!a)return;
    const start=(await c.query("SELECT * FROM events WHERE character_id=$1 AND kind='activity.started' AND payload->>'activityId'=$2 AND data_status='active'",[this.characterId,a.id])).rows[0];if(!start)return;
    const participants=(await c.query("SELECT DISTINCT identity_id FROM events WHERE character_id=$1 AND session_id=$2 AND kind='chat.final' AND attention_status='observed' AND data_status='active'",[this.characterId,sessionId])).rows.map(x=>x.identity_id);
    const m=await this.memory(c,sessionId,a.id,`unfinished_activity:${a.id}`,'unfinished_activity',`문제 ${a.problem_id}를 마치지 못하고 남겨 두었다.`,{problemId:a.problem_id,activityId:a.id,result:'unfinished'},[{event:start,role:'started'}],participants);
    if(m.status!=='active')return;
    await c.query("INSERT INTO agendas(id,character_id,source_memory_id,source_memory_version,activity_run_id,created_session_id,status,not_before,expires_at) VALUES($1,$2,$3,$4,$5,$6,'pending',$7,$8) ON CONFLICT DO NOTHING",[randomUUID(),this.characterId,m.id,m.content_version,a.id,sessionId,new Date(this.now(s)),new Date(this.now(s)+7*86400000)]);
  }
  async stopSession(sessionId:string,requestId:string){return this.locked(async(c,s)=>{
    const ses=await this.session(c,sessionId,false);const e=await this.event(c,sessionId,'session.stopped',requestId,{reason:'operator_stop'},null,null,'studio:session.stop');if(e.duplicate)return {status:'duplicate',eventId:e.id};if(ses.status!=='active')throw new RuntimeError('session_closed');
    await c.query("UPDATE sessions SET status='ending' WHERE id=$1",[sessionId]);s.generationEpoch++;
    const responses=(await c.query(`UPDATE response_runs SET status='cancelled',cancel_reason='session_ended',finished_at=$3 WHERE character_id=$1 AND session_id=$2 AND status IN ${activeResponses} RETURNING id`,[this.characterId,sessionId,new Date(this.now(s))])).rows;
    for(const r of responses){const partial=(await c.query('SELECT 1 FROM speech_segments WHERE response_id=$1 AND text_shown_at IS NOT NULL',[r.id])).rowCount;await this.resolveAttempt(c,r.id,partial?'unknown':'not_delivered');}
    await c.query("UPDATE speech_segments ss SET delivery_status=CASE WHEN delivery_status='finished' THEN delivery_status ELSE 'cancelled' END FROM response_runs r WHERE ss.response_id=r.id AND r.session_id=$1",[sessionId]);
    await c.query("UPDATE events SET attention_status='expired' WHERE character_id=$1 AND session_id=$2 AND attention_status IN ('pending','selected')",[this.characterId,sessionId]);
    await this.consolidate(c,s,sessionId);
    await c.query("INSERT INTO tasks(id,character_id,session_id,kind,dedupe_key,status,payload,available_at,attempts,max_attempts) VALUES($1,$2,$3,'consolidate_session',$4,'pending',$5,$6,0,3) ON CONFLICT DO NOTHING",[randomUUID(),this.characterId,sessionId,`${sessionId}:consolidation-v1`,{sessionId},new Date(this.now(s))]);
    await c.query("UPDATE sessions SET status='ended',ended_at=$2 WHERE id=$1",[sessionId,new Date(this.now(s))]);
    s.body.attention.eventId=null;s.body.turn.listening=false;await this.bump(c,s,e,decay(s.body,this.now(s)));return {status:'committed',eventId:e.id};
  });}
  async claimTask(){return this.db.transaction(async c=>{
    await c.query("UPDATE tasks SET status=CASE WHEN attempts>=max_attempts THEN 'failed' ELSE 'pending' END,lease_token=NULL,lease_until=NULL,available_at=now()+CASE WHEN attempts=1 THEN interval '5 seconds' ELSE interval '30 seconds' END,last_error='lease_expired' WHERE character_id=$1 AND status='running' AND lease_until<=now()",[this.characterId]);
    const ready=(await c.query("SELECT * FROM tasks WHERE character_id=$1 AND status='result_ready' ORDER BY available_at,id LIMIT 1",[this.characterId])).rows[0];if(ready)return ready;
    const task=(await c.query("SELECT * FROM tasks WHERE character_id=$1 AND status='pending' AND available_at<=now() AND attempts<max_attempts ORDER BY available_at,id FOR UPDATE SKIP LOCKED LIMIT 1",[this.characterId])).rows[0];if(!task)return null;
    const token=randomUUID();await c.query("UPDATE tasks SET status='running',attempts=attempts+1,lease_token=$2,lease_until=now()+interval '30 seconds' WHERE id=$1",[task.id,token]);return {...task,status:'running',attempts:task.attempts+1,leaseToken:token};
  });}
  async renewTask(task:Row){return !!(await this.db.pool.query("UPDATE tasks SET lease_until=now()+interval '30 seconds' WHERE id=$1 AND character_id=$3 AND status='running' AND lease_token=$2 AND lease_until>now()",[task.id,task.leaseToken,this.characterId])).rowCount;}
  async failTask(task:Row,code:string){return !!(await this.db.pool.query("UPDATE tasks SET status=CASE WHEN attempts>=max_attempts THEN 'failed' ELSE 'pending' END,result=NULL,lease_token=NULL,lease_until=NULL,available_at=now()+CASE WHEN attempts=1 THEN interval '5 seconds' ELSE interval '30 seconds' END,last_error=$3 WHERE id=$1 AND character_id=$4 AND ((status='running' AND lease_token=$2 AND lease_until>now()) OR (status='result_ready' AND attempts=$5))",[task.id,task.leaseToken??null,code,this.characterId,task.attempts])).rowCount;}
  async prepareTask(task:Row){return this.db.transaction(async c=>{
    const events=(await c.query("SELECT id,revision FROM events WHERE character_id=$1 AND session_id=$2 AND data_status='active' AND kind<>'task.applied' ORDER BY id",[this.characterId,task.session_id])).rows;
    const activities=(await c.query('SELECT id,version,status FROM activity_runs WHERE character_id=$1 AND last_session_id=$2 ORDER BY id',[this.characterId,task.session_id])).rows;
    return !!(await c.query("UPDATE tasks SET status='result_ready',result=$3,lease_token=NULL,lease_until=NULL WHERE id=$1 AND character_id=$4 AND status='running' AND lease_token=$2 AND lease_until>now()",[task.id,task.leaseToken,{sourceSessionId:task.session_id,events,activities},this.characterId])).rowCount;
  });}
  async applyTask(task:Row){return this.locked(async(c,s)=>{
    const t=(await c.query("SELECT * FROM tasks WHERE id=$1 AND character_id=$2 AND status='result_ready' FOR UPDATE",[task.id,this.characterId])).rows[0];if(!t)return false;
    const events=(await c.query("SELECT id,revision FROM events WHERE character_id=$1 AND session_id=$2 AND data_status='active' AND kind<>'task.applied' ORDER BY id",[this.characterId,t.session_id])).rows;
    const activities=(await c.query('SELECT id,version,status FROM activity_runs WHERE character_id=$1 AND last_session_id=$2 ORDER BY id',[this.characterId,t.session_id])).rows;
    if(!t.result||JSON.stringify(t.result.events?.map((e:Row)=>[e.id,e.revision]))!==JSON.stringify(events.map(e=>[e.id,e.revision]))||JSON.stringify(t.result.activities?.map((a:Row)=>[a.id,a.version,a.status]))!==JSON.stringify(activities.map(a=>[a.id,a.version,a.status]))){
      await c.query("UPDATE tasks SET status=CASE WHEN attempts>=max_attempts THEN 'failed' ELSE 'pending' END,result=NULL,available_at=now()+CASE WHEN attempts=1 THEN interval '5 seconds' ELSE interval '30 seconds' END,last_error='stale_result' WHERE id=$1",[t.id]);return false;
    }
    const event=await this.event(c,t.session_id,'task.applied',`task_apply:${t.id}`,{taskId:t.id});await this.consolidate(c,s,t.session_id);await this.bump(c,s,event,decay(s.body,this.now(s)));await c.query("UPDATE tasks SET status='completed',completed_at=now() WHERE id=$1",[t.id]);return true;
  });}
  async finishTask(task:Row){if(task.status!=='result_ready'&&!await this.prepareTask(task))return false;return this.applyTask(task);}
  async agenda(sessionId:string,busy:boolean){return this.locked(async(c,s)=>{
    const ses=await this.session(c,sessionId);const now=this.now(s);
    await c.query("UPDATE agendas SET status='expired',closed_reason='timeout' WHERE character_id=$1 AND (expires_at<=$2 OR (status='offered' AND offered_at<=$3)) AND status IN ('pending','reserved','offered')",[this.characterId,new Date(now),new Date(now-60000)]);
    const a=(await c.query("SELECT ag.* FROM agendas ag JOIN memories m ON m.id=ag.source_memory_id JOIN activity_runs ar ON ar.id=ag.activity_run_id WHERE ag.character_id=$1 AND ag.status='pending' AND m.status='active' AND m.content_version=ag.source_memory_version AND ar.status IN ('ready','solving','awaiting_hint') AND ag.not_before<=$2 ORDER BY ag.created_at,ag.id LIMIT 1",[this.characterId,new Date(now)])).rows[0];if(!a)return null;
    const attempted=!!(await c.query('SELECT 1 FROM agenda_attempts WHERE character_id=$1 AND session_id=$2',[this.characterId,sessionId])).rowCount;
    const participant=(await c.query("SELECT mp.identity_id FROM memory_participants mp JOIN events e ON e.identity_id=mp.identity_id WHERE mp.memory_id=$1 AND e.character_id=$2 AND e.session_id=$3 AND e.kind='chat.final' AND e.attention_status='observed' AND e.data_status='active' LIMIT 1",[a.source_memory_id,this.characterId,sessionId])).rows[0];
    if(!agendaEligible({now,sessionStart:ses.started_at.getTime(),lastUser:ses.last_user_input_at?.getTime()??ses.started_at.getTime(),lastOutput:ses.last_output_end_at?.getTime()??ses.started_at.getTime(),busy,participantPresent:!!participant,expiresAt:a.expires_at.getTime(),attempted,createdSessionId:a.created_session_id,sessionId}))return null;
    const event=await this.event(c,sessionId,'agenda.reserved',`agenda_reserved:${sessionId}`,{agendaId:a.id});const plan=dialoguePlan(s.body,'resume_puzzle',participant.identity_id,[a.source_memory_id]);plan.activityId=a.activity_run_id;
    const response=await this.response(c,s,sessionId,event,plan);if(!response)return null;
    await c.query("INSERT INTO agenda_attempts(id,character_id,agenda_id,session_id,response_id,reserved_at,delivery_status) VALUES($1,$2,$3,$4,$5,$6,'reserved')",[randomUUID(),this.characterId,a.id,sessionId,response.id,new Date(now)]);
    await c.query("UPDATE agendas SET status='reserved',last_attempt_session_id=$2 WHERE id=$1",[a.id,sessionId]);await this.bump(c,s,event,decay(s.body,now));return response;
  });}
  async answerAgenda(sessionId:string,requestId:string,accept:boolean){return this.locked(async(c,s)=>{
    await this.session(c,sessionId);const prior=(await c.query("SELECT * FROM events WHERE character_id=$1 AND source_namespace='studio:agenda.answer' AND source_key=$2",[this.characterId,requestId])).rows[0];if(prior){if(prior.payload.accept!==accept)throw new RuntimeError('idempotency_conflict');return {status:'duplicate',eventId:prior.id,activityId:prior.payload.activityId};}
    const a=(await c.query("SELECT * FROM agendas WHERE character_id=$1 AND status='offered' AND last_attempt_session_id=$2 AND offered_at>$3 FOR UPDATE",[this.characterId,sessionId,new Date(this.now(s)-60000)])).rows[0];if(!a)throw new RuntimeError('agenda_not_offered');
    const event=await this.event(c,sessionId,'agenda.answered',requestId,{accept,activityId:a.activity_run_id},null,null,'studio:agenda.answer');
    await c.query('UPDATE agendas SET status=$2,closed_reason=$2 WHERE id=$1',[a.id,accept?'accepted':'declined']);if(accept)await c.query("UPDATE activity_runs SET status='solving',last_session_id=$2,version=version+1 WHERE id=$1 AND status IN ('ready','solving','awaiting_hint')",[a.activity_run_id,sessionId]);
    await this.memory(c,sessionId,a.activity_run_id,`delivered_proposal:${a.activity_run_id}:${event.id}`,'delivered_proposal',`퍼즐 이어가기 제안을 ${accept?'수락':'거절'}했다.`,{agendaId:a.id,result:accept?'accepted':'declined'},[{event,role:'answer'}],[]);
    await this.bump(c,s,event,decay(s.body,this.now(s)));return {status:'committed',eventId:event.id,activityId:a.activity_run_id};
  });}
  async recover(){return this.locked(async(c,s)=>{
    const sessions=(await c.query("UPDATE sessions SET status='interrupted',ended_at=$2 WHERE character_id=$1 AND status IN ('active','ending') RETURNING *",[this.characterId,new Date(this.now(s))])).rows;
    for(const ses of sessions){const e=await this.event(c,ses.id,'runtime.recovered',`recover:${ses.id}`,{sessionId:ses.id});s.generationEpoch++;
      const responses=(await c.query(`UPDATE response_runs SET status='interrupted',cancel_reason='runtime_restart',finished_at=$3 WHERE character_id=$1 AND session_id=$2 AND status IN ${activeResponses} RETURNING id`,[this.characterId,ses.id,new Date(this.now(s))])).rows;
      for(const r of responses){const dispatched=(await c.query("SELECT 1 FROM speech_segments WHERE response_id=$1 AND delivery_status<>'not_sent'",[r.id])).rowCount;await this.resolveAttempt(c,r.id,dispatched?'unknown':'not_delivered');await c.query("UPDATE speech_segments SET delivery_status=CASE WHEN delivery_status='not_sent' THEN 'cancelled' WHEN delivery_status='finished' THEN 'finished' ELSE 'unknown' END WHERE response_id=$1",[r.id]);}
      await c.query("UPDATE events SET attention_status='expired' WHERE character_id=$1 AND session_id=$2 AND attention_status IN ('pending','selected')",[this.characterId,ses.id]);
      await this.consolidate(c,s,ses.id);await c.query("INSERT INTO tasks(id,character_id,session_id,kind,dedupe_key,status,payload,available_at,attempts,max_attempts) VALUES($1,$2,$3,'consolidate_session',$4,'pending',$5,$6,0,3) ON CONFLICT DO NOTHING",[randomUUID(),this.characterId,ses.id,`${ses.id}:consolidation-v1`,{sessionId:ses.id},new Date(this.now(s))]);
      const body=decay(s.body,this.now(s));body.workingMemoryEventIds=[];body.attention.eventId=null;body.turn.listening=false;await this.bump(c,s,e,body);
    }
    return sessions.length;
  });}
  async timeline(sessionId:string,limit=50){return (await this.db.pool.query('SELECT id,kind,identity_id,attention_status,data_status,revision,received_at,payload FROM events WHERE character_id=$1 AND session_id=$2 ORDER BY received_at DESC,id DESC LIMIT $3',[this.characterId,sessionId,Math.min(limit,100)])).rows;}
  async command(requestId:string){return (await this.db.pool.query("SELECT id AS event_id,session_id,kind FROM events WHERE character_id=$1 AND source_key=$2 AND source_namespace LIKE 'studio:%' ORDER BY received_at DESC LIMIT 1",[this.characterId,requestId])).rows[0]??null;}
  private async invalidateOutputs(c:Client,s:VersionedState,memoryIds:string[],eventIds:string[],initialResponses:string[]=[]){
    // Resolve the closure before clearing any plan, appraisal refs or historical reason.
    const responses=new Set<string>(initialResponses),appraisals=new Set<string>(),reasons=new Set<string>();
    for(const record of s.body.turn.recentSilences)if(eventIds.includes(record.eventId)||record.sourceRefs.some(ref=>(ref.kind==='event'?eventIds:memoryIds).includes(ref.id)))reasons.add(record.eventId);
    let previous=-1;
    while(previous!==responses.size+appraisals.size+reasons.size){
      previous=responses.size+appraisals.size+reasons.size;
      const outputs=(await c.query("WITH RECURSIVE affected(id) AS (SELECT rs.response_id FROM response_sources rs WHERE rs.character_id=$1 AND (rs.memory_id=ANY($2::uuid[]) OR rs.event_id=ANY($3::uuid[]) OR rs.source_response_id=ANY($4::uuid[])) UNION SELECT r.id FROM response_runs r LEFT JOIN transitions t ON t.source_event_id=r.trigger_event_id WHERE r.character_id=$1 AND (r.plan->'reengagement'->>'silenceEventId'=ANY($5::text[]) OR t.effects->'reengagement'->>'silenceEventId'=ANY($5::text[])) UNION SELECT rs.response_id FROM response_sources rs JOIN affected a ON rs.source_response_id=a.id WHERE rs.character_id=$1) SELECT id FROM affected",[this.characterId,memoryIds,eventIds,[...responses],[...reasons]])).rows;
      for(const row of outputs)responses.add(row.id);
      const judgements=(await c.query("SELECT id FROM appraisals WHERE character_id=$1 AND (event_id=ANY($3::uuid[]) OR EXISTS(SELECT 1 FROM jsonb_array_elements(context_refs) ref WHERE (ref->>'kind'='response' AND ref->>'id'=ANY($2::text[])) OR (COALESCE(ref->>'kind','event')='event' AND ref->>'id'=ANY($3::text[]))))",[this.characterId,[...responses],eventIds])).rows;
      for(const row of judgements)appraisals.add(row.id);
      const silences=(await c.query("SELECT effects->'silence'->>'eventId' AS id FROM transitions WHERE character_id=$1 AND effects->'silence' IS NOT NULL AND (appraisal_id=ANY($4::uuid[]) OR effects->'silence'->>'eventId'=ANY($2::text[]) OR EXISTS(SELECT 1 FROM jsonb_array_elements(effects->'silence'->'sourceRefs') ref WHERE (ref->>'kind'='event' AND ref->>'id'=ANY($2::text[])) OR (ref->>'kind'='memory' AND ref->>'id'=ANY($3::text[]))))",[this.characterId,eventIds,memoryIds,[...appraisals]])).rows;
      for(const row of silences)reasons.add(row.id);
    }
    await this.redactSilences(c,s,memoryIds,eventIds,[...reasons]);
    const episodes=(await c.query("UPDATE action_episodes SET status='deleted',annotation=NULL,episode=NULL,closed_at=$3 WHERE character_id=$1 AND response_id=ANY($2::uuid[]) AND status IN ('candidate','active') RETURNING id",[this.characterId,[...responses],new Date(this.now(s))])).rows.map(r=>r.id);
    await this.removeEventAffect(c,s,[...eventIds,...responses,...episodes]);
    await c.query("UPDATE appraisals SET result=NULL,provider_result=NULL,context_refs='[]'::jsonb,status='stale' WHERE character_id=$1 AND id=ANY($2::uuid[])",[this.characterId,[...appraisals]]);
    await c.query("UPDATE transitions SET effects=CASE WHEN effects ? 'repairUsed' THEN jsonb_build_object('repairUsed',effects->'repairUsed') ELSE NULL END,replay_status='source_redacted' WHERE character_id=$1 AND appraisal_id=ANY($2::uuid[])",[this.characterId,[...appraisals]]);
    const affected=[...responses].map(id=>({id}));
    for(const r of affected){await c.query("UPDATE response_runs SET status=CASE WHEN status IN ('planned','generating','synthesizing','delivering') THEN 'cancelled' ELSE status END,plan=NULL,conversation_refs=NULL,knowledge_context=NULL,personal_context=NULL,cancel_reason='source_invalidated' WHERE id=$1",[r.id]);await c.query("UPDATE speech_segments SET text=NULL,delivery_status=CASE WHEN delivery_status IN ('finished','unknown') THEN delivery_status ELSE 'cancelled' END WHERE response_id=$1",[r.id]);await this.resolveAttempt(c,r.id,'unknown');}
    await c.query("UPDATE response_runs SET status='cancelled',cancel_reason='generation_invalidated',finished_at=$2 WHERE character_id=$1 AND status IN ('planned','generating','synthesizing','delivering')",[this.characterId,new Date(this.now(s))]);
    s.generationEpoch++;
    await c.query("UPDATE agendas SET status='expired',closed_reason='source_invalidated' WHERE character_id=$1 AND source_memory_id=ANY($2::uuid[]) AND status IN ('pending','reserved','offered')",[this.characterId,memoryIds]);
    return affected.map(x=>x.id);
  }
  private async redactSilences(c:Client,s:VersionedState,memoryIds:string[],eventIds:string[],reasonIds:string[]=[]){
    const affected=(record:SilenceRecord)=>reasonIds.includes(record.eventId)||eventIds.includes(record.eventId)||record.sourceRefs.some(ref=>(ref.kind==='event'?eventIds:memoryIds).includes(ref.id));
    const historical=(await c.query("SELECT effects->'silence' AS record FROM transitions WHERE character_id=$1 AND effects->'silence' IS NOT NULL AND EXISTS(SELECT 1 FROM jsonb_array_elements(effects->'silence'->'sourceRefs') ref WHERE (ref->>'kind'='event' AND ref->>'id'=ANY($2::text[])) OR (ref->>'kind'='memory' AND ref->>'id'=ANY($3::text[])))",[this.characterId,eventIds,memoryIds])).rows;
    const ids=[...new Set([...eventIds,...reasonIds,...historical.map(row=>row.record.eventId),...s.body.turn.recentSilences.filter(affected).map(record=>record.eventId)])];
    s.body.turn.recentSilences=s.body.turn.recentSilences.filter(record=>!affected(record));
    await c.query("UPDATE transitions SET effects=CASE WHEN effects ? 'repairUsed' THEN jsonb_build_object('repairUsed',effects->'repairUsed') ELSE NULL END,replay_status='source_redacted' WHERE character_id=$1 AND (effects->'silence'->>'eventId'=ANY($2::text[]) OR effects->'reengagement'->>'silenceEventId'=ANY($2::text[]))",[this.characterId,ids]);
  }
  async editMemory(id:string,expectedVersion:string,requestId:string,content?:string){return this.locked(async(c,s)=>{
    const m=(await c.query('SELECT * FROM memories WHERE id=$1 AND character_id=$2 FOR UPDATE',[id,this.characterId])).rows[0];if(!m)throw new RuntimeError('memory_not_found',404);
    const key=`${id}:${requestId}`,namespace=content===undefined?'studio:memory.delete':'studio:memory.correct';const prior=(await c.query('SELECT *,payload=$4::jsonb AS same_payload FROM events WHERE character_id=$1 AND source_namespace=$2 AND source_key=$3',[this.characterId,namespace,key,{memoryId:id,expectedVersion,...(content!==undefined?{contentDigest:await this.digest(content)}:{})}])).rows[0];if(prior){if(!prior.same_payload)throw new RuntimeError('idempotency_conflict');return {status:'duplicate',eventId:prior.id};}
    if(m.content_version!==expectedVersion||m.status!=='active')throw new RuntimeError('revision_conflict');
    if(content!==undefined&&(!content.trim()||[...content].length>500))throw new RuntimeError('invalid_message',400);
    await c.query('UPDATE memories SET status=$2,content=$3,facts=$4,content_version=content_version+1,updated_at=$5 WHERE id=$1',[id,content===undefined?'deleted':'active',content??null,content===undefined?null:m.facts,new Date(this.now(s))]);
    const cancelled=await this.invalidateOutputs(c,s,[id],[]);const event=await this.event(c,m.session_id,content===undefined?'memory.deleted':'memory.corrected',key,{memoryId:id,expectedVersion,...(content!==undefined?{contentDigest:await this.digest(content)}:{})},null,null,namespace);
    await this.bump(c,s,event,decay(s.body,this.now(s)));return {status:'committed',eventId:event.id,cancelled};
  });}
  private async digest(text:string){const {createHash}=await import('node:crypto');return createHash('sha256').update(text).digest('hex');}
  async deleteEvent(id:string,expectedRevision:string,requestId:string){return this.locked(async(c,s)=>{
    const e=(await c.query('SELECT * FROM events WHERE character_id=$1 AND id=$2 FOR UPDATE',[this.characterId,id])).rows[0];if(!e)throw new RuntimeError('event_not_found',404);
    const prior=(await c.query("SELECT * FROM events WHERE character_id=$1 AND source_namespace='studio:event.delete' AND source_key=$2",[this.characterId,requestId])).rows[0];if(prior){if(prior.payload.eventId!==id||prior.payload.expectedRevision!==expectedRevision)throw new RuntimeError('idempotency_conflict');return {status:'duplicate',eventId:prior.id};}
    if(e.revision!==expectedRevision||e.data_status!=='active')throw new RuntimeError('revision_conflict');
    const related=(await c.query('WITH RECURSIVE descendants AS (SELECT id FROM events WHERE id=$1 UNION ALL SELECT child.id FROM events child JOIN descendants p ON child.parent_event_id=p.id) SELECT id FROM descendants',[id])).rows.map(x=>x.id);
    await c.query("UPDATE events SET data_status='deleted',payload=NULL,revision=revision+1 WHERE character_id=$1 AND id=ANY($2::uuid[])",[this.characterId,related]);
    const memories=(await c.query("UPDATE memories m SET status='deleted',content=NULL,facts=NULL,content_version=content_version+1,updated_at=$3 WHERE m.character_id=$1 AND EXISTS(SELECT 1 FROM memory_sources ms WHERE ms.memory_id=m.id AND ms.event_id=ANY($2::uuid[])) RETURNING m.id",[this.characterId,related,new Date(this.now(s))])).rows.map(x=>x.id);
    // Source groups require all their role events valid; a different complete group
    // keeps the same business evidence alive without granting a second increase.
    const evidence=(await c.query('SELECT * FROM relationship_evidence WHERE character_id=$1',[this.characterId])).rows;
    for(const ev of evidence){const groups=(await c.query("SELECT rs.support_group, array_agg(rs.role) AS roles, bool_and(e.data_status='active' AND e.revision=rs.event_revision) AS valid,min(e.applied_at) AS first_at,max(e.applied_at) AS completed_at FROM relationship_evidence_sources rs JOIN events e ON e.id=rs.event_id WHERE rs.evidence_id=$1 GROUP BY rs.support_group ORDER BY completed_at,support_group",[ev.id])).rows;
      const valid=groups.filter(g=>g.valid&&(ev.kind!=='verified_hint'||g.roles.includes('hint_used')&&g.roles.includes('correct_result')));
      await c.query('UPDATE relationship_evidence SET status=$2,effective_at=COALESCE($3,effective_at),local_date=COALESCE($4,local_date) WHERE id=$1',[ev.id,valid.length?'active':'invalidated',valid[0]?.completed_at??null,valid[0]?koreanDate(valid[0].completed_at.getTime()):null]);}
    // Recompute chronological stimuli as well as relationship projection after deletion.
    const inputs=await this.evidenceInputs(c),replayed:EvidenceInput[]=[];
    for(const ev of inputs){if(ev.relationshipEligible!==false&&(ev.kind==='praise'||ev.kind==='direct_insult')){const app:Appraisal={target:'character',act:ev.kind==='praise'?'praise':'criticism',strength:ev.strength??0,hostility:2,goal_relation:'unrelated',uncertain:false,evidence_refs:[]};const effect=socialEffect(app,replayed,ev.identityId,ev.at);ev.appliedStimulus=effect.stimulus;await c.query("UPDATE relationship_evidence SET applied=COALESCE(applied,'{}'::jsonb)||$2::jsonb WHERE id=$1",[ev.id,{stimulus:effect.stimulus,habituation:effect.habituation}]);}replayed.push(ev);}
    const activities=(await c.query("UPDATE activity_steps SET data_status='invalidated',normalized_answer=NULL,hint_id=NULL,verdict=NULL WHERE character_id=$1 AND event_id=ANY($2::uuid[]) RETURNING activity_run_id",[this.characterId,related])).rows.map(x=>x.activity_run_id);
    const started=e.kind==='activity.started'?[e.payload?.activityId]:[];
    for(const activityId of new Set([...activities,...started])) {
      const run=(await c.query('SELECT * FROM activity_runs WHERE id=$1 AND character_id=$2',[activityId,this.characterId])).rows[0];if(!run)continue;
      const validStart=(await c.query("SELECT 1 FROM events WHERE character_id=$1 AND kind='activity.started' AND payload->>'activityId'=$2 AND data_status='active'",[this.characterId,activityId])).rowCount;
      const validSteps=(await c.query("SELECT st.kind,st.verdict,e.parent_event_id,st.event_id FROM activity_steps st JOIN events e ON e.id=st.event_id WHERE st.activity_run_id=$1 AND st.data_status='active' AND e.data_status='active' ORDER BY st.step_no",[activityId])).rows;
      const submissions=validSteps.filter(x=>x.kind==='answer_submitted'),judgements=validSteps.filter(x=>x.kind==='answer_judged');
      const complete=validStart&&submissions.every(sub=>judgements.some(j=>j.parent_event_id===sub.event_id))&&judgements.every(j=>submissions.some(sub=>sub.event_id===j.parent_event_id));
      const solved=complete&&judgements.some(j=>j.verdict==='correct');const nextStatus=!complete?'ended':solved?'solved':['ended','solved'].includes(run.status)?'ended':'solving';
      await c.query('UPDATE activity_runs SET status=$2,ended_at=$3,version=version+1 WHERE id=$1',[activityId,nextStatus,['ended','solved'].includes(nextStatus)?run.ended_at??new Date(this.now(s)):null]);
      if(['ended','solved'].includes(nextStatus))await c.query("UPDATE agendas SET status='expired',closed_reason='activity_source_deleted' WHERE activity_run_id=$1 AND status IN ('pending','reserved','offered')",[activityId]);
    }
    // Preserve appraisal refs and historical reasons until the dependency closure is resolved.
    const cancelled=await this.invalidateOutputs(c,s,memories,related);
    await c.query('UPDATE appraisals SET result=NULL,provider_result=NULL,context_refs=\'[]\'::jsonb,status=\'stale\' WHERE character_id=$1 AND (event_id=ANY($2::uuid[]) OR EXISTS(SELECT 1 FROM jsonb_array_elements(context_refs) ref WHERE ref->>\'id\'=ANY($3::text[])))',[this.characterId,related,related]);
    await c.query("UPDATE transitions SET effects=CASE WHEN effects ? 'repairUsed' THEN jsonb_build_object('repairUsed',effects->'repairUsed') ELSE NULL END,replay_status='source_redacted' WHERE character_id=$1 AND source_event_id=ANY($2::uuid[])",[this.characterId,related]);
    await c.query('UPDATE tasks SET result=NULL,payload=jsonb_build_object(\'sessionId\',session_id) WHERE character_id=$1',[this.characterId]);
    const body=decay(s.body,this.now(s));body.workingMemoryEventIds=body.workingMemoryEventIds.filter(x=>!related.includes(x));if(body.attention.eventId&&related.includes(body.attention.eventId))body.attention.eventId=null;for(const a of Object.values(body.affect))a.causes=a.causes.filter(x=>!related.includes(x.eventId));
    await this.project(c,s);const event=await this.event(c,e.session_id,'event.deleted',requestId,{eventId:id,expectedRevision},null,null,'studio:event.delete');await this.bump(c,s,event,body);return {status:'committed',eventId:event.id,cancelled};
  });}
}
