import { existsSync,readFileSync } from 'node:fs';
import { resolve } from 'node:path';
export function loadLocalEnv() {
  for(const file of [resolve('.env'),resolve('runtime-data/jev.env'),resolve('runtime-data/local.env')]) if(existsSync(file)) process.loadEnvFile(file);
  const ai=resolve('runtime-data/ai-local.json');if(existsSync(ai)){const defaults=JSON.parse(readFileSync(ai,'utf8'));for(const key of ['QWEN_TOKENIZER_PATH','TOKENIZER_PYTHON','OMNIVOICE_MODEL_PATH','STT_PYTHON','STT_MODEL_PATH'])if(!process.env[key]&&typeof defaults[key]==='string')process.env[key]=defaults[key];}
}

