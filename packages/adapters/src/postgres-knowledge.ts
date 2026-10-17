import type {KnowledgeChunk,KnowledgeQuery,KnowledgeRetriever,KnowledgeSearchResult} from '../../contracts/src/knowledge.ts';

export type KnowledgeQueryable={query(sql:string,values?:any[]):Promise<{rows:any[]}>};
const compact=(text:string)=>text.normalize('NFKC').toLocaleLowerCase('ko-KR').replace(/[^\p{L}\p{N}]/gu,'');
const grams=(text:string)=>new Set(Array.from({length:Math.max(0,text.length-1)},(_,i)=>text.slice(i,i+2)));
const terms=(text:string)=>text.normalize('NFKC').toLocaleLowerCase('ko-KR').split(/[^\p{L}\p{N}]+/u)
  .map(term=>term.replace(/(?:에서는|으로는|이라면|에서는|에서|까지|부터|에는|으로|이랑|하고|에게|보다|라는|이야|인가|나요|은|는|을|를|이|가|의|와|과|도)$/u,''))
  .filter(term=>term.length>=2&&!['알려줘','찾아줘','뭐야','얼마나','어떻게','언제','무엇','있어','하나','해야','하는','있나'].includes(term));

/** Bounded Korean lexical baseline. No embeddings, filesystem reads, or external calls. */
export function rankKnowledgeChunks(query:string,chunks:readonly KnowledgeChunk[],limit=5):KnowledgeChunk[]{
  const queryGrams=grams(compact(query)),queryTerms=terms(query);
  if(!queryGrams.size)return [];
  const documents=chunks.map(chunk=>({chunk,title:compact(chunk.title),body:compact(chunk.text)}));
  const frequencies=new Map<string,number>();
  for(const document of documents)for(const gram of grams(document.title+document.body))frequencies.set(gram,(frequencies.get(gram)??0)+1);
  return documents.map(document=>{
    let score=0;
    for(const gram of queryGrams){
      const weight=Math.log(1+(documents.length+.5)/((frequencies.get(gram)??0)+.5));
      if(document.body.includes(gram))score+=weight;
      if(document.title.includes(gram))score+=weight*1.5;
    }
    for(const term of queryTerms){if(document.body.includes(term))score+=2;if(document.title.includes(term))score+=4;}
    return {chunk:document.chunk,score};
  }).filter(item=>item.score>0).sort((a,b)=>b.score-a.score||a.chunk.documentId.localeCompare(b.chunk.documentId)||a.chunk.ordinal-b.chunk.ordinal)
    .slice(0,Math.max(0,Math.min(5,Math.floor(limit)))).map(item=>item.chunk);
}

export class PostgresKnowledgeRetriever implements KnowledgeRetriever {
  constructor(private readonly db:KnowledgeQueryable){}
  async search({scope,query,limit=5}:KnowledgeQuery):Promise<KnowledgeSearchResult>{
    if(typeof query!=='string'||!query.trim()||query.length>2000||!Number.isInteger(limit)||limit<1||limit>5)throw new Error('knowledge_query_invalid');
    if(!scope.characterId||!scope.sessionId||!scope.identityId)throw new Error('knowledge_scope_invalid');
    const result=await this.db.query(`SELECT d.id::text AS document_id,d.revision::text AS revision,d.title,c.chunk_id,c.ordinal,c.body
      FROM sessions s JOIN knowledge_documents d ON d.session_id=s.id AND d.character_id=s.character_id
      JOIN knowledge_chunks c ON c.document_id=d.id AND c.revision=d.revision
      WHERE s.id=$1 AND s.character_id=$2 AND s.status='active' AND d.identity_id=$3 AND d.deleted_at IS NULL
      ORDER BY d.id,c.ordinal LIMIT 501`,[scope.sessionId,scope.characterId,scope.identityId]);
    // Refuse oversized collections instead of silently dropping candidates before ranking.
    if(result.rows.length>500)throw new Error('knowledge_collection_too_large');
    const chunks:KnowledgeChunk[]=result.rows.map(row=>({documentId:row.document_id,revision:String(row.revision),chunkId:row.chunk_id,title:row.title,text:row.body,ordinal:row.ordinal}));
    return {query,chunks:rankKnowledgeChunks(query,chunks,limit)};
  }
}
