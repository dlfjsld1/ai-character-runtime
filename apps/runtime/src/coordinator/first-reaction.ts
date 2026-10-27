import type {Appraisal,Plan} from '../../../../packages/contracts/src/domain.ts';
import type {AppraisalMetadata} from '../../../../packages/contracts/src/appraisal.ts';
import type {ReactionStyle} from '../../../../packages/contracts/src/first-reaction.ts';

// A first reaction is said right away, before the reply. Like the thinking cue
// it is withheld where the character may stay silent, but unlike the cue it is
// allowed for criticism (a correction gets "앗, 그래?"): only a certain hostile
// attack, a listen request, an unknown conversational act or a recent
// withholding silence block it. Requirement: once TTS exists it is spoken.
export function firstReactionAllowed(appraisal:Appraisal,metadata:AppraisalMetadata,failed:boolean,previousWithheld:boolean){
  if(previousWithheld)return false;
  if(failed)return true;
  const act=(metadata.providerResult as {payload?:{conversation?:{conversation_act?:{choice?:unknown}}}}|undefined)?.payload?.conversation?.conversation_act?.choice;
  if(act==='listen_request'||act==='unknown')return false;
  if(!appraisal.uncertain&&appraisal.target==='character'&&appraisal.act==='criticism'&&appraisal.hostility===3)return false;
  return true;
}
// Register and allowed tones come from the plan the core would build from the
// state before this turn (the reaction precedes this turn's appraisal). The
// line answers the situation, so a calm state allows any tone; concealment
// allows only neutral lines; a lingering embarrassment or discomfort allows
// that tone or neutral, never a cheerful line.
export function reactionStyle(plan:Plan):ReactionStyle{
  const register=plan.speechStyle?.register==='formal'?'formal':'casual';
  if(plan.speechStyle?.concealAffect)return {register,tones:['neutral']};
  if(plan.expression==='embarrassed'||plan.expression==='uncomfortable')return {register,tones:[plan.expression,'neutral']};
  if(plan.expression==='happy')return {register,tones:['happy','neutral','embarrassed']};
  return {register,tones:['neutral','happy','embarrassed','uncomfortable']};
}
