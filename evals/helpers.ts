import { loadLocalEnv } from '../scripts/env.ts';
import { Database } from '../packages/database/src/connection.ts';
import { migrate } from '../packages/database/src/migrate.ts';
import { seed,CHARACTER_ID,IDENTITY_IDS } from '../packages/database/src/seed.ts';
import { Store } from '../packages/database/src/store.ts';
import { randomUUID } from 'node:crypto';
import { neutralAppraisal,type Plan } from '../packages/contracts/src/domain.ts';
import type { Provider } from '../packages/adapters/src/ollama.ts';
export { CHARACTER_ID,IDENTITY_IDS };
export { mockJevAppraiser } from './jev-fixture.ts';
export async function testDatabase(){loadLocalEnv();const url=process.env.TEST_DATABASE_URL;if(!url)throw new Error('TEST_DATABASE_URL required; no fallback');const parsed=new URL(url);if(parsed.pathname!=='/character_runtime_test')throw new Error('Explicit dedicated test DB required');const db=new Database(url);const actual=(await db.pool.query('SELECT current_database() AS db')).rows[0].db;if(actual!=='character_runtime_test')throw new Error('test_database_mismatch');await migrate(db);return db;}
export async function reset(db:Database,now=Date.now()){await db.pool.query('TRUNCATE characters,identities,problems CASCADE');await seed(db,now);}
export async function observed(store:Store,sessionId:string,identityId=IDENTITY_IDS[0],act:'greeting'|'praise'|'question'='greeting') {const accepted=await store.acceptChat(sessionId,randomUUID(),{identityId,text:act==='praise'?'잘했어':'안녕'});const selected=await store.select(accepted.eventId);if(!selected)throw new Error('no_selected');const result=await store.commitAppraisal(selected,{...neutralAppraisal,target:'character',act,strength:3,uncertain:false,evidence_refs:[accepted.eventId]},{provider:'synthetic-fixture',model:'recorded-v1'});if(result.response)await store.failResponse(result.response.id,'fixture_no_stage');return accepted.eventId;}
export const fixtureProvider:Provider={name:'synthetic-fixture',model:'recorded-v1',counter:{count:async()=>50,countText:async s=>[...s].length},appraise:async event=>({...neutralAppraisal,target:'character',act:event.text.includes('칭찬')?'praise':'question',strength:3,uncertain:false,evidence_refs:[event.id]}),dialogue:async(plan:Plan)=>[plan.purpose==='resume_puzzle'?'지난번에 남겨 둔 퍼즐, 이어서 해볼까?':plan.purpose==='activity_correct'?'답을 확인했어. 맞았네!':plan.purpose==='request_hint'?'정답 말고 힌트 하나만 줄래?':'안녕. 천천히 같이 알아보자.'],solve:async id=>({activity_id:id,candidate_answer:null,needs_hint:true})};
