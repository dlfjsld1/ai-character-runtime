import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
import type {DialogueEvaluation} from '../packages/adapters/src/ollama.ts';

const models:Record<string,{think?:false;templateOptions:Record<string,unknown>}>= {
  'qwen2.5:7b':{templateOptions:{}},
  'gemma4:12b-it-qat':{think:false,templateOptions:{enable_thinking:false}},
  'qwen3.5:9b-q4_K_M':{think:false,templateOptions:{enable_thinking:false}},
};
export function dialogueModel(model:string){
  if(!Object.hasOwn(models,model))throw new Error('unsupported_evaluation_model');
  const profile=models[model]!;
  return {evaluation:{model,seed:17,...(profile.think===false?{think:false}:{})} as DialogueEvaluation,templateOptions:{...profile.templateOptions}};
}
export async function tokenizerHashes(path:string){
  const hashes:Record<string,string>={};
  for(const name of ['tokenizer.json','tokenizer_config.json','chat_template.jinja']){
    try{hashes[name]=createHash('sha256').update(await readFile(resolve(path,name))).digest('hex');}
    catch(error){if(name!=='chat_template.jinja'||(error as NodeJS.ErrnoException).code!=='ENOENT')throw error;}
  }
  return hashes;
}
export function evaluationOutputRoot(path:string|undefined,modelSelected:boolean){
  if(modelSelected&&!path)throw new Error('explicit_output_root_required');
  return resolve(path??'validation/runs');
}
