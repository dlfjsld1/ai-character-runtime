import {afterEach,expect,it,vi} from 'vitest';
import {createHash,randomUUID} from 'node:crypto';
import {mkdtempSync,mkdirSync,writeFileSync,readFileSync,rmSync,existsSync} from 'node:fs';
import {join,dirname,resolve} from 'node:path';
import {tmpdir} from 'node:os';
import {replayContextualStage,parseStageReplayArgs,loadContextualStageReplay,type ContextualStageReplayInput} from './contextual-stage-replay.ts';
import {contextualStageScenes,contextualStageIdentity} from './contextual-stage-fixture.ts';
import {buildDialogueRequest} from '../packages/adapters/src/dialogue-request.ts';
import {deepseekPayload} from '../packages/adapters/src/deepseek.ts';
import {deepseekInputBound} from '../packages/adapters/src/deepseek-budget.ts';
import {sourceHashes} from './contextual-stage.ts';

type Row=Record<string,any>;
const json=(value:unknown)=>JSON.stringify(value,null,2)+'\n',sha=(value:string)=>createHash('sha256').update(value).digest('hex'),digest=(value:unknown)=>sha(JSON.stringify(value));
const sourcePaths=Object.keys(sourceHashes());
const labels:Row={neutral:'차분하게 말하는 중',happy:'밝게 말하는 중',uncomfortable:'절제된 태도로 말하는 중'};
const evidence=(id:string)=>({id,revision:'1',event_revision:'1',kind:'chat.final',identity_id:contextualStageIdentity,data_status:'active',observed_at:'2026-10-18T01:00:00Z',appraisal_status:'accepted',provider:'synthetic-cx-stage',failure_code:null,replay_status:'available'});
const summary=(ledger:Row)=>{const total=ledger.entries.reduce((n:number,e:Row)=>n+e.usd,0);return {provider:'deepseek',billingVerified:false,limitUsd:ledger.limitUsd,enforcedTotalUsd:total,remainingGuardUsd:Math.max(0,ledger.limitUsd-total),attempts:ledger.entries.length,unresolvedEntries:ledger.entries.filter((e:Row)=>e.status!=='completed').length};};
function accounting(input:ContextualStageReplayInput){
 const r=input.result,before=input.ledgerBefore!,authorization='synthetic replay '+r.requestHash;
 const entries=r.steps.filter((s:Row)=>s.call).map((s:Row)=>({id:s.call.id,authorization,status:'completed',usd:.000078,inputBound:deepseekInputBound(s.request),maxOutputTokens:256,usage:{prompt_tokens:100,completion_tokens:40}}));
 const after={...before,entries:[...before.entries,...entries]},startSummary=summary(before),end=summary(after),originEntries=before.entries.slice(0,r.mode==='mock'?0:64),originSpent=originEntries.reduce((n:number,e:Row)=>n+e.usd,0);
 r.accounting={beforeHash:digest(before),afterHash:digest(after),authorization,requestHash:r.requestHash,authorizationOrigin:{calls:originEntries.length,fileHash:r.mode==='mock'?null:'a'.repeat(64),entriesHash:digest(originEntries),spentUsd:originSpent},startSummary,summary:end,newCalls:entries.length,newCostUsd:end.enforcedTotalUsd-startSummary.enforcedTotalUsd,authorizationSpentBefore:startSummary.enforcedTotalUsd-originSpent,authorizationSpentAfter:end.enforcedTotalUsd-originSpent,authorizationRemainingUsd:.2-(end.enforcedTotalUsd-originSpent),withinAuthorization:true,priorPrefixPreserved:true,after};
}
function fixture():ContextualStageReplayInput{
 const hashes=Object.fromEntries(sourcePaths.map(p=>[p,sha('synthetic source '+p)]));
 const manifest:Row={version:1,scope:'generation-db-stage',sourceHashes:hashes,scenes:structuredClone(contextualStageScenes)};
 const causes=['frustration','joy'].map(emotion=>{const eventId=randomUUID();return {emotion,eventId,evidence:evidence(eventId)};});
 const state=()=>({affect:Object.fromEntries(causes.map(c=>[c.emotion,{value:.7,causes:[{eventId:c.eventId,targetId:contextualStageIdentity}]}])),turn:{recentSilences:[] as Row[]}});
 const r:Row={status:'TECHNICAL_PASS_QUALITY_DEFERRED',mode:'mock',requestHash:'b'.repeat(64),preparedHash:sha(json(manifest)),transportCalls:8,apiCalls:0,physicalDrained:true,lockReleased:true,failures:[],browserErrors:[],accountingErrors:[],cleanup:{errors:[],busyAfter:false},claims:{dbStageDelivery:'PASS',actualGeneration:'NOT_TESTED_SYNTHETIC_HTTP'},seed:{identityId:contextualStageIdentity,causes},steps:[]};
 let group='',session='',history:Row[]=[],silence:Row|null=null;
 for(const [index,scene] of contextualStageScenes.entries()){
  if(group!==scene.group){group=scene.group;session=randomUUID();history=[];silence=null;}
  const inputId=randomUUID(),responseId=randomUUID(),after=state(),step:Row={scene:structuredClone(scene),evidenceErrors:[],busy:false,segments:[],packets:[],observations:[],dbAcks:[],sources:[],sentAcks:[]};
  const f:Row={scene:structuredClone(scene),inputId,evidence:evidence(inputId),before:state(),after,response:null,context:null,silence:null};step.fixture=f;
  if(scene.participation==='silent'){
   silence={eventId:inputId,eventRevision:'1',identityId:contextualStageIdentity,reason:'withholding',sourceRefs:[{kind:'event',id:inputId,version:'1'}]};f.silence=silence;after.turn.recentSilences.push(silence);step.status='SILENCE_PASS';
   history.push({role:'user',text:scene.text,source:{kind:'event',id:inputId,revision:'1'},order:String(index+1)});r.steps.push(step);continue;
  }
  const style={register:scene.expected.register,positiveTone:scene.expected.positiveTone,...(scene.expected.discomfortTone?{discomfortTone:scene.expected.discomfortTone}:{}),...(scene.expected.concealAffect?{concealAffect:true}:{})};
  const plan:Row={action:'answer',purpose:scene.expected.disclosure?'reengage':'question',targetIdentityId:contextualStageIdentity,expression:'happy',maxSentences:scene.maxSentences??1,delivery:'normal',speechStyle:style,memoryIds:[],participation:{mode:'speak'},...(silence?{reengagement:{disclosure:'deflect',silenceEventId:silence.eventId}}:{})};
  const context={currentInput:{id:inputId,kind:'chat.final',payload:{text:scene.text,identityId:contextualStageIdentity}},sources:[],memories:[],identities:[],silence,conversation:{version:1,sessionId:session,identityId:contextualStageIdentity,cutoffEventId:inputId,truncated:false,turns:structuredClone(history)},emotion:{joy:.7,frustration:.7,surprise:0,embarrassment:0,pleasantness:.6}};
  f.response={id:responseId,sessionId:session,generationEpoch:'1',plan};f.context=structuredClone(context);f.silence=silence;step.plan=plan;step.context=context;
  const decoded=Array.from({length:plan.maxSentences},()=>scene.expected.disclosure?'지금은 말하고 싶지 않아.':'해결돼서 다행이야.');
  step.request=deepseekPayload(buildDialogueRequest(plan as any,context,'deepseek-flash',{promptVariant:'conversation-history-v1'}),256);step.requestHash=sha(json(step.request));
  step.raw={content:JSON.stringify({...(!silence?{content:decoded[0]}:{}),sentences:decoded}),truncated:false,finishReason:'stop',model:'deepseek-flash'};step.decoded=decoded;step.call={id:randomUUID(),provider:'deepseek',model:'deepseek-flash',physicalCompleted:true};
  step.response={id:responseId,status:'completed',generation_epoch:'1',segment_count:decoded.length,plan};
  const common={responseId,generationEpoch:'1',outputEpoch:'1'};step.packets.push({type:'response.start',payload:{...common,expression:scene.expected.expression}});
  decoded.forEach((text,i)=>{const segmentId=randomUUID(),body={...common,segmentId};step.segments.push({id:segmentId,response_id:responseId,segment_index:i,text,output_epoch:'1',text_shown_at:'2026-10-18T01:00:00Z',delivery_status:'finished'});step.packets.push({type:'speech.segment',payload:{...body,segmentIndex:i,text}});
   ['caption.shown','caption.finished'].forEach((type,j)=>{const requestId=randomUUID(),id=randomUUID();step.observations.push({type,requestId,payload:body,caption:text,stageClass:'stage expression-'+scene.expected.expression,expressionLabel:labels[scene.expected.expression],visible:true,atMs:i*3000+j*2000});step.dbAcks.push({id,kind:type,source_key:requestId,payload:body});step.sentAcks.push({type,requestId,payload:body});step.packets.push({type:'command.result',requestId,payload:{requestId,status:'committed',eventId:id}});});
  });
  step.packets.push({type:'response.sealed',payload:{...common,segmentCount:decoded.length}});
  step.sources.push({response_id:responseId,event_id:inputId,source_version:'1'},...causes.map(c=>({response_id:responseId,event_id:c.eventId,source_version:'1'})),...history.map(t=>({response_id:responseId,...(t.source.kind==='event'?{event_id:t.source.id,source_version:t.source.revision}:{source_response_id:t.source.id,source_version:t.source.generationEpoch})})));
  step.status='DELIVERY_PASS_QUALITY_DEFERRED';r.steps.push(step);history.push({role:'user',text:scene.text,source:{kind:'event',id:inputId,revision:'1'},order:String(index+1)},{role:'assistant',text:decoded.join(' '),source:{kind:'response',id:responseId,generationEpoch:'1'},order:String(index+1)});
 }
 const input={manifest,result:r,ledgerBefore:{version:1,provider:'deepseek',model:'deepseek-flash',inputUsdPerMillion:.3,outputUsdPerMillion:1.2,limitUsd:.2,entries:[]},snapshotHashes:structuredClone(hashes),currentSourceHashes:structuredClone(hashes)};accounting(input);return input;
}
function stop(input:ContextualStageReplayInput){const r=input.result;r.status='FAIL';r.failures=['injected_failure'];r.steps=r.steps.slice(0,1);r.steps[0].status='FAIL';r.transportCalls=1;accounting(input);return input;}
afterEach(()=>vi.unstubAllGlobals());
it('replays every sentence and ACK with equal consecutive text, real source identities, history and silence; no network',()=>{
 const fetcher=vi.fn(()=>{throw Error('network forbidden');});vi.stubGlobal('fetch',fetcher);
 const input=fixture(),before=json(input),r=replayContextualStage(input);expect(r.status).toBe('VERIFIED_RECORDED_PASS');expect(r.steps.filter(s=>s.status==='DELIVERY_REPLAYED')).toHaveLength(8);expect(r.steps.filter(s=>s.status==='SILENCE_REPLAYED')).toHaveLength(1);expect(r.apiCalls).toBe(0);expect(r.mode).toBe('mock');expect(r.claims.newDbStageDelivery).toBe('NOT_RUN');expect(json(input)).toBe(before);expect(fetcher).not.toHaveBeenCalled();
});
it.each([
 ['snapshot source',(v:ContextualStageReplayInput)=>{v.snapshotHashes[sourcePaths[0]]='c'.repeat(64);}],
 ['current source',(v:ContextualStageReplayInput)=>{v.currentSourceHashes[sourcePaths[0]]='c'.repeat(64);}],
 ['missing source',(v:ContextualStageReplayInput)=>{delete v.manifest.sourceHashes[sourcePaths[0]];}],
 ['manifest binding',(v:ContextualStageReplayInput)=>{v.result.preparedHash='c'.repeat(64);}],
 ['request body',(v:ContextualStageReplayInput)=>{v.result.steps[0].request.temperature=.7;}],
 ['request hash',(v:ContextualStageReplayInput)=>{v.result.steps[0].requestHash='c'.repeat(64);}],
 ['raw second sentence',(v:ContextualStageReplayInput)=>{const s=v.result.steps[0],raw=JSON.parse(s.raw.content);raw.sentences[1]='다른 답이야.';s.raw.content=JSON.stringify(raw);}],
 ['missing raw',(v:ContextualStageReplayInput)=>{delete v.result.steps[0].raw;}],
 ['second DB sentence',(v:ContextualStageReplayInput)=>{v.result.steps[0].segments[1].text='다른 답이야.';}],
 ['second DOM sentence',(v:ContextualStageReplayInput)=>{v.result.steps[0].observations[2].caption='다른 답이야.';}],
 ['second ACK',(v:ContextualStageReplayInput)=>{v.result.steps[0].dbAcks.pop();}],
 ['sent ACK',(v:ContextualStageReplayInput)=>{v.result.steps[0].sentAcks[0].payload={...v.result.steps[0].sentAcks[0].payload,generationEpoch:'9'};}],
 ['actual history',(v:ContextualStageReplayInput)=>{v.result.steps[1].context.conversation.turns[1].text='기록과 다른 말이야.';}],
 ['history source revision',(v:ContextualStageReplayInput)=>{v.result.steps[1].sources.find((s:Row)=>s.source_response_id).source_version='8';}],
 ['cause revision',(v:ContextualStageReplayInput)=>{v.result.steps[0].sources[1].source_version='8';}],
 ['current input revision',(v:ContextualStageReplayInput)=>{v.result.steps[0].sources[0].source_version='8';}],
 ['silence reason link',(v:ContextualStageReplayInput)=>{v.result.steps[8].context.silence={...v.result.steps[8].context.silence,eventId:randomUUID()};}],
 ['silence ACK',(v:ContextualStageReplayInput)=>{v.result.steps[7].sentAcks.push(v.result.steps[0].sentAcks[0]);}],
 ['own call id',(v:ContextualStageReplayInput)=>{v.result.steps[0].call.id=randomUUID();}],
 ['prior prefix',(v:ContextualStageReplayInput)=>{v.ledgerBefore!.entries.push(v.result.accounting.after.entries[0]);}],
 ['accounting missing',(v:ContextualStageReplayInput)=>{delete v.result.accounting;}],
 ['false API zero',(v:ContextualStageReplayInput)=>{v.result.mode='live';}],
 ['missing physical drain',(v:ContextualStageReplayInput)=>{v.result.physicalDrained=false;}],
 ['incomplete success',(v:ContextualStageReplayInput)=>{v.result.steps.pop();}],
 ['failure promoted',(v:ContextualStageReplayInput)=>{v.result.failures.push('decoder failure');}],
 ['busy success',(v:ContextualStageReplayInput)=>{v.result.steps[0].busy=true;}],
 ['missing failure capture',(v:ContextualStageReplayInput)=>{delete v.result.steps[0].segments;}],
 ['success evidence error',(v:ContextualStageReplayInput)=>{v.result.steps[0].evidenceErrors.push('db unavailable');}],
 ['cleanup failure',(v:ContextualStageReplayInput)=>{v.result.cleanup.errors.push('runtime unavailable');}],
 ['cleanup busy',(v:ContextualStageReplayInput)=>{v.result.cleanup.busyAfter=true;}],
 ['last speech marked silent',(v:ContextualStageReplayInput)=>{v.result.steps.at(-1).status='SILENCE_PASS';}],
 ['step after failure',(v:ContextualStageReplayInput)=>{v.result.status='FAIL';v.result.steps[0].status='FAIL';}],
] as const)('rejects tampered or missing %s',(_name,change)=>{const value=fixture();change(value);expect(()=>replayContextualStage(value)).toThrow();});
it('replays rejected raw offline while keeping the original failure',()=>{
 const value=stop(fixture()),s=value.result.steps[0];s.raw.content='{invalid JSON';delete s.decoded;s.response.status='failed';
 const r=replayContextualStage(value);expect(r.status).toBe('STOPPED');expect(r.steps[0].rawReplay).toBe('DECODE_REJECTED');expect(r.recordedFailures).toEqual(['injected_failure']);
});
it('valid late raw can be decoded but never becomes successful delivery',()=>{
 const value=stop(fixture()),s=value.result.steps[0];delete s.decoded;s.response.status='failed';
 expect(replayContextualStage(value)).toMatchObject({status:'STOPPED',steps:[{status:'STOPPED',rawReplay:'VALID_UNDELIVERED'}]});
});
it('retains failed provider envelope even when its JSON decodes',()=>{
 const value=stop(fixture()),s=value.result.steps[0];delete s.decoded;s.raw.finishReason='length';
 expect(replayContextualStage(value)).toMatchObject({status:'STOPPED',steps:[{rawReplay:'PROVIDER_REJECTED'}]});
});
it.each([{content:null,finishReason:null,model:null},{content:'{broken',truncated:true},{content:'{broken',model:'unexpected-model'}])('retains rejected provider raw metadata %j',patch=>{
 const value=stop(fixture()),s=value.result.steps[0];delete s.decoded;Object.assign(s.raw,patch);
 expect(replayContextualStage(value)).toMatchObject({status:'STOPPED',steps:[{rawReplay:'PROVIDER_REJECTED'}]});
});
it('incomplete failure capture is reported explicitly instead of invented',()=>{
 const value=stop(fixture());delete value.result.steps[0].observations;value.result.steps[0].evidenceErrors=['page closed'];delete value.result.accounting;
 expect(replayContextualStage(value)).toMatchObject({status:'STOPPED',accounting:'UNAVAILABLE',steps:[{deliveryEvidenceComplete:false,evidenceErrors:['page closed']}]});
});
it('a failure before transport can be inspected without raw or a ledger',()=>{
 const value=stop(fixture()),s=value.result.steps[0];for(const key of ['request','requestHash','plan','context','decoded','raw','call'])delete s[key];delete value.result.accounting;delete value.ledgerBefore;value.result.transportCalls=0;
 expect(replayContextualStage(value)).toMatchObject({status:'STOPPED',transportCalls:0,steps:[{rawReplay:'UNAVAILABLE'}]});
});
it('an interrupted run with completed steps remains STOPPED',()=>{
 const value=fixture();value.result.status='RUNNING';value.result.steps=value.result.steps.slice(0,1);value.result.transportCalls=1;accounting(value);
 expect(replayContextualStage(value).status).toBe('STOPPED');
});
it('an early saved RUNNING record reports unknown call counts instead of inventing zero',()=>{
 const value=fixture(),r=value.result;r.status='RUNNING';r.steps=[];for(const key of ['transportCalls','apiCalls','physicalDrained','accounting','lockReleased','cleanup'])delete r[key];delete value.ledgerBefore;
 expect(replayContextualStage(value)).toMatchObject({status:'STOPPED',transportCalls:null,originalApiCalls:null,apiCalls:0,accounting:'UNAVAILABLE',recordedExecution:{physicalDrained:null,lockReleased:null}});
});
it('validates a synthetic live-shaped accounting snapshot without making a provider call',()=>{
 const value=fixture();value.result.mode='live';value.result.apiCalls=8;value.result.claims.actualGeneration='PASS';value.ledgerBefore!.limitUsd=.25;
 value.ledgerBefore!.entries=Array.from({length:151},(_,i)=>({id:'prior-'+i,authorization:'historical synthetic',status:'completed',usd:.000078,inputBound:1000,maxOutputTokens:256,usage:{prompt_tokens:100,completion_tokens:40}}));accounting(value);
 expect(replayContextualStage(value)).toMatchObject({status:'VERIFIED_RECORDED_PASS',mode:'live',apiCalls:0,originalApiCalls:8});
});
it('rejects a consistent live-shaped snapshot above the project cap even when additional spend is under its cap',()=>{
 const value=fixture();value.result.mode='live';value.result.apiCalls=8;value.result.claims.actualGeneration='PASS';value.ledgerBefore!.limitUsd=.25;
 value.ledgerBefore!.entries=Array.from({length:151},(_,i)=>({id:'prior-'+i,authorization:'historical synthetic',status:'completed',usd:i<64?.0042:.000078,inputBound:32768,maxOutputTokens:256,usage:{prompt_tokens:i<64?14000:100,completion_tokens:i<64?0:40}}));accounting(value);
 expect(value.result.accounting.authorizationSpentAfter).toBeLessThan(.2);expect(()=>replayContextualStage(value)).toThrow('replay_project_budget_exceeded');
});
it.each(['project','authorization'])('rejects success when the initial %s headroom could not reserve the fixed batch',kind=>{
 const value=fixture();value.result.mode='live';value.result.apiCalls=8;value.result.claims.actualGeneration='PASS';value.ledgerBefore!.limitUsd=.25;
 value.ledgerBefore!.entries=Array.from({length:151},(_,i)=>{const prompt_tokens=kind==='project'&&i<64?8800:kind==='authorization'&&i>=64?5000:100;return {id:'prior-'+i,authorization:'historical synthetic',status:'completed',usd:prompt_tokens*.3/1e6,inputBound:32768,maxOutputTokens:256,usage:{prompt_tokens,completion_tokens:0}};});accounting(value);
 expect(value.result.accounting.summary.enforcedTotalUsd).toBeLessThan(.25);expect(value.result.accounting.authorizationSpentAfter).toBeLessThan(.2);expect(()=>replayContextualStage(value)).toThrow('replay_'+kind+'_reservation');
});
it('CLI accepts only recorded/out and never accepts key, ledger or provider flags',()=>{
 expect(parseStageReplayArgs(['--recorded','J:/ai/recorded','--out','J:/ai/replay'])).toEqual({recorded:resolve('J:/ai/recorded'),out:resolve('J:/ai/replay')});
 for(const args of [[],['--recorded','J:/ai/a','--out','C:/tmp/a'],['--recorded','J:/ai/a','--out','J:/ai/a/child'],['--recorded','J:/ai/a','--out','J:/ai/b','--key-file','secret.env'],['--recorded','J:/ai/a','--out','J:/ai/b','--ledger','live.json']])expect(()=>parseStageReplayArgs(args)).toThrow();
});
it('loads only saved evidence and contained source snapshots; rejects path traversal',()=>{
 const directory=mkdtempSync(join(tmpdir(),'cx-stage-replay-')),recorded=join(directory,'recorded'),repo=join(directory,'repo');
 try{
  mkdirSync(recorded);mkdirSync(repo);const value=fixture();
  for(const path of sourcePaths){for(const root of [join(recorded,'source'),repo]){const target=join(root,path);mkdirSync(dirname(target),{recursive:true});writeFileSync(target,'synthetic source '+path);}}
  for(const [name,content] of [['manifest.json',value.manifest],['results.json',value.result],['ledger-before.json',value.ledgerBefore]] as const)writeFileSync(join(recorded,name),json(content));
  const before=readFileSync(join(recorded,'results.json'),'utf8');expect(replayContextualStage(loadContextualStageReplay(recorded,repo)).status).toBe('VERIFIED_RECORDED_PASS');expect(readFileSync(join(recorded,'results.json'),'utf8')).toBe(before);expect(existsSync(join(recorded,'replay.json'))).toBe(false);
  value.manifest.sourceHashes['../outside.env']='a'.repeat(64);writeFileSync(join(recorded,'manifest.json'),json(value.manifest));expect(()=>loadContextualStageReplay(recorded,repo)).toThrow('replay_source_path');
 }finally{const root=resolve(tmpdir()),target=resolve(directory);if(!target.startsWith(root+'\\')&&!target.startsWith(root+'/'))throw Error('unsafe_cleanup');rmSync(target,{recursive:true,force:true});}
});
