import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import type pg from 'pg';
import { Database } from './connection.ts';
import { characterState } from './schema.ts';
import { CHARACTER_ID } from './seed.ts';
import { stateSchema,RuntimeError,type State,type Appraisal,type Plan,type EvidenceInput } from '../../contracts/src/domain.ts';
import { appraisalMetadataSchema,type AppraisalMetadata } from '../../contracts/src/appraisal.ts';
import { apply,decay,socialEffect,chooseSocial,dialoguePlan,projectRelationships,koreanDate,agendaEligible } from '../../character-core/src/index.ts';
import { normalizeAnswer,judge } from '../../adapters/src/puzzle.ts';
type Client=pg.PoolClient;
type Row=Record<string,any>;
export type VersionedState={body:State;version:bigint;generationEpoch:bigint;configVersion:bigint;snapshotAt:Date};
const activeResponses="('planned','generating','synthesizing','delivering')";
export class Store {
  constructor(public db:Database,public characterId=CHARACTER_ID,public clock=()=>Date.now()){}
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
  async acceptChat(sessionId:string,requestId:string,payload:{identityId:string;text:string;replyToEventId?:string}) {
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
    await this.bump(c,s,phase,body);return {event:e,generationEpoch:s.generationEpoch,revision:BigInt(e.revision),configVersion:s.configVersion};
  });}
  private async evidence(c:Client,s:VersionedState,sessionId:string,identityId:string,key:string,kind:EvidenceInput['kind'],sources:{event:Row;role:string}[],group:string,features:object={},applied:object={},problemId:string|null=null){
    const now=this.now(s),id=randomUUID();
    const r=await c.query("INSERT INTO relationship_evidence(id,character_id,identity_id,evidence_key,kind,status,problem_id,effective_at,local_date,order_version,config_version,features,applied) VALUES($1,$2,$3,$4,$5,'active',$6,$7,$8,$9,$10,$11,$12) ON CONFLICT(character_id,identity_id,evidence_key) DO NOTHING RETURNING id",[id,this.characterId,identityId,key,kind,problemId,new Date(now),koreanDate(now),(s.version+1n).toString(),s.configVersion.toString(),features,applied]);
    const evidenceId=r.rowCount?id:(await c.query('SELECT id FROM relationship_evidence WHERE character_id=$1 AND identity_id=$2 AND evidence_key=$3',[this.characterId,identityId,key])).rows[0].id;
    for(const source of sources)await c.query('INSERT INTO relationship_evidence_sources(evidence_id,event_id,character_id,event_revision,role,support_group) VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT DO NOTHING',[evidenceId,source.event.id,this.characterId,source.event.revision,source.role,group]);
    return {id:evidenceId,inserted:!!r.rowCount};
  }
  private async evidenceInputs(c:Client):Promise<EvidenceInput[]>{return (await c.query("SELECT * FROM relationship_evidence WHERE character_id=$1 AND status='active' ORDER BY effective_at,order_version,id",[this.characterId])).rows.map(r=>({id:r.id,identityId:r.identity_id,kind:r.kind,at:r.effective_at.getTime(),order:BigInt(r.order_version),problemId:r.problem_id??undefined,strength:r.features?.strength,appliedStimulus:r.applied?.stimulus??0}));}
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
  async memories(identityId?:string,activityId?:string){return (await this.db.pool.query(`SELECT m.*, COALESCE((SELECT jsonb_agg(identity_id) FROM memory_participants mp WHERE mp.memory_id=m.id),'[]'::jsonb) AS participants, COALESCE((SELECT jsonb_agg(ms.event_id) FROM memory_sources ms WHERE ms.memory_id=m.id),'[]'::jsonb) AS source_event_ids FROM memories m WHERE m.character_id=$1 AND m.status='active' AND NOT EXISTS(SELECT 1 FROM memory_sources ms JOIN events e ON e.id=ms.event_id WHERE ms.memory_id=m.id AND (e.data_status<>'active' OR e.revision<>ms.event_revision)) ORDER BY CASE WHEN m.activity_run_id=$3 AND m.kind='unfinished_activity' THEN 0 WHEN EXISTS(SELECT 1 FROM memory_participants p WHERE p.memory_id=m.id AND p.identity_id=$2) THEN 1 ELSE 2 END,m.occurred_at DESC,m.id LIMIT 100`,[this.characterId,identityId??null,activityId??null])).rows;}
  private async response(c:Client,s:VersionedState,sessionId:string,trigger:Row,plan:Plan,extraSources:Row[]=[]){
    if((await c.query(`SELECT 1 FROM response_runs WHERE character_id=$1 AND status IN ${activeResponses}`,[this.characterId])).rowCount)return null;
    const id=randomUUID();await c.query("INSERT INTO response_runs(id,character_id,session_id,trigger_event_id,generation_epoch,config_version,status,plan,deadline_at) VALUES($1,$2,$3,$4,$5,$6,'planned',$7,$8)",[id,this.characterId,sessionId,trigger.id,s.generationEpoch.toString(),s.configVersion.toString(),plan,new Date(this.now(s)+30000)]);
    for(const e of [trigger,...extraSources])await c.query('INSERT INTO response_sources(id,character_id,response_id,event_id,source_version) VALUES($1,$2,$3,$4,$5) ON CONFLICT DO NOTHING',[randomUUID(),this.characterId,id,e.id,e.revision]);
    for(const memoryId of plan.memoryIds){const m=(await c.query("SELECT * FROM memories WHERE character_id=$1 AND id=$2 AND status='active'",[this.characterId,memoryId])).rows[0];if(!m)throw new RuntimeError('stale_source');await c.query('INSERT INTO response_sources(id,character_id,response_id,memory_id,source_version) VALUES($1,$2,$3,$4,$5)',[randomUUID(),this.characterId,id,m.id,m.content_version]);}
    return {id,sessionId,generationEpoch:s.generationEpoch,plan};
  }
  async commitAppraisal(selected:NonNullable<Awaited<ReturnType<Store['select']>>>,appraisal:Appraisal,metadata:AppraisalMetadata,memoryIds:string[]=[]){metadata=appraisalMetadataSchema.parse(metadata);return this.locked(async(c,s)=>{
    const e=(await c.query('SELECT * FROM events WHERE id=$1 AND character_id=$2 FOR UPDATE',[selected.event.id,this.characterId])).rows[0];
    const session=(await c.query('SELECT status FROM sessions WHERE id=$1',[e.session_id])).rows[0];
    if(e.data_status!=='active'||e.attention_status!=='selected'||BigInt(e.revision)!==selected.revision||s.generationEpoch!==selected.generationEpoch||session.status!=='active')return {status:'stale',response:null};
    const phase=await this.event(c,e.session_id,'appraisal.applied',`appraisal_applied:${e.id}:${e.revision}`,{eventId:e.id},e.identity_id,e.id);
    if(phase.duplicate)return {status:'duplicate',response:null};
    const now=this.now(s),effect=socialEffect(appraisal,await this.evidenceInputs(c),e.identity_id,now),appraisalId=randomUUID();
    await c.query("INSERT INTO appraisals(id,character_id,event_id,event_revision,request_id,generation_epoch,config_version,provider,model,prompt_version,status,result,context_refs,failure_code,latency_ms,usage,provider_result) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$13,'accepted',$10,$11,$12,$14,$15,$16)",[appraisalId,this.characterId,e.id,e.revision,randomUUID(),s.generationEpoch.toString(),s.configVersion.toString(),metadata.provider,metadata.model,appraisal,JSON.stringify([{id:e.id,revision:e.revision}]),metadata.failureCode??null,metadata.promptVersion??'appraisal-v1',metadata.latencyMs??null,metadata.usage??null,metadata.providerResult??null]);
    await c.query("UPDATE events SET attention_status='observed',applied_at=$2 WHERE id=$1",[e.id,new Date(now)]);
    e.attention_status='observed';
    await this.evidence(c,s,e.session_id,e.identity_id,`first_observed:${koreanDate(now)}`,'first_observed',[{event:e,role:'observed'}],e.id);
    if(effect.category)await this.evidence(c,s,e.session_id,e.identity_id,`${effect.category}:${e.id}`,effect.category,[{event:e,role:'appraisal'}],e.id,{strength:appraisal.strength},{stimulus:effect.stimulus,habituation:effect.habituation});
    let body=apply(s.body,{eventId:e.id,targetId:e.identity_id,now,stimuli:effect.category==='praise'?{joy:effect.stimulus}:effect.category==='direct_insult'?{frustration:effect.stimulus}:{},holdEligible:effect.n===0});body.attention.eventId=null;
    const plan=chooseSocial(body,appraisal,effect,e.identity_id,now);plan.memoryIds=memoryIds;
    if(!['ignore','listen'].includes(plan.action)){body.turn.acknowledgements[`${e.identity_id}:${effect.category??appraisal.act}`]=now;}
    await this.project(c,s);await this.bump(c,s,phase,body,{stimulus:effect.stimulus,category:effect.category,action:plan.action},appraisalId);
    const response=['ignore','listen'].includes(plan.action)?null:await this.response(c,s,e.session_id,phase,plan,[e]);return {status:'committed',response};
  });}
  async busy(){return !!(await this.db.pool.query(`SELECT 1 FROM response_runs WHERE character_id=$1 AND status IN ${activeResponses}`,[this.characterId])).rowCount;}
  async validResponse(c:Client,id:string,s:VersionedState){const r=(await c.query(`SELECT r.* FROM response_runs r JOIN sessions ses ON ses.id=r.session_id WHERE r.id=$1 AND r.character_id=$2 AND r.status IN ${activeResponses} AND ses.status='active' AND r.generation_epoch=$3 AND NOT EXISTS(SELECT 1 FROM response_sources rs LEFT JOIN events e ON e.id=rs.event_id LEFT JOIN memories m ON m.id=rs.memory_id WHERE rs.response_id=r.id AND ((rs.event_id IS NOT NULL AND (e.data_status<>'active' OR e.revision<>rs.source_version)) OR (rs.memory_id IS NOT NULL AND (m.status<>'active' OR m.content_version<>rs.source_version))))`,[id,this.characterId,s.generationEpoch.toString()])).rows[0];return r??null;}
  async responseContext(id:string){const r=(await this.db.pool.query('SELECT * FROM response_runs WHERE id=$1 AND character_id=$2',[id,this.characterId])).rows[0];if(!r)throw new RuntimeError('response_not_found',404);const sources=(await this.db.pool.query("SELECT e.id,e.payload FROM response_sources rs JOIN events e ON e.id=rs.event_id WHERE rs.response_id=$1 AND e.data_status='active'",[id])).rows;const memories=(await this.db.pool.query("SELECT m.id,m.facts,(SELECT jsonb_agg(identity_id) FROM memory_participants p WHERE p.memory_id=m.id) AS participants FROM response_sources rs JOIN memories m ON m.id=rs.memory_id WHERE rs.response_id=$1 AND m.status='active'",[id])).rows;return {response:r,context:{sources,memories}};}
  async generated(id:string,sentences:string[],owner:{clientId:string;outputEpoch:bigint}|null){return this.locked(async(c,s)=>{const r=await this.validResponse(c,id,s);if(!r)return null;if(!owner){await c.query("UPDATE response_runs SET status='failed',cancel_reason='stage_unavailable',finished_at=$2 WHERE id=$1",[id,new Date(this.clock())]);await this.resolveAttempt(c,id,'not_delivered');return null;}
    const session=await this.session(c,r.session_id);if(BigInt(session.output_epoch)!==owner.outputEpoch)return null;
    await c.query("UPDATE response_runs SET status='delivering',segment_count=$2 WHERE id=$1",[id,sentences.length]);const segments=[];
    for(let i=0;i<sentences.length;i++){const segmentId=randomUUID();await c.query("INSERT INTO speech_segments(id,character_id,response_id,segment_index,text,synthesis_status,delivery_status,output_epoch,playback_client_id) VALUES($1,$2,$3,$4,$5,'ready','sent',$6,$7)",[segmentId,this.characterId,id,i,sentences[i],owner.outputEpoch.toString(),owner.clientId]);segments.push({id:segmentId,text:sentences[i],index:i});}
    return {response:r,segments,outputEpoch:owner.outputEpoch};
  });}
  async failResponse(id:string,code:string){return this.locked(async(c,s)=>{await c.query(`UPDATE response_runs SET status='failed',cancel_reason=$3,finished_at=$4 WHERE id=$1 AND character_id=$2 AND status IN ${activeResponses}`,[id,this.characterId,code,new Date(this.clock())]);await this.resolveAttempt(c,id,'not_delivered');});}
  private async resolveAttempt(c:Client,responseId:string,status:'not_delivered'|'unknown') {const a=(await c.query("UPDATE agenda_attempts SET delivery_status=$2,resolved_at=$3 WHERE response_id=$1 AND delivery_status='reserved' RETURNING agenda_id",[responseId,status,new Date(this.clock())])).rows[0];if(a)await c.query("UPDATE agendas SET status=$2,closed_reason=$3 WHERE id=$1 AND status='reserved'",[a.agenda_id,status==='not_delivered'?'pending':'expired',status]);}
  async report(sessionId:string,requestId:string,type:'caption.shown'|'caption.finished',body:{responseId:string;segmentId:string;generationEpoch:string;outputEpoch:string},clientId:string){return this.locked(async(c,s)=>{
    await this.session(c,sessionId);const segment=(await c.query('SELECT ss.*,r.session_id,r.generation_epoch,r.status AS response_status,r.segment_count FROM speech_segments ss JOIN response_runs r ON r.id=ss.response_id WHERE ss.id=$1 AND ss.character_id=$2 FOR UPDATE OF ss',[body.segmentId,this.characterId])).rows[0];
    if(!segment||segment.response_id!==body.responseId||segment.session_id!==sessionId||segment.playback_client_id!==clientId||segment.output_epoch!==body.outputEpoch||segment.generation_epoch!==body.generationEpoch)throw new RuntimeError('forbidden',403);
    const namespace=`stage:${body.outputEpoch}:${clientId}`;
    const existing=(await c.query('SELECT *,payload=$4::jsonb AS same_payload FROM events WHERE character_id=$1 AND source_namespace=$2 AND source_key=$3',[this.characterId,namespace,requestId,body])).rows[0];
    if(existing){if(existing.kind!==type||!existing.same_payload)throw new RuntimeError('idempotency_conflict');return {status:'duplicate',eventId:existing.id};}
    if(['cancelled','interrupted','failed'].includes(segment.response_status)||s.generationEpoch.toString()!==body.generationEpoch)throw new RuntimeError('stale_epoch');
    if(type==='caption.finished'&&!segment.text_shown_at)throw new RuntimeError('report_out_of_order');
    const event=await this.event(c,sessionId,type,requestId,body,null,null,namespace);
    if(type==='caption.shown')await c.query('UPDATE speech_segments SET text_shown_at=COALESCE(text_shown_at,$2),updated_at=$2 WHERE id=$1',[segment.id,new Date(this.clock())]);
    else await c.query("UPDATE speech_segments SET delivery_status='finished',updated_at=$2 WHERE id=$1",[segment.id,new Date(this.clock())]);
    const all=(await c.query('SELECT * FROM speech_segments WHERE response_id=$1 ORDER BY segment_index',[body.responseId])).rows;
    if(all.length===segment.segment_count&&all.every(x=>x.text_shown_at)) {
      const attempt=(await c.query("UPDATE agenda_attempts SET delivery_status='delivered_text',resolved_at=COALESCE(resolved_at,$2) WHERE response_id=$1 AND delivery_status='reserved' RETURNING *",[body.responseId,new Date(this.clock())])).rows[0];
      if(attempt){await c.query("UPDATE agendas SET status='offered',offered_at=$2 WHERE id=$1 AND status='reserved'",[attempt.agenda_id,new Date(this.clock())]);const agenda=(await c.query('SELECT * FROM agendas WHERE id=$1',[attempt.agenda_id])).rows[0];await this.memory(c,sessionId,agenda.activity_run_id,`delivered_proposal:${agenda.activity_run_id}:${attempt.id}`,'delivered_proposal','남겨 둔 퍼즐을 이어 하자고 제안했다.',{agendaId:agenda.id,result:'offered'},[{event,role:'delivered'}],[]);}
    }
    if(all.length===segment.segment_count&&all.every(x=>x.delivery_status==='finished')){await c.query("UPDATE response_runs SET status='completed',finished_at=$2 WHERE id=$1 AND status='delivering'",[body.responseId,new Date(this.clock())]);await c.query('UPDATE sessions SET last_output_end_at=$2 WHERE id=$1',[sessionId,new Date(this.clock())]);}
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
  private async invalidateOutputs(c:Client,s:VersionedState,memoryIds:string[],eventIds:string[]){
    const affected=(await c.query("SELECT DISTINCT r.id FROM response_runs r JOIN response_sources rs ON rs.response_id=r.id WHERE r.character_id=$1 AND (rs.memory_id=ANY($2::uuid[]) OR rs.event_id=ANY($3::uuid[]))",[this.characterId,memoryIds,eventIds])).rows;
    for(const r of affected){await c.query("UPDATE response_runs SET status=CASE WHEN status IN ('planned','generating','synthesizing','delivering') THEN 'cancelled' ELSE status END,plan=NULL,cancel_reason='source_invalidated' WHERE id=$1",[r.id]);await c.query("UPDATE speech_segments SET text=NULL,delivery_status=CASE WHEN delivery_status IN ('finished','unknown') THEN delivery_status ELSE 'cancelled' END WHERE response_id=$1",[r.id]);await this.resolveAttempt(c,r.id,'unknown');}
    await c.query("UPDATE response_runs SET status='cancelled',cancel_reason='generation_invalidated',finished_at=$2 WHERE character_id=$1 AND status IN ('planned','generating','synthesizing','delivering')",[this.characterId,new Date(this.now(s))]);
    s.generationEpoch++;
    await c.query("UPDATE agendas SET status='expired',closed_reason='source_invalidated' WHERE character_id=$1 AND source_memory_id=ANY($2::uuid[]) AND status IN ('pending','reserved','offered')",[this.characterId,memoryIds]);
    return affected.map(x=>x.id);
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
    for(const ev of inputs){if(ev.kind==='praise'||ev.kind==='direct_insult'){const app:Appraisal={target:'character',act:ev.kind==='praise'?'praise':'criticism',strength:ev.strength??0,hostility:2,goal_relation:'unrelated',uncertain:false,evidence_refs:[]};const effect=socialEffect(app,replayed,ev.identityId,ev.at);ev.appliedStimulus=effect.stimulus;await c.query('UPDATE relationship_evidence SET applied=$2 WHERE id=$1',[ev.id,{stimulus:effect.stimulus,habituation:effect.habituation}]);}replayed.push(ev);}
    const activities=(await c.query("UPDATE activity_steps SET data_status='invalidated',normalized_answer=NULL,hint_id=NULL,verdict=NULL WHERE character_id=$1 AND event_id=ANY($2::uuid[]) RETURNING activity_run_id",[this.characterId,related])).rows.map(x=>x.activity_run_id);
    const started=e.kind==='activity.started'?[e.payload?.activityId]:[];
    for(const activityId of new Set([...activities,...started])) {
      const run=(await c.query('SELECT * FROM activity_runs WHERE id=$1 AND character_id=$2',[activityId,this.characterId])).rows[0];if(!run)continue;
      const validStart=(await c.query("SELECT 1 FROM events WHERE character_id=$1 AND kind='activity.started' AND payload->>'activityId'=$2 AND data_status='active'",[this.characterId,activityId])).rowCount;
      const validSteps=(await c.query("SELECT st.kind,st.verdict,e.parent_event_id,st.event_id FROM activity_steps st JOIN events e ON e.id=st.event_id WHERE st.activity_run_id=$1 AND st.data_status='active' AND e.data_status='active' ORDER BY st.step_no",[activityId])).rows;
      const submissions=validSteps.filter(x=>x.kind==='answer_submitted'),judgements=validSteps.filter(x=>x.kind==='answer_judged');
      const complete=validStart&&submissions.every(sub=>judgements.some(j=>j.parent_event_id===sub.event_id))&&judgements.every(j=>submissions.some(sub=>sub.event_id===j.parent_event_id));
      const solved=complete&&judgements.some(j=>j.verdict==='correct');const nextStatus=!complete?'ended':solved?'solved':run.status==='ended'?'ended':'solving';
      await c.query('UPDATE activity_runs SET status=$2,ended_at=$3,version=version+1 WHERE id=$1',[activityId,nextStatus,['ended','solved'].includes(nextStatus)?run.ended_at??new Date(this.now(s)):null]);
      if(['ended','solved'].includes(nextStatus))await c.query("UPDATE agendas SET status='expired',closed_reason='activity_source_deleted' WHERE activity_run_id=$1 AND status IN ('pending','reserved','offered')",[activityId]);
    }
    await c.query('UPDATE appraisals SET result=NULL,provider_result=NULL,context_refs=\'[]\'::jsonb,status=\'stale\' WHERE character_id=$1 AND (event_id=ANY($2::uuid[]) OR EXISTS(SELECT 1 FROM jsonb_array_elements(context_refs) ref WHERE ref->>\'id\'=ANY($3::text[])))',[this.characterId,related,related]);
    await c.query("UPDATE transitions SET effects=NULL,replay_status='source_redacted' WHERE character_id=$1 AND source_event_id=ANY($2::uuid[])",[this.characterId,related]);
    await c.query('UPDATE tasks SET result=NULL,payload=jsonb_build_object(\'sessionId\',session_id) WHERE character_id=$1',[this.characterId]);
    const cancelled=await this.invalidateOutputs(c,s,memories,related);const body=decay(s.body,this.now(s));body.workingMemoryEventIds=body.workingMemoryEventIds.filter(x=>!related.includes(x));if(body.attention.eventId&&related.includes(body.attention.eventId))body.attention.eventId=null;for(const a of Object.values(body.affect))a.causes=a.causes.filter(x=>!related.includes(x.eventId));
    await this.project(c,s);const event=await this.event(c,e.session_id,'event.deleted',requestId,{eventId:id,expectedRevision},null,null,'studio:event.delete');await this.bump(c,s,event,body);return {status:'committed',eventId:event.id,cancelled};
  });}
}
