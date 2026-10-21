import {createHash} from 'node:crypto';
import {z} from 'zod';
import {validateAffectRequest,validateEventInterpretation,type AffectLevels,type EventAppraisal,type EventInterpretationRequest,type EventInterpretationResult} from '../packages/contracts/src/affect-appraisal.ts';
import {appendEventAffect,eventAffectPolicy} from '../packages/character-core/src/event-affect.ts';

export const affectEvaluationVersion='affect-evaluation-v3' as const;
export const affectEvaluationScope='outcome_episode_input' as const;
const appraisalExpectedSchema=z.object({
  presence:z.enum(['required','optional','forbidden']),
  polarity:z.array(z.enum(['positive','negative','mixed','none'])).min(1),
  agency:z.array(z.enum(['self','other','external','unknown'])).optional(),
  actor:z.enum(['speaker','other']).optional(),expectationRequired:z.boolean().optional(),
}).strict();
const expectedSchema=z.object({
  status:z.array(z.enum(['appraised','irrelevant','uncertain'])).min(1),
  outcome:z.object({episode:z.number().int().nonnegative(),use:z.enum(['used','not_used','hypothetical','unknown']),
    result:z.array(z.enum(['favorable','unfavorable','mixed','pending','unknown'])).min(1)}).strict().nullable(),
  episode:appraisalExpectedSchema,input:appraisalExpectedSchema,notes:z.string().min(1),
}).strict();
export const affectCaseSchema=z.object({
  id:z.string().min(1),family:z.string().min(1),pair:z.string().optional(),
  route:z.enum(['outcome','value']),clarity:z.enum(['clear','abstain']),persona:z.string().min(1),
  goal:z.string().min(1).optional(),input:z.string().min(1),episodes:z.array(z.string().min(1)).max(5).optional(),
  history:z.array(z.object({kind:z.enum(['input','expectation','response','claim']),text:z.string().min(1),
    speaker:z.enum(['speaker','other','character']).nullable().optional(),truth:z.enum(['supported','contradicted','unresolved']).optional()}).strict()).max(20).optional(),
  search:z.enum(['found','empty','ambiguous','stale','unavailable']).optional(),truncated:z.boolean().optional(),expected:expectedSchema,
}).strict();
export type AffectCase=z.infer<typeof affectCaseSchema>;
export const affectSuiteSchema=z.object({
  version:z.literal('affect-v3-dev1'),evaluationVersion:z.literal(affectEvaluationVersion),evaluationScope:z.literal(affectEvaluationScope),
  split:z.enum(['dev','confirm']),syntheticOnly:z.literal(true),
  personas:z.record(z.string(),z.string().min(1)),cases:z.array(affectCaseSchema),
  contrasts:z.array(z.object({id:z.string().min(1),base:z.string().min(1),
    change:z.enum(['replace_persona','append_unrelated_persona']),text:z.string().min(1),
    expected:expectedSchema}).strict()),
}).strict();
export type AffectSuite=z.infer<typeof affectSuiteSchema>;

