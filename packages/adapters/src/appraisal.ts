import type { AppraisalEvaluation } from '../../contracts/src/appraisal.ts';

export type AppraisalEvent = {id:string;text:string;identityId:string};
export type AppraisalReadiness = {status:'blocked'|'configured'|'ready'|'unavailable';inferenceVerified:boolean;errorCode:string|null};
export interface AppraisalProvider {
  readonly name:string;
  readonly model:string;
  readonly promptVersion:string;
  readiness():AppraisalReadiness;
  evaluate(event:AppraisalEvent,context:object):Promise<AppraisalEvaluation>;
}
