// Pure appraisal/state projection API. Host adapters own semantic inference,
// storage, source validity, permissions and output delivery.
export {appendEventAffect,projectEventAffect,removeEventAffectSources,eventAffectStimuli,eventAffectPolicy,eventAffectPolicySchema} from './event-affect.ts';
export type {EventAffectPolicy} from './event-affect.ts';
export type {AffectLevels,AffectQuote,AffectSource,PersonaValue,EventAppraisal,EventInterpretation,EventInterpretationRequest,EventInterpretationResult,EventAffectRecord,EventAffectSnapshot,EmotionContribution} from '../../contracts/src/affect-appraisal.ts';
