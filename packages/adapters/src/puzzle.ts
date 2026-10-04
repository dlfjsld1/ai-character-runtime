import { RuntimeError } from '../../contracts/src/domain.ts';
export function normalizeAnswer(answer:string,format:{type:string;choices?:string[]}):string {
  const raw=answer.trim();
  if(format.type==='integer') {if(!/^-?\d+$/.test(raw))throw new RuntimeError('invalid_candidate',400);return BigInt(raw).toString();}
  if(format.type==='choice'){const value=raw.toUpperCase();if(!format.choices?.includes(value))throw new RuntimeError('invalid_candidate',400);return value;}
  if(format.type==='pair'){if(!/^\d+\s*,\s*\d+$/.test(raw))throw new RuntimeError('invalid_candidate',400);return raw.split(',').map(s=>BigInt(s.trim()).toString()).join(',');}
  throw new RuntimeError('unsupported_problem',400);
}
export function judge(answer:string,format:{type:string;choices?:string[]},validator:{answer:string}):'correct'|'incorrect' {
  return normalizeAnswer(answer,format)===normalizeAnswer(validator.answer,format)?'correct':'incorrect';
}
