import assert from 'node:assert/strict';
import type {BrowserContext,Page} from '@playwright/test';

export type CaptionAckBody={responseId:string;segmentId:string;generationEpoch:string;outputEpoch:string};
export type StageObservation={
 type:'caption.shown'|'caption.finished';requestId:string;payload:CaptionAckBody;
 caption:string;stageClass:string;expressionLabel:string;visible:boolean;atMs:number;
};
export type StageEvidenceInput={
 response:{id:string;status:string;generation_epoch:string;segment_count:number};
 expectedExpression:string;decoded:string[];
 segments:Array<{id:string;response_id:string;segment_index:number;text:string|null;output_epoch:string;text_shown_at:Date|string|null;delivery_status:string}>;
 /** Stage incoming packets for this response and its ACK requests; heartbeat packets may remain. */
 packets:Array<{type:string;requestId?:string;payload:any}>;
 /** Scope observations and DB ACKs to the same response before calling. Foreign entries fail. */
 observations:StageObservation[];
 dbAcks:Array<{id:string;kind:string;source_key:string;payload:CaptionAckBody}>;
};

/** Observe the real transport without replacing it or delaying Stage playback. Never records auth. */
export async function installStageObserver(context:BrowserContext):Promise<void>{
 await context.addInitScript(()=>{
  const target=window as typeof window&{__cxStageObservations?:StageObservation[];__cxStageObserverInstalled?:boolean};
  if(target.__cxStageObserverInstalled)return;
  target.__cxStageObserverInstalled=true;target.__cxStageObservations=[];
  const send=WebSocket.prototype.send;
  WebSocket.prototype.send=function(data){
   try{
    const packet=typeof data==='string'?JSON.parse(data):null;
    if(packet?.type==='caption.shown'||packet?.type==='caption.finished'){
     const caption=document.querySelector('.caption'),style=caption?getComputedStyle(caption):null,rect=caption?.getBoundingClientRect();
     const p=packet.payload;
     target.__cxStageObservations!.push({type:packet.type,requestId:packet.requestId,
      payload:{responseId:p.responseId,segmentId:p.segmentId,generationEpoch:p.generationEpoch,outputEpoch:p.outputEpoch},
      caption:caption?.textContent??'',stageClass:document.querySelector('.stage')?.className??'',
      expressionLabel:document.querySelector('.expression-label')?.textContent??'',
      visible:!!rect&&rect.width>0&&rect.height>0&&style?.display!=='none'&&style?.visibility!=='hidden'&&style?.opacity!=='0',atMs:performance.now()});
    }
   }catch{/* Observation failure must not change native transport behavior; missing evidence fails validation. */}
   return send.call(this,data);
  };
 });
}

export async function readStageObservations(page:Page):Promise<StageObservation[]>{
 return page.evaluate(()=>(window as typeof window&{__cxStageObservations?:StageObservation[]}).__cxStageObservations??[]);
}

