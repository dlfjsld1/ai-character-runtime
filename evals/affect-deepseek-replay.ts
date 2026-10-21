// Revalidate recorded synthetic event responses locally, with the CURRENT validator.
// No keys, ledger, network, model calls or semantic quality assertions.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync,existsSync} from 'node:fs';
import {resolve,relative,sep} from 'node:path';
import {createHash} from 'node:crypto';
import {StructuredEventInterpreter,type EventInterpretationDiagnostic} from '../packages/adapters/src/event-interpreter.ts';
import {eventWireFormatSchema} from '../packages/adapters/src/event-reference-codec.ts';
import {validateAffectRequest} from '../packages/contracts/src/affect-appraisal.ts';
import {verifyDeepSeekReferenceRequests,referenceSourceHashes} from './affect-reference-artifacts.ts';

const args=process.argv.slice(2);assert.equal(args.length,4);assert.equal(args[0],'--recorded');assert.equal(args[2],'--output');
const base=resolve('J:/ai/ai-character-runtime');
function inside(path:string){const absolute=resolve(path),part=relative(base,absolute);assert(part&&part!=='..'&&!part.startsWith(`..${sep}`)&&!part.startsWith(sep)&&!part.includes(':'),'path_must_be_inside_J_ai');return absolute;}
const recorded=inside(args[1]!),output=inside(args[3]!);assert(!existsSync(output),'evidence_exists');
const read=(path:string)=>JSON.parse(readFileSync(path,'utf8'));
const manifest=read(resolve(recorded,'manifest.json'));assert.equal(manifest.prepared.syntheticOnly,true);assert.equal(manifest.prepared.provider,'deepseek');
const requests=read(resolve(recorded,'requests.json')) as {id:string;body:{max_tokens:number;messages:{role:string;content:string}[]}}[];
assert.equal(new Set(requests.map(row=>row.id)).size,requests.length);
const wireFormat=eventWireFormatSchema.parse(manifest.prepared.wireFormat??'uuid-v3');
const inputs=wireFormat==='refs-v1'?verifyDeepSeekReferenceRequests(manifest.prepared,read(resolve(recorded,'event-inputs.json')),requests):null;
assert(existsSync(resolve(recorded,'responses.jsonl')),'raw_responses_not_recorded_cannot_recover');
const responses=readFileSync(resolve(recorded,'responses.jsonl'),'utf8').split(/\r?\n/).filter(Boolean).map(line=>JSON.parse(line));
assert.equal(new Set(responses.map(row=>row.caseId)).size,responses.length);
const results:unknown[]=[];
for(const row of requests.filter(row=>row.body.max_tokens===2048)){
  const response=responses.find(r=>r.caseId===row.id);
  if(!response||response.truncated||typeof response.content!=='string'){results.push({id:row.id,status:'NOT_REPLAYABLE',reason:response?.truncated?'truncated':'no_content'});continue;}
  const input=inputs?inputs.find(r=>r.id===row.id)!.request:JSON.parse(row.body.messages.filter(m=>m.role==='user').at(-1)!.content),diagnostics:EventInterpretationDiagnostic[]=[];
  if(!inputs){try{validateAffectRequest(input);}catch{results.push({id:row.id,status:'NOT_REPLAYABLE',reason:'legacy_input_not_uuid_request'});continue;}}
  const result=await new StructuredEventInterpreter(async()=>response.content,r=>diagnostics.push(r),wireFormat).interpret(input);
  results.push({id:row.id,status:'REPLAYED',result,diagnostics,recordedChecks:manifest.results?.find((r:any)=>r.id===row.id)?.checks??null});
}
const sourceHashes=Object.fromEntries(['packages/adapters/src/event-interpreter.ts','packages/contracts/src/affect-appraisal.ts'].map(path=>[path,createHash('sha256').update(readFileSync(path)).digest('hex')]));
const report={status:'OFFLINE_REPLAY',providerCalls:0,scope:'event response validation only; not transport or annotations or semantic quality',inputScope:inputs?'recorded_original_snapshot':'legacy_wire_visible_input_only',wireFormat,recorded,sourceHashes:{...sourceHashes,...referenceSourceHashes()},results};
mkdirSync(output,{recursive:true});writeFileSync(resolve(output,'replay.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({status:report.status,providerCalls:0,eventRows:results.length,output}));
