import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {z} from 'zod';
import {eventInterpretationRequestSchema,validateAffectRequest,type EventInterpretationRequest} from '../packages/contracts/src/affect-appraisal.ts';
import {EVENT_REFERENCE_CODEC_VERSION,eventWireFormatSchema} from '../packages/adapters/src/event-reference-codec.ts';
import {EVENT_REFERENCE_PROMPT_VERSION,buildEventInterpretationRequest} from '../packages/adapters/src/event-interpreter.ts';
import {deepseekPayload} from '../packages/adapters/src/deepseek.ts';

export const referenceSourceFiles=['evals/affect-reference-artifacts.ts','evals/affect-reference-fixture.ts','packages/adapters/src/event-reference-codec.ts','packages/adapters/src/event-interpreter.ts','packages/contracts/src/affect-appraisal.ts','packages/adapters/src/deepseek.ts','packages/adapters/src/openai.ts'];
export const referenceHash=(value:unknown)=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
export const referenceSourceHashes=()=>Object.fromEntries(referenceSourceFiles.map(path=>[path,createHash('sha256').update(readFileSync(path)).digest('hex')]));
const rowSchema=z.object({id:z.string().min(1),request:eventInterpretationRequestSchema,wireFormat:z.literal('refs-v1'),codecVersion:z.literal(EVENT_REFERENCE_CODEC_VERSION),promptVersion:z.literal(EVENT_REFERENCE_PROMPT_VERSION)}).strict();
export function referenceInputs(rows:readonly {id:string;request:EventInterpretationRequest}[]){
  return rows.map(row=>rowSchema.parse({...row,request:validateAffectRequest(row.request),wireFormat:'refs-v1',codecVersion:EVENT_REFERENCE_CODEC_VERSION,promptVersion:EVENT_REFERENCE_PROMPT_VERSION}));
}
export function referenceMetadata(inputs:ReturnType<typeof referenceInputs>){return {wireFormat:'refs-v1' as const,codecVersion:EVENT_REFERENCE_CODEC_VERSION,promptVersion:EVENT_REFERENCE_PROMPT_VERSION,eventInputsHash:referenceHash(inputs)};}
export function validateReferenceInputs(metadata:any,raw:unknown){
  assert.equal(metadata.wireFormat,'refs-v1','reference_wire_version');assert.equal(metadata.codecVersion,EVENT_REFERENCE_CODEC_VERSION,'reference_codec_version');
  assert.equal(metadata.promptVersion,EVENT_REFERENCE_PROMPT_VERSION,'reference_prompt_version');
  assert.equal(referenceHash(raw),metadata.eventInputsHash,'reference_inputs_hash');
  const rows=z.array(rowSchema).min(1).parse(raw);assert.equal(new Set(rows.map(r=>r.id)).size,rows.length,'reference_duplicate_id');
  for(const row of rows)validateAffectRequest(row.request);
  for(const [path,hash] of Object.entries(referenceSourceHashes()))assert.equal(metadata.sourceHashes?.[path],hash,`reference_source_changed: ${path}`);
  return rows;
}
export function verifyDeepSeekReferenceRequests(metadata:any,rawInputs:unknown,requests:{id:string;body:unknown}[]){
  const inputs=validateReferenceInputs(metadata,rawInputs);assert.equal(requests.length,inputs.length,'reference_request_count');
  assert.equal(new Set(requests.map(r=>r.id)).size,requests.length,'reference_duplicate_request');
  for(const input of inputs)assert.deepEqual(requests.find(r=>r.id===input.id)?.body,deepseekPayload(buildEventInterpretationRequest(input.request,'refs-v1'),2048),'reference_wire_changed');
  assert.equal(referenceHash(requests.map(r=>JSON.stringify(r.body)).sort()),metadata.requestHash,'reference_request_hash');return inputs;
}

// CLI-only selection. Reject a live refs request before opening any key/ledger.
export function eventWireOption(rawArgs:string[],live:boolean){
  const args=[...rawArgs],index=args.indexOf('--wire-format');
  const wireFormat=eventWireFormatSchema.parse(index<0?'uuid-v3':args[index+1]);
  if(index>=0)args.splice(index,2);assert(!args.includes('--wire-format'),'duplicate_wire_format');
  if(live)assert.equal(wireFormat,'uuid-v3','reference_live_not_authorized');
  return {args,wireFormat};
}
export function assertUuidPreparedForLive(manifest:any){
  for(const metadata of [manifest,manifest.prepared])if(metadata?.wireFormat!==undefined)assert.equal(metadata.wireFormat,'uuid-v3','reference_live_not_authorized');
}
