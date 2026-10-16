// Offline hypothesis only. No Appraisal mutation, Store writes or provider calls.
import {JEV_THRESHOLD,type JevEvaluation} from '../packages/adapters/src/jev.ts';
export function conservativePraiseDiagnostic(evaluation:JevEvaluation){
  const a=evaluation.appraisal,raw=evaluation.metadata.providerResult.answers;
  if(a.target!=='character'||a.act!=='praise')return {strength:0,reason:'not_direct_praise'};
  if(!a.uncertain)return {strength:a.strength,reason:'already_confident_unchanged'};
  for(const key of ['target','act','goal_relation','hostility'] as const){
    const answer=raw[key],values=Object.values(answer.probabilities),max=Math.max(...values);
    if(answer.confidence<JEV_THRESHOLD||values.filter(p=>p===max).length!==1)return {strength:0,reason:`${key}_unresolved`};
  }
  const hostile=raw.hostility.probabilities;
  if(hostile['0']!==Math.max(...Object.values(hostile)))return {strength:0,reason:'hostility_not_zero'};
  // Treating a returned distribution as ordinal probability mass is a proposed
  // policy, not equivalence to the provider's confidence nor calibrated evidence.
  // Conservative bound: highest level supported by at least 95% tail mass.
  // Normalize observed two-decimal rounding so 1.01 total cannot inflate support.
  const p=raw.strength.probabilities,total=Object.values(p).reduce((sum,value)=>sum+value,0);
  for(let level=3;level>=1;level--){
    const mass=Object.entries(p).reduce((sum,[key,value])=>sum+(Number(key)>=level?value:0),0)/total;
    if(mass>=.95)return {strength:level,reason:'proposed_lower_bound'};
  }
  return {strength:0,reason:'positive_intensity_unresolved'};
}
