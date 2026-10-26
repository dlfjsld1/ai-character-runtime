import { existsSync,readFileSync } from 'node:fs';
import { resolve } from 'node:path';
export function loadLocalEnv() {
  for(const file of [resolve('.env'),resolve('runtime-data/jev.env'),resolve('runtime-data/local.env'),resolve('runtime-data/dialogue-api.env'),resolve('runtime-data/deepseek.env'),resolve('runtime-data/claude.env')]) if(existsSync(file)) process.loadEnvFile(file);
  const ai=resolve('runtime-data/ai-local.json');if(existsSync(ai)){
    const defaults=JSON.parse(readFileSync(ai,'utf8'));
    for(const key of ['DIALOGUE_MODEL','DIALOGUE_TOKENIZER_PATH','OLLAMA_BASE_URL','QWEN_TOKENIZER_PATH','TOKENIZER_PYTHON','OMNIVOICE_MODEL_PATH','STT_PYTHON','STT_MODEL_PATH']){
      // A stored tokenizer belongs to the stored model, not an explicit model override.
      if(key==='DIALOGUE_TOKENIZER_PATH'&&process.env.DIALOGUE_MODEL!==defaults.DIALOGUE_MODEL)continue;
      if(!process.env[key]&&typeof defaults[key]==='string')process.env[key]=defaults[key];
    }
  }
}

