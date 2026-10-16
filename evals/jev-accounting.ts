import type {JevCall} from '../packages/adapters/src/jev.ts';

// Quality and Stage runners account at the same provider call boundary.
export function summarizeJevCalls(calls:readonly JevCall[]){
 const knownInputTokens=calls.reduce((sum,call)=>sum+(call.usage?.input_tokens??0),0);
 const unknownUsageCalls=calls.filter(call=>call.usageStatus==='unknown').length;
 const estimatedKnownCostUsd=knownInputTokens*0.042/1e6;
 return {attemptedCalls:calls.length,validEvaluations:calls.filter(call=>call.errorCode===null&&!call.observationError).length,observationFailures:calls.filter(call=>call.observationError).length,knownInputTokens,unknownUsageCalls,estimatedKnownCostUsd,
  inputTokens:knownInputTokens,estimatedCostUsd:estimatedKnownCostUsd,costEstimateComplete:unknownUsageCalls===0,accountBillingVerified:false};
}