// Opaque host identifiers are based on slot, never the answer, family or trait.
const uuid=(slot:number)=>`91000000-0000-4000-8000-${String(slot).padStart(12,'0')}`;
const now=1700000000000,scope={ownerId:uuid(1),characterId:uuid(2)};
export function materializeAffectCase(suite:AffectSuite,item:AffectCase):EventInterpretationRequest{
  const persona=suite.personas[item.persona];if(!persona)throw new Error('fixture_persona_missing');
  const input:EventInterpretationRequest={scope:{...scope},eventId:uuid(10),eventRevision:'1',configVersion:'1',eventKind:item.route==='outcome'?'reported_outcome':'input',now,
    sources:[],speakerId:uuid(1),actors:[{id:uuid(1),label:'사용자'},{id:uuid(2),label:'캐릭터'},{id:uuid(3),label:'민수'}],
    experience:{status:item.search??(item.episodes?.length?'found':'empty'),revision:'1',truncated:item.truncated??false},
    currentAffect:{positive:0,negative:0,activation:0},stateSourceRefs:[]};
  const add=(id:number,kind:EventInterpretationRequest['sources'][number]['kind'],text:string,at:number,speakerId:string|null,truth:'supported'|'contradicted'|'unresolved'='unresolved')=>input.sources.push({id:uuid(id),revision:'1',kind,scope:{...scope},text,at,speakerId,truth,delivered:kind==='episode'||kind==='response'});
  add(10,'input',item.input,now,uuid(1));add(11,'persona',persona,now-60000,null);
  if(item.goal)add(12,'goal',item.goal,now-60000,null);
  for(const [i,text] of (item.episodes??[]).entries())add(20+i,'episode',text,now-50000+i*1000,uuid(2));
  for(const [i,entry] of (item.history??[]).entries()){
    const speaker=entry.speaker===undefined?(entry.kind==='input'?'speaker':entry.kind==='response'?'character':null):entry.speaker;
    add(30+i,entry.kind,entry.text,now-30000+i*1000,speaker===null?null:uuid(speaker==='speaker'?1:speaker==='character'?2:3),entry.truth);
  }
  return validateAffectRequest(input);
}
export function materializeContrast(suite:AffectSuite,contrast:AffectSuite['contrasts'][number]){
  const base=suite.cases.find(c=>c.id===contrast.base);if(!base)throw new Error('contrast_base_missing');
  const text=contrast.change==='replace_persona'?contrast.text:`${suite.personas[base.persona]} ${contrast.text}`;
  const item={...base,id:contrast.id,expected:contrast.expected};
  return {item,request:materializeAffectCase({...suite,personas:{...suite.personas,[base.persona]:text}},item)};
}
export function validateAffectSuites(rawDev:unknown,rawConfirm:unknown){
  const dev=affectSuiteSchema.parse(rawDev),confirm=affectSuiteSchema.parse(rawConfirm);
  if(dev.split!=='dev'||confirm.split!=='confirm'||dev.version!==confirm.version)throw new Error('fixture_split_version');
  const allIds=new Set<string>();
  for(const suite of [dev,confirm]){
    if(suite.cases.length!==24)throw new Error('fixture_count');
    for(const route of ['outcome','value'])for(const clarity of ['clear','abstain']){
      if(suite.cases.filter(c=>c.route===route&&c.clarity===clarity).length!==(clarity==='clear'?8:4))throw new Error('fixture_balance');
    }
    const families=new Set(suite.cases.filter(c=>c.route==='value').map(c=>c.persona));
    if(families.size<3||[...families].some(f=>suite.cases.filter(c=>c.route==='value'&&c.persona===f).length>4))throw new Error('fixture_persona_concentration');
    const pairs=new Set(suite.cases.flatMap(c=>c.pair?[c.pair]:[]));
    if(pairs.size<3||[...pairs].some(p=>suite.cases.filter(c=>c.pair===p).length<2))throw new Error('fixture_pairs');
    if(!suite.contrasts.some(c=>c.change==='replace_persona')||!suite.contrasts.some(c=>c.change==='append_unrelated_persona'))throw new Error('fixture_persona_contrasts');
    for(const item of [...suite.cases,...suite.contrasts]){if(allIds.has(item.id))throw new Error('fixture_duplicate_id');allIds.add(item.id);}
    for(const item of suite.cases){
      materializeAffectCase(suite,item);
      if(item.expected.outcome&&!item.episodes?.[item.expected.outcome.episode])throw new Error('fixture_expected_episode');
    }
    for(const contrast of suite.contrasts)materializeContrast(suite,contrast);
  }
  const devStories=new Set(dev.cases.map(c=>c.family)),devTraits=new Set(dev.cases.filter(c=>c.route==='value').map(c=>c.persona));
  if(confirm.cases.some(c=>devStories.has(c.family)))throw new Error('fixture_story_leak');
  const unseen=confirm.cases.filter(c=>c.route==='value'&&!devTraits.has(c.persona));
  if(unseen.length<8||new Set(unseen.map(c=>c.persona)).size<2)throw new Error('fixture_persona_leak');
  // Naming disjointness is only a mechanical check. Semantic separation is
  // reviewed by the author and is not proof of an independent held-out sample.
  return {dev,confirm};
}
export const affectHash=(value:unknown)=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
export const affectDevRequestHash=(rows:readonly {group:string;kind:string;body:object}[])=>affectHash(rows
  .filter(row=>['dev','dev_contrast','annotation_dev'].includes(row.group))
  .map(({kind,body})=>JSON.stringify({kind,body})).sort());

