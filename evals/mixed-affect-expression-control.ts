// Evaluation-only preload. Production never imports this module. The fixed
// internal marker is written by the controller directly into its fresh test DB;
// neither chat payloads nor model output can request this intervention.
import {Store} from '../packages/database/src/store.ts';
import {speechStyle} from '../packages/character-core/src/index.ts';
import type {Plan} from '../packages/contracts/src/domain.ts';

if(process.env.MIXED_AFFECT_CONTROL_MODE!=='C6-mask-discomfort')throw Error('explicit_control_preload_required');
const target=new URL(process.env.DATABASE_URL??'');
if(target.hostname!=='127.0.0.1'||target.port!=='55434'||!/^\/character_runtime_mx_20261016_r[1-9]\d*_c6$/.test(target.pathname))throw Error('isolated_control_database_required');
const prototype=Store.prototype as any,original=prototype.response;
if(typeof original!=='function'||typeof speechStyle!=='function')throw Error('control_contract_missing');
prototype.response=async function(this:Store,c:any,s:any,sessionId:string,trigger:any,plan:Plan,...rest:any[]){
 const marker=await c.query("SELECT id FROM events WHERE character_id=$1 AND session_id=$2 AND source_namespace='eval:mixed-affect-expression-v1' AND source_key='C6:mask-discomfort' AND kind='eval.expression-intent' AND data_status='active' AND attention_status='observed' AND identity_id=$3",[this.characterId,sessionId,plan.targetIdentityId]);
 if(marker.rowCount===1){
  // This changes the outward plan before response persistence, never affect,
  // participation, content, provider results, source dependencies or ACKs.
  plan.speechStyle=speechStyle(s.body,plan.targetIdentityId,{joy:'show',discomfort:'mask'});
 }
 return original.call(this,c,s,sessionId,trigger,plan,...rest);
};
