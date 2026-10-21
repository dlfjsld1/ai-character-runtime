import React,{useEffect,useRef,useState} from 'react';
import {api} from './wire.ts';
import type {PersonalFact,PersonalFactSnapshot} from '../../../packages/contracts/src/personal-facts.ts';

export function PersonalFactsPanel({sessionId}:{sessionId:string}){
 const [facts,setFacts]=useState<PersonalFact[]>([]),[name,setName]=useState(''),[value,setValue]=useState(''),[editing,setEditing]=useState<PersonalFact|null>(null),[saving,setSaving]=useState(false),[loaded,setLoaded]=useState(false),[notice,setNotice]=useState(''),[error,setError]=useState('');
 const alive=useRef(true),version=useRef(0),mutating=useRef(false),retry=useRef<{signature:string;key:string}|null>(null),path=`/api/sessions/${sessionId}/personal-facts`;
 async function refresh(){if(mutating.current)return;const ticket=++version.current;const result:PersonalFactSnapshot=await api(path);if(alive.current&&ticket===version.current){setFacts(result.facts);setLoaded(true);}}
 useEffect(()=>{alive.current=true;void refresh().catch(()=>setError('저장 정보를 불러오지 못했어요. 다시 불러와 주세요.'));return()=>{alive.current=false;version.current++;};},[sessionId]);
 function draft(fact:PersonalFact|null){setEditing(fact);setName(fact?.key??'');setValue(fact?.value??'');setNotice('');setError('');}
 async function change(method:'POST'|'PATCH'|'DELETE',fact?:PersonalFact){
  if(mutating.current)return;mutating.current=true;version.current++;setSaving(true);setNotice('');setError('');
  const url=fact?`${path}/${fact.id}`:path,body=method==='DELETE'?undefined:{key:name,value},signature=JSON.stringify({url,method,body,revision:fact?.revision});
  if(retry.current?.signature!==signature)retry.current={signature,key:crypto.randomUUID()};
  try{
   await api(url,method,body,{'Idempotency-Key':retry.current.key,...(fact?{'If-Match':`"${fact.revision}"`}:{})});
   if(alive.current){if(method!=='DELETE'||editing?.id===fact?.id)draft(null);setNotice(method==='DELETE'?'삭제 요청을 처리했어요.':'저장 요청을 처리했어요.');}retry.current=null;
  }catch(e){if(alive.current){const code=(e as Error).message;setError(code==='personal_fact_revision_conflict'?'다른 변경이 있어 저장하지 못했어요. 최신 목록에서 다시 편집해 주세요.':code==='personal_fact_key_conflict'?'같은 이름의 정보가 있어요. 목록에서 해당 정보를 편집해 주세요.':code==='personal_fact_limit'?'정보는 최대 20개까지 저장할 수 있어요.':'요청 결과를 확인하지 못했어요. 입력을 유지했으니 목록을 확인하고 다시 시도해 주세요.');}}
  finally{mutating.current=false;if(alive.current){setSaving(false);await refresh().catch(()=>setError('목록을 새로 불러오지 못했어요. 다시 불러와 주세요.'));}}
 }
 const valid=[...name.normalize('NFKC').trim()].length>0&&[...name.normalize('NFKC').trim()].length<=80&&[...value.trim()].length>0&&[...value.trim()].length<=300;
 return <section className="personal-facts" aria-label="내가 저장한 정보"><h2>내가 저장한 정보</h2><p className="subtle">직접 저장한 정보만 다음 만남에도 사용해요. 자동으로 추측해 저장하지 않아요. 최대 20개예요.</p>
  <form onSubmit={e=>{e.preventDefault();void change(editing?'PATCH':'POST',editing??undefined);}}>
   <label htmlFor="personal-key">정보 이름</label><input id="personal-key" value={name} onChange={e=>{setName(e.target.value);setNotice('');}} disabled={saving} placeholder="예: 음료 선호" aria-describedby="personal-limits"/>
   <label htmlFor="personal-value">정보 내용</label><textarea id="personal-value" value={value} onChange={e=>{setValue(e.target.value);setNotice('');}} disabled={saving} placeholder="예: 카페인 없는 보리차를 좋아해요" aria-describedby="personal-limits"/>
   <p id="personal-limits" className="subtle">이름 80자, 내용 300자까지 입력할 수 있어요.</p><div className="toolbar"><button disabled={!loaded||saving||!valid||!editing&&facts.length>=20}>{saving?'처리 중…':editing?'정보 수정 저장':'정보 저장'}</button>{editing&&<button type="button" className="secondary" disabled={saving} onClick={()=>draft(null)}>편집 취소</button>}</div>
  </form>
  <p role="status">{notice}</p>{error&&<p role="alert" className="error">{error}</p>}<button className="secondary" disabled={saving} onClick={()=>void refresh().then(()=>setError('')).catch(()=>setError('목록을 불러오지 못했어요.'))}>저장 정보 다시 불러오기</button>
  <ul className="personal-fact-list">{facts.map(fact=><li key={fact.id}><strong>{fact.key}</strong><p>{fact.value}</p><div className="toolbar"><button className="secondary" disabled={saving} onClick={()=>draft(fact)} aria-label={`${fact.key} 편집`}>정보 편집</button><button className="secondary" disabled={saving} onClick={()=>void change('DELETE',fact)} aria-label={`${fact.key} 삭제`}>정보 삭제</button></div></li>)}</ul>{loaded&&!facts.length&&<p className="subtle">아직 저장한 정보가 없어요.</p>}
 </section>;
}
