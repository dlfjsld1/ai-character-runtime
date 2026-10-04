import { parseConfig } from '../packages/contracts/src/local-config.ts';
import { JevAppraisalProvider } from '../packages/adapters/src/jev.ts';
// CLI guard prevents accidental transmission; it does not replace human approval.
export function approvedSyntheticJev() {
  if(!process.argv.includes('--synthetic-inputs')||!process.argv.includes('--allow-jev-api'))throw new Error('explicit_synthetic_jev_api_flags_required');
  const index=process.argv.indexOf('--max-cost-usd'),budget=Number(index>=0?process.argv[index+1]:NaN);
  if(!Number.isFinite(budget)||budget<=0)throw new Error('explicit_jev_cost_budget_required');
  const config=parseConfig(process.env),provider=new JevAppraisalProvider({localOnly:config.LOCAL_ONLY,allowPaidProviders:config.ALLOW_PAID_PROVIDERS,apiKey:config.TYPESAFE_API_KEY});
  if(provider.readiness().status==='blocked')throw new Error(provider.readiness().errorCode!);
  return {provider,budget};
}
