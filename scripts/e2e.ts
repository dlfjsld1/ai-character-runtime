// Runs each browser spec against its own fresh fixture server (one-time Studio
// code, fresh test DB), with the server mode that spec needs.
import {readdirSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
const modes:Record<string,Record<string,string>>={'persistence.spec.ts':{TEST_IDENTITY_MODE:'operator'},'thinking-cue.spec.ts':{TEST_DIALOGUE_DELAY_MS:'7000'}};
let failed=0;
for(const file of readdirSync('evals/browser').filter(f=>f.endsWith('.spec.ts')).sort()){
  console.log(`\n== ${file}`);
  const r=spawnSync('npx',['playwright','test',`evals/browser/${file}`,...process.argv.slice(2)],{stdio:'inherit',shell:true,env:{...process.env,...(modes[file]??{})}});
  if(r.status!==0)failed++;
}
if(failed){console.error(`\n${failed} browser spec file(s) failed`);process.exit(1);}
