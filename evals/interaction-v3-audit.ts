// Read saved v3 evidence and replay every result without sending provider calls.
import {readFileSync,writeFileSync,readdirSync,existsSync,copyFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
import {mapInteractionResponse} from '../packages/adapters/src/openai-interaction.ts';
import {INTERACTION_V3_VERSION,interactionV3EvidenceVerifier} from '../packages/adapters/src/openai-interaction-v3.ts';
import {assessInteraction} from './interaction-eval.ts';
import type {prepareInteractionV3Cases} from './interaction-v3-eval.ts';

const root=resolve('J:/ai/ai-character-runtime/interaction-v3-20261015'),dir=resolve(root,'provider-cap-fix');
const json=(path:string)=>JSON.parse(readFileSync(path,'utf8'));
const sha=(path:string)=>createHash('sha256').update(readFileSync(path)).digest('hex');
const same=(a:unknown,b:unknown)=>JSON.stringify(a)===JSON.stringify(b);
const canonical=(value:unknown):unknown=>Array.isArray(value)?value.map(canonical):value&&typeof value==='object'?Object.fromEntries(Object.entries(value).sort(([a],[b])=>a.localeCompare(b)).map(([key,v])=>[key,canonical(v)])):value;
const sameContent=(a:unknown,b:unknown)=>same(canonical(a),canonical(b));
const fail:string[]=[];
const prepared=json(resolve(dir,'prepared.json')) as ReturnType<typeof prepareInteractionV3Cases>,manifest=json(resolve(dir,'manifest.json')),results=json(resolve(dir,'results.json')),before=json(resolve(dir,'budget-before.json')),after=json('J:/ai/ai-character-runtime/openai-generation-20261014/budget.json'),gate=json(resolve(dir,'confirmation-gate.json'));
if(results.status!=='CANDIDATE_PASSED'||results.rows.length!==18||results.attempts.length!==18||results.calls.length!==18||gate.devRows!==6||gate.allPass!==true||gate.decisionCalls!==42)fail.push('count_or_gate');
if(!same(before.entries,after.entries.slice(0,before.entries.length))||!same(results.budget,after)||before.entries.length!==185||after.entries.length!==203||after.entries.filter((e:{kind:string})=>e.kind==='decision').length!==54)fail.push('ledger_prefix_or_total');
if(after.entries.filter((e:{status:string})=>e.status!=='completed').length!==1||after.entries.find((e:{id:string})=>e.id==='3f1c4f32-41f7-42f2-b05e-dfe0d65aaaef')?.status!=='unknown')fail.push('old_unknown_changed');
if(sha(resolve(root,'prepared-cap-fix.json'))!==manifest.preparedHash||!same(prepared,json(resolve(root,'prepared-cap-fix.json'))))fail.push('prepared_changed');
for(const [path,hash] of Object.entries(manifest.sourceHashes as Record<string,string>))if(sha(path)!==hash||sha(resolve(dir,'source',path))!==hash)fail.push('source_'+path);
let inputTokens=0,newUsd=0;const replay:Record<string,unknown>[]=[];
for(let i=0;i<18;i++){
 const c=prepared.cases[i]!,row=results.rows[i],attempt=results.attempts[i],raw=json(resolve(dir,c.id+'-response.json')),request=json(resolve(dir,c.id+'-request.json')),entry=after.entries[185+i];
 if(row.id!==c.id||attempt.id!==c.id||!same(request,c.request)||entry.id!==attempt.ledgerEntryId||entry.status!=='completed'||entry.kind!=='decision'||entry.model!=='gpt-6-luna')fail.push('request_or_entry_'+c.id);
 if(raw.usage.input_tokens!==entry.usage.input_tokens||raw.usage.input_tokens_details.cached_tokens!==entry.usage.cached_tokens||Math.abs(entry.usd-raw.usage.input_tokens*.1/1e6)>1e-12)fail.push('usage_'+c.id);
 if(!sameContent(raw,row.metadata.providerResult.payload.raw))fail.push('raw_'+c.id);
 const mapped=mapInteractionResponse(raw,c.input.event.id,0,INTERACTION_V3_VERSION);
 if(!same(mapped.appraisal,row.appraisal)||!same(mapped.metadata.usage,row.metadata.usage))fail.push('mapping_'+c.id);
 const assessed=assessInteraction({appraisal:row.appraisal,metadata:row.metadata},c.input,c.expected,interactionV3EvidenceVerifier);
 if(!['checks','pass','outcome','facts','effect','repairAmount','plan'].every(key=>same((assessed as any)[key],row[key])))fail.push('replay_'+c.id);
 replay.push({id:c.id,pass:assessed.pass,checks:assessed.checks,outcome:assessed.outcome});inputTokens+=raw.usage.input_tokens;newUsd+=entry.usd;
}
if(results.calls.some((c:Record<string,unknown>)=>c.physicalCompleted!==true||c.errorCode!==null||c.usage===null))fail.push('physical_or_usage');
process.loadEnvFile('runtime-data/dialogue-api.env');const key=process.env.DIALOGUE_API_KEY??'';
const files=(path:string):string[]=>readdirSync(path,{withFileTypes:true}).flatMap(e=>e.isDirectory()?files(resolve(path,e.name)):[resolve(path,e.name)]);
const exposed=key.length>0&&files(dir).some(path=>readFileSync(path).includes(Buffer.from(key)));
if(exposed)fail.push('key_exposure');
const summary={status:results.status,devPass:replay.slice(0,6).filter(r=>r.pass).length,confirmationPass:replay.slice(6).filter(r=>r.pass).length,allReplaySame:!fail.some(x=>x.startsWith('replay_')),inputTokens,newUsd,conservativeUsd:after.entries.reduce((s:number,e:{usd:number})=>s+e.usd,0),priorEntries:before.entries.length,newEntries:after.entries.length,decisionCalls:54,oldUnknownPreserved:!fail.includes('old_unknown_changed'),sourceHashesSame:!fail.some(x=>x.startsWith('source_')),keyExposure:exposed,failures:fail,replay};
if(existsSync(resolve(dir,'audit.json'))&&!existsSync(resolve(dir,'audit-first-run.json')))copyFileSync(resolve(dir,'audit.json'),resolve(dir,'audit-first-run.json'));
writeFileSync(resolve(dir,'audit.json'),JSON.stringify(summary,null,2)+'\n');console.log(JSON.stringify({...summary,replay:undefined}));if(fail.length)process.exitCode=1;
