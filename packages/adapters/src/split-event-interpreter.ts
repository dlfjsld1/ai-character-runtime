import {isDeepStrictEqual} from 'node:util';
import {RuntimeError} from '../../contracts/src/domain.ts';
import type {EventInterpreter} from '../../contracts/src/ai-ports.ts';
import {validateAffectRequest,validateEventInterpretation,type EventInterpretationRequest,type EventInterpretation,type EventInterpretationResult} from '../../contracts/src/affect-appraisal.ts';

export const SPLIT_EVENT_INTERPRETER_VERSION='split-event-interpretation-v1';
type OutcomeResolver=(request:EventInterpretationRequest)=>Promise<EventInterpretation['outcome']>;
type AppraisalResolver=(request:EventInterpretationRequest,outcome:EventInterpretation['outcome'])=>Promise<EventInterpretation>;

export class SplitEventInterpreter implements EventInterpreter{
  readonly promptVersion=SPLIT_EVENT_INTERPRETER_VERSION;
  constructor(private readonly resolveOutcome:OutcomeResolver,private readonly resolveAppraisal:AppraisalResolver){}
  async interpret(input:EventInterpretationRequest):Promise<EventInterpretationResult>{
    const unavailable=(reason:'invalid_input'|'invalid_output'|'transport_failed'):EventInterpretationResult=>({status:'unavailable',reason,promptVersion:this.promptVersion});
    // A resolver that classified its own failure keeps that class; anything
    // else is reported as a transport failure.
    const failed=(error:unknown)=>{const code=error instanceof RuntimeError?error.code:'';return unavailable(/invalid_output$/.test(code)?'invalid_output':/invalid_input$/.test(code)?'invalid_input':'transport_failed');};
    let snapshot:EventInterpretationRequest;
    try{snapshot=validateAffectRequest(input);}catch{return unavailable('invalid_input');}
    let rawOutcome:EventInterpretation['outcome'];
    try{rawOutcome=await this.resolveOutcome(structuredClone(snapshot));}catch(error){return failed(error);}
    let fixed:EventInterpretation['outcome'];
    try{fixed=validateEventInterpretation({status:'uncertain',outcome:rawOutcome,appraisals:[]},snapshot).outcome;}catch{return unavailable('invalid_output');}
    let raw:EventInterpretation;
    try{raw=await this.resolveAppraisal(structuredClone(snapshot),structuredClone(fixed));}catch(error){return failed(error);}
    try{
      const interpretation=validateEventInterpretation(raw,snapshot);
      if(!isDeepStrictEqual(interpretation.outcome,fixed))return unavailable('invalid_output');
      return {status:'interpreted',interpretation,promptVersion:this.promptVersion};
    }catch{return unavailable('invalid_output');}
  }
}
