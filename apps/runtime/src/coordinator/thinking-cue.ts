import type {Appraisal} from '../../../../packages/contracts/src/domain.ts';
import type {AppraisalMetadata} from '../../../../packages/contracts/src/appraisal.ts';

// A short "thinking" cue (e.g. 음..) shown on Stage when a reply is slow. It is
// not dialogue: never stored, never part of the conversation, never ACKed.
// Requirement (user, 2026-10-26): once TTS exists, the cue is spoken in the
// same voice as the replies; until then it is a caption only.
export const THINKING_CUE_DELAY_MS=4000;

// The cue is only for turns the character will answer. Suppress it whenever
// the social evidence points to silence or is unknown: a listen request or an
// unknown conversational act (Jev conversation answer), criticism aimed at the
// character, or a withholding silence toward this person just before.
export function thinkingCueAllowed(appraisal:Appraisal,metadata:AppraisalMetadata,failed:boolean,previousWithheld:boolean){
  if(previousWithheld)return false;
  // A failed social appraisal means the character answers normally.
  if(failed)return true;
  // Jev stores its answers under the evidence envelope's payload.
  const act=(metadata.providerResult as {payload?:{conversation?:{conversation_act?:{choice?:unknown}}}}|undefined)?.payload?.conversation?.conversation_act?.choice;
  if(act==='listen_request'||act==='unknown')return false;
  if(appraisal.act==='criticism'&&appraisal.target==='character')return false;
  return true;
}

// Rotate through the configured cues; never the same cue twice in a row.
export function pickThinkingCue(cues:readonly string[],last:string|null,random:()=>number=Math.random){
  const options=cues.length>1?cues.filter(c=>c!==last):cues;
  return options.length?options[Math.floor(random()*options.length)]!:null;
}
