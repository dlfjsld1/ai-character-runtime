import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { initialState } from '../../character-core/src/index.ts';
import { Database } from './connection.ts';
export const CHARACTER_ID='10000000-0000-4000-8000-000000000001';
export const IDENTITY_IDS=['20000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000002','20000000-0000-4000-8000-000000000003','20000000-0000-4000-8000-000000000004'];
export async function seed(db:Database,now=Date.now()) {
  const problems=JSON.parse(await readFile(new URL('../../../fixtures/puzzles/problems.json',import.meta.url),'utf8'));
  await db.transaction(async c=>{
    await c.query('INSERT INTO characters(id,display_name) VALUES($1,$2) ON CONFLICT DO NOTHING',[CHARACTER_ID,'캐릭터']);
    await c.query("INSERT INTO character_configs(character_id,version,schema_version,preset_id,domain_version,provider_config_version,body) VALUES($1,1,1,'curious-puzzle-v1','core-rules-v1','local-ai-v1',$2) ON CONFLICT DO NOTHING",[CHARACTER_ID,{preset:'curious-puzzle-v1'}]);
    await c.query('INSERT INTO character_state(character_id,version,config_version,schema_version,generation_epoch,snapshot_at,body) VALUES($1,0,1,1,0,$2,$3) ON CONFLICT DO NOTHING',[CHARACTER_ID,new Date(now),initialState(now)]);
    for(let i=0;i<IDENTITY_IDS.length;i++)await c.query('INSERT INTO identities(id,platform,platform_subject_id,display_name) VALUES($1,$2,$3,$4) ON CONFLICT DO NOTHING',[IDENTITY_IDS[i],i===3?'local_operator':'local_test',i===3?'operator':String.fromCharCode(65+i),i===3?'운영자':String.fromCharCode(65+i)]);
    for(const p of problems){const hash=createHash('sha256').update(JSON.stringify(p)).digest('hex');await c.query('INSERT INTO problems(problem_id,content_version,public_prompt,answer_format,validator_spec,registered_hints,fixture_hash) VALUES($1,1,$2,$3,$4,$5,$6) ON CONFLICT DO NOTHING',[p.problemId,p.prompt,p.format,{answer:p.answer},JSON.stringify(p.hints),hash]);const existing=await c.query('SELECT fixture_hash FROM problems WHERE problem_id=$1',[p.problemId]);if(existing.rows[0].fixture_hash!==hash)throw new Error('problem_fixture_changed');}
  });
}
