import {afterEach,expect,it,vi} from 'vitest';
import type {BrowserContext} from '@playwright/test';
import {assertStageEvidence,installStageObserver,type StageEvidenceInput,type StageObservation} from './contextual-stage-evidence.ts';

function evidence(texts=['첫 문장입니다.','다음 문장입니다.']):StageEvidenceInput{
 const common={responseId:'response',generationEpoch:'3',outputEpoch:'7'},result:StageEvidenceInput={response:{id:'response',status:'completed',generation_epoch:'3',segment_count:texts.length},expectedExpression:'neutral',decoded:texts,segments:[],packets:[{type:'response.start',payload:{...common,expression:'neutral'}}],observations:[],dbAcks:[]};
 texts.forEach((text,i)=>{
  const segmentId='segment-'+i,body={...common,segmentId};
  result.segments.push({id:segmentId,response_id:'response',segment_index:i,text,output_epoch:'7',text_shown_at:'2026-10-18T00:00:00Z',delivery_status:'finished'});
  result.packets.push({type:'speech.segment',payload:{...body,segmentIndex:i,text}});
  for(const [offset,type] of (['caption.shown','caption.finished'] as const).entries()){
   const requestId=`ack-${i}-${offset}`,id='event-'+requestId;
   result.observations.push({type,requestId,payload:body,caption:text,stageClass:'stage expression-neutral',expressionLabel:'차분하게 말하는 중',visible:true,atMs:i*3000+offset*2000});
   result.dbAcks.push({id,kind:type,source_key:requestId,payload:body});
   result.packets.push({type:'command.result',requestId,payload:{requestId,status:'committed',eventId:id}});
  }
 });
 result.packets.push({type:'response.sealed',payload:{...common,segmentCount:texts.length}});return result;
}

it('accepts every segment including consecutive identical text with distinct IDs and ACKs',()=>{
 expect(()=>assertStageEvidence(evidence())).not.toThrow();
 expect(()=>assertStageEvidence(evidence(['같은 문장입니다.','같은 문장입니다.']))).not.toThrow();
});

it.each([
 ['second DB text',(v:StageEvidenceInput)=>{v.segments[1].text='바뀐 문장입니다.';}],
 ['second wire text',(v:StageEvidenceInput)=>{v.packets.filter(p=>p.type==='speech.segment')[1].payload.text='바뀐 문장입니다.';}],
 ['second visible text',(v:StageEvidenceInput)=>{v.observations[2].caption='바뀐 문장입니다.';}],
 ['missing second shown',(v:StageEvidenceInput)=>{v.observations.splice(2,1);}],
 ['duplicate second shown',(v:StageEvidenceInput)=>{v.observations[3]=structuredClone(v.observations[2]);}],
 ['missing DB ACK',(v:StageEvidenceInput)=>{v.dbAcks.pop();}],
 ['duplicate DB ACK',(v:StageEvidenceInput)=>{v.dbAcks[3]=structuredClone(v.dbAcks[2]);}],
 ['foreign DB ACK',(v:StageEvidenceInput)=>{v.dbAcks[3].payload={...v.dbAcks[3].payload,responseId:'foreign'};}],
 ['foreign observation',(v:StageEvidenceInput)=>{v.observations[2].payload={...v.observations[2].payload,segmentId:'foreign'};}],
 ['wrong wire epoch',(v:StageEvidenceInput)=>{v.packets.filter(p=>p.type==='speech.segment')[1].payload.outputEpoch='6';}],
 ['wrong shown generation',(v:StageEvidenceInput)=>{v.observations[2].payload={...v.observations[2].payload,generationEpoch:'2'};}],
 ['wrong DB epoch',(v:StageEvidenceInput)=>{v.segments[1].output_epoch='6';}],
 ['not shown in DB',(v:StageEvidenceInput)=>{v.segments[1].text_shown_at=null;}],
 ['not finished in DB',(v:StageEvidenceInput)=>{v.segments[1].delivery_status='sent';}],
 ['incomplete response',(v:StageEvidenceInput)=>{v.response.status='delivering';}],
 ['wrong sealed count',(v:StageEvidenceInput)=>{v.packets.at(-1)!.payload.segmentCount=1;}],
 ['changed expression',(v:StageEvidenceInput)=>{v.observations[2].stageClass='stage expression-uncomfortable';}],
 ['changed expression label',(v:StageEvidenceInput)=>{v.observations[2].expressionLabel='절제된 태도로 말하는 중';}],
 ['invisible caption',(v:StageEvidenceInput)=>{v.observations[2].visible=false;}],
 ['rejected command',(v:StageEvidenceInput)=>{v.packets.find(p=>p.type==='command.result')!.payload.status='rejected';}],
 ['wrong committed event',(v:StageEvidenceInput)=>{v.packets.find(p=>p.type==='command.result')!.payload.eventId='foreign';}],
 ['missing command',(v:StageEvidenceInput)=>{v.packets.splice(v.packets.findIndex(p=>p.type==='command.result'),1);}],
 ['duplicate command',(v:StageEvidenceInput)=>{const commands=v.packets.filter(p=>p.type==='command.result');commands[3].payload={...commands[2].payload};}],
 ['foreign command',(v:StageEvidenceInput)=>{v.packets.find(p=>p.type==='command.result')!.payload.requestId='foreign';}],
 ['out of order shown',(v:StageEvidenceInput)=>{[v.observations[0],v.observations[1]]=[v.observations[1],v.observations[0]];}],
] as const)('rejects %s rather than accepting only the first caption',(_label,change)=>{
 const value=structuredClone(evidence());change(value);expect(()=>assertStageEvidence(value)).toThrow();
});

afterEach(()=>vi.unstubAllGlobals());
it('observes native send synchronously, preserves this/return/errors, and never records auth',async()=>{
 let install!:()=>void;
 await installStageObserver({addInitScript:async(fn:()=>void)=>{install=fn;}} as unknown as BrowserContext);
 const sent=vi.fn(function(this:unknown,data:unknown){if(data==='throw')throw Error('native_failure');return this;});
 class Socket{send=sent;}
 Socket.prototype.send=sent;
 const target:{__cxStageObservations?:StageObservation[]}={},caption={textContent:'보이는 문장입니다.',getBoundingClientRect:()=>({width:100,height:30})};
 vi.stubGlobal('window',target);vi.stubGlobal('WebSocket',Socket);vi.stubGlobal('document',{querySelector:(selector:string)=>selector==='.caption'?caption:selector==='.stage'?{className:'stage expression-neutral'}:{textContent:'차분하게 말하는 중'}});vi.stubGlobal('getComputedStyle',()=>({display:'block',visibility:'visible',opacity:'1'}));
 install();const socket=Object.create(Socket.prototype) as Socket;
 expect(socket.send('auth secret')).toBe(socket);expect(target.__cxStageObservations).toEqual([]);
 const body={responseId:'r',segmentId:'s',generationEpoch:'1',outputEpoch:'2'},raw=JSON.stringify({type:'caption.shown',requestId:'ack',payload:body});
 expect(socket.send(raw)).toBe(socket);expect(sent).toHaveBeenLastCalledWith(raw);
 expect(target.__cxStageObservations).toEqual([expect.objectContaining({type:'caption.shown',requestId:'ack',payload:body,caption:caption.textContent,visible:true})]);
 expect(()=>socket.send('throw')).toThrow('native_failure');
 install();socket.send(JSON.stringify({type:'caption.finished',requestId:'end',payload:body}));expect(target.__cxStageObservations).toHaveLength(2);
});
