import {z} from 'zod';
import {affectCaseSchema,materializeAffectCase,type AffectSuite} from './affect-cases.ts';

const diagnosticSchema=z.object({
  version:z.literal('affect-diagnostic-v1'),syntheticOnly:z.literal(true),
  purpose:z.literal('provider_candidate_diagnostic_not_product_gate'),
  inherited:z.array(z.string().min(1)).length(6),additional:z.array(affectCaseSchema).length(2),
}).strict();
// Common inputs and rubrics, independent of provider and wire protocol.
export function materializeAffectDiagnostic(suite:AffectSuite,raw:unknown){
  const fixture=diagnosticSchema.parse(raw);
  const inherited=fixture.inherited.map(id=>{
    const item=suite.cases.find(item=>item.id===id);if(!item)throw new Error('diagnostic_case_missing');return item;
  });
  const cases=[...inherited,...fixture.additional];
  if(new Set(cases.map(item=>item.id)).size!==8)throw new Error('diagnostic_duplicate_id');
  return cases.map(item=>({item,request:materializeAffectCase(suite,item)}));
}
