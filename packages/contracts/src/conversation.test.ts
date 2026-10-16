import {it,expect} from 'vitest';
import {randomUUID} from 'node:crypto';
import {budgetConversation,budgetAppraisalConversation,conversationSnapshotSchema,conversationMessages,dropOldestExchange,isConversationSuffix,type ConversationSnapshot} from './conversation.ts';
const snapshot=(size=4):ConversationSnapshot=>({version:1,sessionId:randomUUID(),identityId:randomUUID(),cutoffEventId:randomUUID(),truncated:false,turns:Array.from({length:size},(_,i)=>[{role:'user' as const,text:'가'.repeat(100),source:{kind:'event' as const,id:randomUUID(),revision:'1'},order:String(i+1)},{role:'assistant' as const,text:'대답이야.',source:{kind:'response' as const,id:randomUUID(),generationEpoch:'0'},order:String(i+1)}]).flat()});
it('appraisal history uses a local UTF-8 byte bound and keeps whole exchanges without changing the source',()=>{
 const s=snapshot();for(const t of s.turns)if(t.role==='user')t.text='가'.repeat(1000);
 const copy=structuredClone(s),bounded=budgetAppraisalConversation(s);
 expect(s).toEqual(copy);expect(bounded.turns).toEqual(s.turns.slice(4));expect(isConversationSuffix(s,bounded)).toBe(true);
 expect(new TextEncoder().encode(JSON.stringify(conversationMessages(bounded))).length).toBeLessThanOrEqual(8192);
 expect(budgetAppraisalConversation(snapshot(1))).toEqual(expect.objectContaining({truncated:false}));
});
it('CR02: anonymous model history contains roles/text and no source IDs',()=>{const s=snapshot();const m=conversationMessages(s);expect(m[0]).toEqual({role:'user',content:'가'.repeat(100)});expect(JSON.stringify(m).includes(s.turns[0].source.id)).toBe(false);});
it('CR02: overflow drops complete oldest exchanges and preserves order',async()=>{const s=snapshot();const count=async(t:string)=>JSON.parse(t).length*100;const trimmed=await budgetConversation(s,count);expect(trimmed.turns).toEqual(s.turns.slice(2));expect(trimmed.truncated).toBe(true);expect(s.turns).toHaveLength(8);expect(conversationSnapshotSchema.safeParse(trimmed).success).toBe(true);});
it('CR02: exactly768 is retained;769 is removed without text truncation',async()=>{const s=snapshot(1);expect((await budgetConversation(s,async()=>768)).turns).toHaveLength(2);expect((await budgetConversation(s,async()=>769)).turns).toHaveLength(0);});
it('A02-2/4: silent user exchanges and reordered object keys preserve strict suffix boundaries',()=>{
 const original=snapshot(2);original.turns.splice(1,1);const smaller=dropOldestExchange(original);expect(smaller.turns).toEqual(original.turns.slice(1));expect(isConversationSuffix(original,smaller)).toBe(true);
 expect(isConversationSuffix(original,{...original,turns:original.turns.slice(0,1),truncated:true})).toBe(false);expect(isConversationSuffix(original,{...original,truncated:true})).toBe(false);
 const reordered={...original,turns:original.turns.map(({text,...turn})=>({...turn,text}))};expect(isConversationSuffix(reordered,original)).toBe(true);
});
it('CR01/02: rejects duplicate/current/role-invalid/future-order source snapshots',()=>{for(const mutate of [(s:ConversationSnapshot)=>s.turns[0].source.id=s.cutoffEventId,(s:ConversationSnapshot)=>s.turns[1].source.id=s.turns[0].source.id,(s:ConversationSnapshot)=>s.turns[1].order='2',(s:ConversationSnapshot)=>s.turns.reverse()]){const s=snapshot();mutate(s);expect(conversationSnapshotSchema.safeParse(s).success).toBe(false);}expect(conversationSnapshotSchema.safeParse(snapshot(5)).success).toBe(false);});
