import {afterEach,expect,it,vi} from 'vitest';
import {mkdtempSync,readFileSync,writeFileSync,rmSync,existsSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {DialogueBudget} from './openai.ts';
import {createProviders} from '../../../apps/runtime/src/providers.ts';
import {parseConfig} from '../../contracts/src/local-config.ts';
import {control} from '../../../evals/conversation-actions-probe.ts';
import {interactionFixture} from '../../../evals/interaction-fixture.ts';
import {Coordinator,type Sink} from '../../../apps/runtime/src/coordinator/index.ts';
import type {Store} from '../../database/src/store.ts';
import {randomUUID} from 'node:crypto';

const dirs:string[]=[];afterEach(()=>{vi.unstubAllGlobals();for(const d of dirs.splice(0))rmSync(d,{recursive:true,force:true});});
const old={id:'known-count',kind:'count',status:'unknown',usd:.010635};
const authorization={authorization:'synthetic test approval',maxDecisionCalls:63,maxDialogueCalls:25,acknowledgedCountEntryId:old.id};
function setup(){const dir=mkdtempSync(join(tmpdir(),'runtime-budget-'));dirs.push(dir);const path=join(dir,'budget.json');const entries=[old,...Array.from({length:62},(_,i)=>({id:'d'+i,kind:'decision',model:'gpt-6-luna',inputUsdPerMillion:.1,status:'completed',usd:.0001})),...Array.from({length:24},(_,i)=>({id:'g'+i,kind:'dialogue',status:'completed',usd:.001}))];writeFileSync(path,JSON.stringify({version:1,model:'gpt-6-sol',limitUsd:1,entries}));return {path,entries};}
it.each(['approved','pending','missing','wrong-kind','new-unknown','budget','role-cap'] as const)('acknowledged interrupted generation preserves reserves and guards: %s',mode=>{
 const {path,entries}=setup();entries.push({id:'interrupted',kind:mode==='wrong-kind'?'count':'dialogue',status:mode==='pending'?'reserved':'unknown',usd:mode==='budget'?1:.011});
 if(mode==='new-unknown')entries.push({id:'unexpected',kind:'dialogue',status:'unknown',usd:.01});
 writeFileSync(path,JSON.stringify({version:1,model:'gpt-6-sol',limitUsd:1,entries}));
 const b=new DialogueBudget(path,1,undefined,{...authorization,maxDialogueCalls:mode==='role-cap'?25:26,acknowledgedDialogueEntryId:mode==='missing'?'missing':'interrupted'});
 const before=readFileSync(path,'utf8');
 if(mode!=='approved'){expect(()=>b.reserve('dialogue',{})).toThrow(mode==='budget'?'dialogue_budget_exceeded':mode==='role-cap'?'dialogue_attempt_limit':'dialogue_usage_unconfirmed');expect(readFileSync(path,'utf8')).toBe(before);return;}
 // setup's legacy completed entries have no usage: .0302 is still unverified.
 expect(b.summary().unconfirmedModelReserveUsd).toBeCloseTo(.0412,12);const id=b.reserve('dialogue',{});b.finish(id,{input_tokens:100,output_tokens:10,cached_tokens:0});
 expect(JSON.parse(readFileSync(path,'utf8')).entries.slice(0,entries.length)).toEqual(entries);
 expect(()=>b.reserve('dialogue',{})).toThrow('dialogue_attempt_limit');
 const config={LOCAL_ONLY:'false',ALLOW_PAID_PROVIDERS:'true',APPRAISAL_PROVIDER:'openai-decisions-v4',APPRAISAL_MODEL:'gpt-6-luna',DIALOGUE_PROVIDER:'openai',DIALOGUE_MODEL:'gpt-6-sol',DIALOGUE_API_KEY:'synthetic',DIALOGUE_BUDGET_USD:'1',DIALOGUE_BUDGET_PATH:path,OPENAI_ACKNOWLEDGED_COUNT_ENTRY_ID:old.id,OPENAI_ACKNOWLEDGED_DIALOGUE_ENTRY_ID:'interrupted',OPENAI_MAX_DECISION_CALLS:'63',OPENAI_MAX_DIALOGUE_CALLS:'27'};
 expect(()=>parseConfig(config)).toThrow();const providers=createProviders(parseConfig({...config,OPENAI_BUDGET_AUTHORIZATION:'User approved retaining interrupted generation reserve'}),{});
 expect(providers.dialogue.readiness?.().preparationError).toBeNull();
});
it('explicit higher budget keeps ledger agreement, old reservations and the configured ceiling',()=>{
 const {path,entries}=setup();expect(()=>new DialogueBudget(path,3)).toThrow('runtime_budget_authorization_required');
 const b=new DialogueBudget(path,3,undefined,authorization);expect(b.availability('decision').errorCode).toBe('dialogue_budget_invalid');
 writeFileSync(path,JSON.stringify({version:1,model:'gpt-6-sol',limitUsd:3,entries}));
 const id=b.reserve('decision',{});b.finish(id,{input_tokens:100,output_tokens:0,cached_tokens:0});expect(JSON.parse(readFileSync(path,'utf8')).entries.slice(0,entries.length)).toEqual(entries);
 const total=JSON.parse(readFileSync(path,'utf8'));total.entries.push({id:'spent',kind:'count',status:'completed',usd:2.99});writeFileSync(path,JSON.stringify(total));expect(b.availability('dialogue').errorCode).toBe('dialogue_budget_exceeded');
 const base={LOCAL_ONLY:'false',ALLOW_PAID_PROVIDERS:'true',DIALOGUE_PROVIDER:'openai',DIALOGUE_MODEL:'gpt-6-sol',DIALOGUE_API_KEY:'synthetic',DIALOGUE_BUDGET_PATH:path,DIALOGUE_BUDGET_USD:'3'};
 expect(()=>parseConfig(base)).toThrow();expect(parseConfig({...base,OPENAI_BUDGET_AUTHORIZATION:'User approved total USD3'}).DIALOGUE_BUDGET_USD).toBe(3);
 for(const amount of [0,-1,Infinity,NaN])expect(()=>new DialogueBudget(path,amount,undefined,authorization)).toThrow();
});
it('budget summary separates usage estimates and unverified reserves without writes or calls',()=>{
 const {path}=setup();const entries=[old,{id:'count',kind:'count',status:'completed',usd:.4},{id:'generation',kind:'dialogue',status:'completed',usd:.02,usage:{input_tokens:4000,output_tokens:1000,cached_tokens:0}},{id:'decision',kind:'decision',model:'gpt-6-luna',inputUsdPerMillion:.1,status:'completed',usd:.001,usage:{input_tokens:10000,output_tokens:0,cached_tokens:0}},{id:'pending',kind:'dialogue',status:'reserved',usd:.03},{id:'legacy',kind:'dialogue',status:'completed',usd:.01}];
 writeFileSync(path,JSON.stringify({version:1,model:'gpt-6-sol',limitUsd:1,entries}));const before=readFileSync(path,'utf8'),fetcher=vi.fn();vi.stubGlobal('fetch',fetcher);
 const summary=new DialogueBudget(path,1).summary();
 expect(summary).toMatchObject({billingVerified:false,limitUsd:1,modelUsageEstimateUsd:.021,unconfirmedModelReserveUsd:.04,attempts:{count:2,dialogue:3,decision:1},unresolvedEntries:2});
 expect(summary.tokenCountReserveUsd).toBeCloseTo(.410635,12);expect(summary.enforcedTotalUsd).toBeCloseTo(.471635,12);expect(summary.remainingGuardUsd).toBeCloseTo(.528365,12);
 expect(readFileSync(path,'utf8')).toBe(before);expect(existsSync(path+'.lock')).toBe(false);expect(fetcher).not.toHaveBeenCalled();
});
it('budget summary rejects corrupt or locked evidence and does not create a missing ledger',()=>{
 const {path}=setup(),b=new DialogueBudget(path,1);writeFileSync(path,'{}');expect(()=>b.summary()).toThrow('dialogue_budget_invalid');
 writeFileSync(path+'.lock','');expect(()=>b.summary()).toThrow('dialogue_budget_locked');rmSync(path+'.lock');rmSync(path);
 expect(b.summary()).toMatchObject({modelUsageEstimateUsd:0,tokenCountReserveUsd:0,unconfirmedModelReserveUsd:0,enforcedTotalUsd:0,remainingGuardUsd:1});expect(existsSync(path)).toBe(false);
});
it('runtime authorization preserves prior costs and permits only the separately bounded roles',()=>{
 const {path,entries}=setup(),b=new DialogueBudget(path,1,undefined,authorization);
 const d=b.reserve('decision',{});b.finish(d,{input_tokens:100,output_tokens:0,cached_tokens:0});
 const c=b.reserve('count',{});b.finish(c);
 const g=b.reserve('dialogue',{});b.finish(g,{input_tokens:100,output_tokens:10,cached_tokens:0});
 expect(()=>b.reserve('decision',{})).toThrow('decision_attempt_limit');expect(()=>b.reserve('dialogue',{})).toThrow('dialogue_attempt_limit');expect(()=>b.reserve('count',{})).toThrow('dialogue_attempt_limit');
 expect(JSON.parse(readFileSync(path,'utf8')).entries.slice(0,entries.length)).toEqual(entries);
 expect(()=>new DialogueBudget(path,1).reserve('decision',{})).toThrow('dialogue_usage_unconfirmed');
});
it.each(['new-unknown','pending','wrong-id','wrong-kind','exhausted'])('runtime authorization does not bypass %s',kind=>{
 const {path,entries}=setup();
 if(kind==='new-unknown'||kind==='pending')entries.push({...old,id:'new',status:kind==='pending'?'reserved':'unknown'});
 if(kind==='wrong-kind')entries[0]={...old,kind:'dialogue'};
 if(kind==='exhausted')entries[0]={...old,usd:1};
 writeFileSync(path,JSON.stringify({version:1,model:'gpt-6-sol',limitUsd:1,entries}));
 const b=new DialogueBudget(path,1,undefined,{...authorization,...(kind==='wrong-id'?{acknowledgedCountEntryId:'different'}:{})});
 expect(()=>b.reserve('decision',{})).toThrow(kind==='exhausted'?'dialogue_budget_exceeded':'dialogue_usage_unconfirmed');
});
it.each(['v3','v4'])('%s readiness observes the shared budget without writes or calls',version=>{
 const {path}=setup(),before=readFileSync(path,'utf8'),fetcher=vi.fn();vi.stubGlobal('fetch',fetcher);
 const config=parseConfig({LOCAL_ONLY:'false',ALLOW_PAID_PROVIDERS:'true',APPRAISAL_PROVIDER:'openai-decisions-'+version,APPRAISAL_MODEL:'gpt-6-luna',DIALOGUE_PROVIDER:'openai',DIALOGUE_MODEL:'gpt-6-sol',DIALOGUE_API_KEY:'synthetic',DIALOGUE_BUDGET_PATH:path,DIALOGUE_BUDGET_USD:'1'});
 const p=createProviders(config,{});expect(p.appraiser.readiness()).toMatchObject({status:'blocked',errorCode:'dialogue_usage_unconfirmed',inferenceVerified:false});expect(p.dialogue.readiness?.()).toMatchObject({status:'blocked',preparationError:'dialogue_usage_unconfirmed'});
 expect(readFileSync(path,'utf8')).toBe(before);expect(existsSync(path+'.lock')).toBe(false);expect(fetcher).not.toHaveBeenCalled();
});
it('an acknowledged historical entry must exist in the ledger; a new path cannot erase its history',()=>{
 const {path}=setup(),fresh=join(path,'..','fresh.json');
 const b=new DialogueBudget(fresh,1,undefined,authorization);
 expect(b.availability('decision').errorCode).toBe('dialogue_usage_unconfirmed');expect(existsSync(fresh)).toBe(false);
 expect(()=>b.reserve('decision',{})).toThrow('dialogue_usage_unconfirmed');expect(existsSync(fresh)).toBe(false);
});
it.each(['v3','v4'])('factory-selected %s produces source-bound evidence with no Jev key',async version=>{
 const {path}=setup();vi.stubGlobal('fetch',vi.fn(async()=>Response.json(interactionFixture({direct_attack:1},[0,0,1,0]))));
 const config=parseConfig({LOCAL_ONLY:'false',ALLOW_PAID_PROVIDERS:'true',APPRAISAL_PROVIDER:'openai-decisions-'+version,APPRAISAL_MODEL:'gpt-6-luna',DIALOGUE_PROVIDER:'openai',DIALOGUE_MODEL:'gpt-6-sol',DIALOGUE_API_KEY:'synthetic',DIALOGUE_BUDGET_PATH:path,DIALOGUE_BUDGET_USD:'1',OPENAI_BUDGET_AUTHORIZATION:authorization.authorization,OPENAI_MAX_DECISION_CALLS:'63',OPENAI_MAX_DIALOGUE_CALLS:'25',OPENAI_ACKNOWLEDGED_COUNT_ENTRY_ID:old.id});
 const p=createProviders(config,{}),c=control({id:'factory',text:'너는 쓸모없는 쓰레기야.',context:'none',allowedActs:[],policy:'attack'});
 expect(p.appraiser.promptVersion).toBe('openai-interaction-'+version);expect(p.dialogue.name).toBe('openai');expect(p.solver).toBeUndefined();
 const v=await p.appraiser.evaluate(c.event,{conversationContext:c.context}),event={eventId:c.event.id,identityId:c.event.identityId,eventRevision:'1',conversationContext:c.context};
 expect(p.evidenceVerifier.validate!(v.appraisal,v.metadata,event)).toBe(true);expect(p.evidenceVerifier.verifyConversation!(v.appraisal,v.metadata,event)).toMatchObject({directAttack:'yes'});
 expect(p.appraiser.readiness()).toMatchObject({status:'blocked',inferenceVerified:true,errorCode:'decision_attempt_limit'});
});
it.each(['v3','v4'])('%s configuration rejects unsupported appraisal model and unapproved ceilings',version=>{
 const base={LOCAL_ONLY:'false',ALLOW_PAID_PROVIDERS:'true',APPRAISAL_PROVIDER:'openai-decisions-'+version,APPRAISAL_MODEL:'gpt-6-luna',DIALOGUE_API_KEY:'synthetic',DIALOGUE_BUDGET_PATH:'unused.json',DIALOGUE_BUDGET_USD:'1'};
 for(const patch of [{APPRAISAL_MODEL:'gpt-6-sol'},{DIALOGUE_API_KEY:''},{ALLOW_PAID_PROVIDERS:'false'},{OPENAI_MAX_DECISION_CALLS:'63'},{OPENAI_ACKNOWLEDGED_COUNT_ENTRY_ID:old.id}])expect(()=>parseConfig({...base,...patch})).toThrow();
 expect(()=>new DialogueBudget('unused.json',1,undefined,{...authorization,maxDecisionCalls:Infinity})).toThrow();
});

it.each(['decision','dialogue'] as const)('coordinator keeps %s exhaustion within its own role before any generation work',async exhausted=>{
 const {path}=setup();
 const fetcher=vi.fn(async(url:string|URL|Request)=>String(url).endsWith('/input_tokens')?Response.json({input_tokens:12}):Response.json(interactionFixture({listen_request:1},[1,0,0,0])));vi.stubGlobal('fetch',fetcher);
 const p=createProviders(parseConfig({LOCAL_ONLY:'false',ALLOW_PAID_PROVIDERS:'true',APPRAISAL_PROVIDER:'openai-decisions-v3',APPRAISAL_MODEL:'gpt-6-luna',DIALOGUE_PROVIDER:'openai',DIALOGUE_MODEL:'gpt-6-sol',DIALOGUE_API_KEY:'synthetic',DIALOGUE_BUDGET_PATH:path,DIALOGUE_BUDGET_USD:'1',OPENAI_MAX_DECISION_CALLS:exhausted==='decision'?'62':'63',OPENAI_MAX_DIALOGUE_CALLS:exhausted==='dialogue'?'24':'25',OPENAI_BUDGET_AUTHORIZATION:authorization.authorization,OPENAI_ACKNOWLEDGED_COUNT_ENTRY_ID:old.id}),{});
 const c=control({id:'audit-regression',text:'지금은 답하지 말고 들어줘.',context:'none',allowedActs:[],policy:'listen'});
 c.context.history.turns=[{role:'user',text:'안녕',source:{kind:'event',id:randomUUID(),revision:'1'},order:'1'}];
 const request={event:{id:c.event.id,payload:{text:c.event.text},identity_id:c.event.identityId},revision:1,conversation:c.context.history,conversationContext:c.context,praiseSnapshot:{context:[]}};
 let done=false;const commit=vi.fn(async(_request:unknown,_appraisal:unknown,_metadata:unknown)=>{done=true;return {status:'observed',response:null};}),memories=vi.fn(async()=>[{id:randomUUID(),content:'합성 기억'}]);
 const store={db:{healthy:true},clock:()=>c.now,currentSession:async()=>({id:c.context.sessionId}),busy:async()=>false,candidates:async()=>done?[]:[{id:c.event.id,identity_id:c.event.identityId,received_at:new Date(c.now),payload:{}}],state:async()=>({body:c.state}),select:async()=>request,activity:async()=>null,memories,dialogueIdentities:async()=>[],commitAppraisal:commit} as unknown as Store;
 const failure=vi.fn(),sink:Sink={changed:async()=>{},inputStatus:()=>{},failure,owner:()=>null,sendOwner:()=>{}};
 const before=readFileSync(path,'utf8');await new Coordinator(store,p.dialogue,sink,p.appraiser).drain();
 expect(commit).toHaveBeenCalledOnce();expect(memories).not.toHaveBeenCalled();
 if(exhausted==='decision'){expect(fetcher).not.toHaveBeenCalled();expect(failure).toHaveBeenCalledWith('decision_attempt_limit');expect(readFileSync(path,'utf8')).toBe(before);}
 else{expect(fetcher).toHaveBeenCalledOnce();expect(String(fetcher.mock.calls[0]![0])).toMatch(/\/decisions$/);expect(failure).not.toHaveBeenCalled();expect(commit.mock.calls[0]![2]).toMatchObject({provider:'openai-decisions',promptVersion:'openai-interaction-v3'});}
});