/** Mechanical delivery proof only. Does not assess the meaning or Korean quality of decoded text. */
export function assertStageEvidence(input:StageEvidenceInput):void{
 const {response,decoded,packets,observations,dbAcks}=input,n=decoded.length;
 assert(n>0&&decoded.every(text=>typeof text==='string'&&text.trim().length>0),'decoded_sentences_required');
 assert.equal(response.status,'completed','response_not_completed');assert.equal(response.segment_count,n,'response_segment_count');
 const segments=[...input.segments].sort((a,b)=>a.segment_index-b.segment_index);
 assert.equal(segments.length,n,'db_segment_count');assert.equal(new Set(segments.map(s=>s.id)).size,n,'duplicate_db_segment');
 const starts=packets.filter(p=>p.type==='response.start'),speech=packets.filter(p=>p.type==='speech.segment'),seals=packets.filter(p=>p.type==='response.sealed');
 assert.equal(starts.length,1,'response_start_count');assert.equal(speech.length,n,'wire_segment_count');assert.equal(seals.length,1,'response_sealed_count');
 const common={responseId:response.id,generationEpoch:response.generation_epoch,outputEpoch:segments[0].output_epoch};
 const labels:Record<string,string>={neutral:'차분하게 말하는 중',listening:'듣는 중',happy:'밝게 말하는 중',embarrassed:'조심스럽게 말하는 중',uncomfortable:'절제된 태도로 말하는 중'};
 assert(Object.hasOwn(labels,input.expectedExpression),'unsupported_expected_expression');
 for(const packet of [...starts,...speech,...seals])for(const [key,value] of Object.entries(common))assert.equal(packet.payload[key],value,`wire_${key}`);
 assert.equal(starts[0].payload.expression,input.expectedExpression,'start_expression');assert.equal(seals[0].payload.segmentCount,n,'sealed_segment_count');
 assert(packets.indexOf(starts[0])<packets.indexOf(speech[0])&&packets.indexOf(speech[n-1])<packets.indexOf(seals[0]),'wire_response_order');
 assert.equal(observations.length,n*2,'observation_count');assert.equal(dbAcks.length,n*2,'db_ack_count');
 assert.equal(new Set(observations.map(o=>o.requestId)).size,n*2,'duplicate_ack_request');assert.equal(new Set(dbAcks.map(a=>a.id)).size,n*2,'duplicate_db_ack');
 const commands=packets.filter(p=>p.type==='command.result');assert.equal(commands.length,n*2,'command_result_count');
 let previousTime=-Infinity;
 for(let i=0;i<n;i++){
  const segment=segments[i],packet=speech[i];
  assert.equal(segment.segment_index,i,'db_segment_index');assert.equal(segment.response_id,response.id,'db_response_id');assert.equal(segment.output_epoch,common.outputEpoch,'db_output_epoch');
  assert.equal(segment.text,decoded[i],'decoded_db_text');assert.equal(segment.delivery_status,'finished','db_segment_not_finished');
  assert(segment.text_shown_at!==null&&Number.isFinite(new Date(segment.text_shown_at).getTime()),'db_segment_not_shown');
  assert.equal(packet.payload.segmentId,segment.id,'wire_segment_id');assert.equal(packet.payload.segmentIndex,i,'wire_segment_index');assert.equal(packet.payload.text,decoded[i],'decoded_wire_text');
  for(const [offset,type] of ['caption.shown','caption.finished'].entries()){
   const observation=observations[i*2+offset],body={...common,segmentId:segment.id};
   assert.equal(observation.type,type,'observation_order');assert.deepEqual(observation.payload,body,'observation_identity');
   assert(typeof observation.requestId==='string'&&observation.requestId.length>0,'ack_request_id');
   assert.equal(observation.caption,decoded[i],'decoded_dom_text');assert.equal(observation.visible,true,'caption_not_visible');
   assert.deepEqual(observation.stageClass.trim().split(/\s+/).sort(),['stage','expression-'+input.expectedExpression].sort(),'stage_expression');
   assert.equal(observation.expressionLabel,labels[input.expectedExpression],'stage_expression_label');
   assert(Number.isFinite(observation.atMs)&&observation.atMs>=previousTime,'observation_time_order');previousTime=observation.atMs;
   const matching=dbAcks.filter(a=>a.source_key===observation.requestId);assert.equal(matching.length,1,'db_ack_request_count');
   const ack=matching[0];assert.equal(ack.kind,type,'db_ack_kind');assert.deepEqual(ack.payload,body,'db_ack_identity');
   const results=commands.filter(p=>p.payload.requestId===observation.requestId);assert.equal(results.length,1,'ack_command_count');
   assert.equal(results[0].payload.status,'committed','ack_not_committed');assert.equal(results[0].payload.eventId,ack.id,'ack_event_id');
   if(results[0].requestId!==undefined)assert.equal(results[0].requestId,observation.requestId,'ack_envelope_request_id');
  }
 }
}
