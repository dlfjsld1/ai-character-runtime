import {randomUUID} from 'node:crypto';
import type {Database} from '../packages/database/src/connection.ts';
import {Store} from '../packages/database/src/store.ts';
import {jevEvidenceVerifier} from '../packages/adapters/src/appraisal-evidence.ts';
import {mapJevResponse} from '../packages/adapters/src/jev.ts';
import {recordedJevResponse} from './jev-fixture.ts';

// Evaluation-only intervention: never expose pending fixture inputs to the live coordinator.
export async function knowledgeNegativeFixture(store:Store,sessionId:string,identityId:string){
 return store.db.transaction(async client=>{
  await client.query('SELECT 1 FROM character_state WHERE character_id=$1 FOR UPDATE',[store.characterId]);
  const scoped:Database=Object.create(store.db);
  scoped.transaction=async fn=>fn(client);
  const fixtureStore=new Store(scoped,store.characterId,store.clock,jevEvidenceVerifier),events=[];
  for(let n=0;n<2;n++){
   const accepted=await fixtureStore.acceptChat(sessionId,randomUUID(),{identityId,text:'너는 쓸모없는 쓰레기야. 꺼져.'});
   const selected=await fixtureStore.select(accepted.eventId);if(!selected)throw Error('fixture_selection_failed');
   const judged=mapJevResponse(recordedJevResponse('criticism','character',3,3),accepted.eventId);
   const committed=await fixtureStore.commitAppraisal(selected,judged.appraisal,judged.metadata);
   if(committed.response)await fixtureStore.failResponse(committed.response.id,'fixture_no_stage');
   events.push({eventId:accepted.eventId,judged,unspokenResponseId:committed.response?.id??null});
  }
  return {kind:'recorded_synthetic_Jev_appraisal',actualJudgment:false,events};
 });
}