export function checkAffectCandidate(item:AffectCase,request:EventInterpretationRequest,result:EventInterpretationResult){
  const failures:string[]=[];
  // Add context to the frozen agency verdict; never regrade it or drop the
  // offending appraisal. An isolated Core drive is not the effect of agency
  // itself (Core does not use agency), nor a prediction of Store/Stage behavior.
  const agencyImpact={version:'agency-impact-v1' as const,policyVersion:eventAffectPolicy.version,findings:[] as {
    scope:'episode'|'input';appraisalIndex:number;agency:EventAppraisal['agency'];
    impact:'current_drive'|'no_current_drive';isolatedLevels:AffectLevels;
  }[]};
  const notEvaluated={outcome:'NOT_EVALUATED',episode:'NOT_EVALUATED',input:'NOT_EVALUATED'} as const;
  const metadata={evaluationVersion:affectEvaluationVersion,evaluationScope:affectEvaluationScope,semanticReview:'pending' as const,agencyImpact};
  if(result.status==='unavailable')return {...metadata,status:'FAIL' as const,failures:[result.reason],scopes:notEvaluated};
  try{validateEventInterpretation(result.interpretation,request);}catch{
    return {...metadata,status:'FAIL' as const,failures:['contract'],scopes:notEvaluated};
  }
  const meaning=result.interpretation,expected=item.expected;
  if(!expected.status.includes(meaning.status))failures.push('status');
  const outcomeFailures:string[]=[];
  if(expected.outcome===null){
    if(meaning.outcome!==null)outcomeFailures.push('unexpected');
  }else if(meaning.outcome===null){
    outcomeFailures.push('missing');
  }else{
    const episode=request.sources.filter(s=>s.kind==='episode')[expected.outcome.episode]?.id;
    if(meaning.outcome.episodeId!==episode)outcomeFailures.push('episode');
    if(meaning.outcome.use!==expected.outcome.use)outcomeFailures.push('use');
    if(!expected.outcome.result.includes(meaning.outcome.result))outcomeFailures.push('result');
  }
  const checkAppraisals=(scope:'episode'|'input',appraisals:EventAppraisal[])=>{
    const rule=expected[scope],issues:string[]=[];
    if(rule.presence==='required'&&!appraisals.length)issues.push('missing');
    if(rule.presence==='forbidden'&&appraisals.length)issues.push('unexpected');
    const axes=appraisals.filter(a=>a.relevance*a.importance*a.certainty>0),positive=axes.some(a=>a.congruence>0),negative=axes.some(a=>a.congruence<0);
    const polarity=positive?(negative?'mixed':'positive'):(negative?'negative':'none');
    if(!rule.polarity.includes(polarity))issues.push('polarity');
    if(rule.actor&&appraisals.some(a=>a.actorId!==(rule.actor==='speaker'?request.speakerId:uuid(3))))issues.push('actor');
    const mismatches=rule.agency?appraisals.filter(a=>!rule.agency!.includes(a.agency)):[];
    if(mismatches.length)issues.push('agency');
    for(const appraisal of mismatches){
      const isolatedLevels=appendEventAffect([],request,{...meaning,status:'appraised',appraisals:[appraisal]},request.eventId).snapshot.levels;
      agencyImpact.findings.push({scope,appraisalIndex:meaning.appraisals.indexOf(appraisal),agency:appraisal.agency,
        impact:Object.values(isolatedLevels).some(value=>value>0)?'current_drive':'no_current_drive',isolatedLevels});
    }
    if(rule.expectationRequired===true&&!appraisals.some(a=>a.expectation!==null))issues.push('expectation_missing');
    if(rule.expectationRequired===false&&appraisals.some(a=>a.expectation!==null))issues.push('invented_expectation');
    return issues;
  };
  const episodeFailures=checkAppraisals('episode',meaning.appraisals.filter(a=>a.episodeId!==null));
  const inputFailures=checkAppraisals('input',meaning.appraisals.filter(a=>a.episodeId===null));
  for(const [scope,issues] of [['outcome',outcomeFailures],['episode',episodeFailures],['input',inputFailures]] as const)failures.push(...issues.map(issue=>`${scope}.${issue}`));
  const scopeStatus=(issues:string[])=>issues.length?'FAIL' as const:'REVIEW_REQUIRED' as const;
  return {...metadata,status:failures.length?'FAIL' as const:'REVIEW_REQUIRED' as const,failures,
    scopes:{outcome:scopeStatus(outcomeFailures),episode:scopeStatus(episodeFailures),input:scopeStatus(inputFailures)}};
}
