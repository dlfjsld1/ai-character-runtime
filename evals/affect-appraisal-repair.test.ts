import {it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {prepareAppraisalProbe} from '../packages/adapters/src/appraisal-probe.ts';
import {createEventReferenceCodec} from '../packages/adapters/src/event-reference-codec.ts';
import {validateAffectRequest,type EventInterpretationResult} from '../packages/contracts/src/affect-appraisal.ts';
import {appendEventAffect} from '../packages/character-core/src/event-affect.ts';
import {affectHash} from './affect-cases.ts';
import {buildReconnectPreparation,checkReconnectCandidate} from './affect-reconnect.ts';

// Saved provider text and authored contrasts are separate evidence classes.
// No provider, env, original artifact directory or real ledger is read here.
const fixture=JSON.parse(readFileSync('evals/fixtures/affect-appraisal-repair-v1.json','utf8'));
const prep=buildReconnectPreparation('dev');
const result=(interpretation:any):EventInterpretationResult=>({status:'interpreted',interpretation,promptVersion:'offline-diagnostic'});
it('keeps six raw observations, twelve authored contrasts and the original twelve-case denominator',()=>{
  expect(fixture.syntheticOnly).toBe(true);expect(fixture.semanticQuality).toBe('NOT_VERIFIED');
  expect(fixture.source).toMatchObject({planned:12,attempted:6,notSent:['A07','A08','A09','A10','A11','A12']});
  expect(fixture.stored.map((r:any)=>r.sourceCaseId)).toEqual(['A01','A02','A03','A04','A05','A06']);
  expect(fixture.contrasts.map((r:any)=>r.id)).toEqual(Array.from({length:12},(_,i)=>'R'+String(i+1).padStart(2,'0')));
  expect(fixture.stored.map((r:any)=>r.originalSemantic.status)).toEqual(['NEEDS_REVIEW','PASS','NEEDS_REVIEW','FAIL','FAIL','INVALID_OUTPUT']);
  for(const r of fixture.stored){expect(r.kind).toBe('saved_provider_raw');expect(createHash('sha256').update(r.raw).digest('hex')).toBe(r.rawSha256);expect(affectHash(r.originalInput)).toBe(r.inputHash);}
});
it.each(fixture.stored as Record<string,any>[])('saved $sourceCaseId retains its raw verdict separately from the stronger rubric',(r:any)=>{
  const input=validateAffectRequest(r.originalInput),p=prepareAppraisalProbe(input,r.fixedOutcome),item=prep.suite.cases.find(c=>c.id===r.sourceCaseId)!;
  expect(prep.originals.find(c=>c.id===r.sourceCaseId)!.request).toEqual(input);
  if(r.sourceCaseId==='A06'){
    expect(()=>p.decode(r.raw)).toThrow('appraisal_probe_invalid_output');
    expect(()=>createEventReferenceCodec(input).decode({...JSON.parse(r.raw),outcome:createEventReferenceCodec(input).encodeOutcome(r.fixedOutcome)})).toThrow('affect_cross_scope_episode_evidence');
    // Dropping the illegal quote is NOT a repair: its invented negativity still fails semantics.
    const diagnostic=JSON.parse(r.raw);diagnostic.appraisals[0].evidence.pop();
    expect(checkReconnectCandidate(item,input,result(p.decode(diagnostic))).status).toBe('FAIL');return;
  }
  const decoded=p.decode(r.raw);expect(decoded).toEqual(r.originalResult.interpretation);
  expect(checkReconnectCandidate(r.originalScene,input,r.originalResult)).toEqual(r.originalChecks);
  const checks=checkReconnectCandidate(item,input,result(decoded));
  if(['A01','A03'].includes(r.sourceCaseId)){
    expect(checks.failures).toEqual(expect.arrayContaining(['episode.actor','episode.target','episode.agency']));expect(checks.scopes.episode).toBe('FAIL');
    const corrected=structuredClone(decoded);for(const a of corrected.appraisals){a.actorId=input.scope.characterId;a.targetId=input.speakerId;a.agency='self';}
    expect(checkReconnectCandidate(item,input,result(corrected)).status).toBe('REVIEW_REQUIRED');
    for(let i=0;i<corrected.appraisals.length;i++){
      const bad=structuredClone(corrected);bad.appraisals[i]!.agency='other';bad.appraisals[i]!.importance=0;
      const checked=checkReconnectCandidate(item,input,result(bad));expect(checked.failures).toContain('episode.agency');expect(checked.scopes.episode).toBe('FAIL');
    }
  }else if(r.sourceCaseId==='A02')expect(checks.status).toBe('REVIEW_REQUIRED');
  else {expect(checks.status).toBe('FAIL');expect(checks.failures).toEqual(r.originalChecks.failures);}
});
it.each(fixture.contrasts as Record<string,any>[])('authored $id preserves required scope, polarity and contribution without proving model quality',(r:any)=>{
  expect(r.kind).toBe('authored_contrast');const input=validateAffectRequest(r.request),p=prepareAppraisalProbe(input,r.fixedOutcome),decoded=p.decode(r.raw);
  expect(decoded.outcome).toEqual(r.fixedOutcome);expect(checkReconnectCandidate(r.item,input,result(decoded)).status).toBe('REVIEW_REQUIRED');
  const levels=appendEventAffect([],input,decoded,input.eventId).snapshot.levels;
  if(['R01','R03','R12'].includes(r.id))expect(levels).toEqual({positive:0,negative:0,activation:0});
  else {expect(levels.positive>0).toBe(r.raw.appraisals.some((a:any)=>a.congruence>0));expect(levels.negative>0).toBe(r.raw.appraisals.some((a:any)=>a.congruence<0));}
  // A wrong non-zero polarity must not pass merely because the JSON is valid.
  if(decoded.appraisals.length){const bad=structuredClone(decoded);for(const a of bad.appraisals)a.congruence=-Math.abs(a.congruence);
    if(decoded.appraisals.every(a=>a.congruence<0))for(const a of bad.appraisals)a.congruence=Math.abs(a.congruence);
    expect(checkReconnectCandidate(r.item,input,result(bad)).status).toBe('FAIL');
  }
});
it.each(['R09','R10'])('authored %s rejects forced self credit but preserves external or other contribution',id=>{
  const r=fixture.contrasts.find((r:any)=>r.id===id),p=prepareAppraisalProbe(r.request,r.fixedOutcome),decoded=p.decode(r.raw);
  decoded.appraisals[0]!.agency='self';const checked=checkReconnectCandidate(r.item,r.request,result(decoded));
  expect(checked.failures).toContain((id==='R09'?'episode':'input')+'.agency');expect(checked.scopes[id==='R09'?'episode':'input']).toBe('FAIL');
});
it('uncertain contribution can stay unknown without imposing an actor/agency equation',()=>{
  const r=fixture.contrasts.find((r:any)=>r.id==='R09'),p=prepareAppraisalProbe(r.request,r.fixedOutcome),raw=structuredClone(r.raw);
  raw.appraisals[0].agency='unknown';raw.appraisals[0].actorId=null;raw.appraisals[0].targetId=null;
  expect(p.decode(raw).appraisals[0]).toMatchObject({actorId:null,targetId:null,agency:'unknown'});
});
it('adding an unrelated persona leaves the authored relevant observation unchanged and cannot create a new drive',()=>{
  const r=fixture.contrasts.find((r:any)=>r.id==='R02'),input=structuredClone(r.request),before=prepareAppraisalProbe(input,r.fixedOutcome).decode(r.raw);
  const persona=input.sources.find((s:any)=>s.kind==='persona');input.sources.push({...persona,id:'91000000-0000-4000-8000-000000000099',text:'예의를 지키는 것을 중요하게 여긴다.'});
  const decoded=prepareAppraisalProbe(input,r.fixedOutcome).decode(r.raw);expect(decoded).toEqual(before);
  expect(appendEventAffect([],input,decoded,input.eventId).snapshot.levels).toEqual(appendEventAffect([],r.request,before,r.request.eventId).snapshot.levels);
});
