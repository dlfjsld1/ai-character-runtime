// Explicit mock transport exercises the real Jev parser. Never used by normal runtime.
import { JevAppraisalProvider,JEV_MODEL,SCORE_LEVELS } from '../packages/adapters/src/jev.ts';
import type { AppraisalProvider } from '../packages/adapters/src/appraisal.ts';
export function recordedJevResponse(act='question',target='character',strength=0,hostility=0,confidence=0.95){
  const choice=(value:string,keys:string[])=>({type:'choice',choice:value,confidence,probabilities:Object.fromEntries(keys.map(k=>[k,k===value?1:0]))});
  const score=(value:number,levels:string[])=>({type:'score',score:value,confidence,probabilities:Object.fromEntries(levels.map((_,i)=>[String(i),i===value?1:0])),legend:Object.fromEntries(levels.map((label,i)=>[String(i),label]))});
  return {model:JEV_MODEL,answers:{target:choice(target,['character','activity','other','quoted','unknown']),act:choice(act,['greeting','question','praise','criticism','teasing','hint','help_offer','decline','other','unknown']),goal_relation:choice('unrelated',['helps','blocks','unrelated','unknown']),strength:score(strength,SCORE_LEVELS.strength),hostility:score(hostility,SCORE_LEVELS.hostility)},usage:{input_tokens:123,output_tokens:0}};
}
export function mockJevAppraiser():AppraisalProvider {
  const parser=new JevAppraisalProvider({localOnly:false,allowPaidProviders:true,apiKey:'synthetic-mock-key'},async(_url,options)=>{
    const state=JSON.parse(String(options?.body)).state;
    const act=state.utterance.includes('칭찬')?'praise':state.utterance.includes('안녕')?'greeting':'question';
    return Response.json(recordedJevResponse(act,'character',act==='praise'?3:0));
  });
  return {name:'jev-mock',model:JEV_MODEL,promptVersion:parser.promptVersion,readiness:()=>({status:'configured',inferenceVerified:false,errorCode:null}),evaluate:async(event,context)=>{const result=await parser.evaluate(event,context);return {...result,metadata:{...result.metadata,provider:'jev-mock'}};}};
}
