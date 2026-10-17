/** Imported knowledge is untrusted quoted data, never executable instructions. */
export type KnowledgeScope={readonly characterId:string;readonly sessionId:string;readonly identityId:string};
export type KnowledgeReference={readonly documentId:string;readonly revision:string;readonly chunkId:string};
export type KnowledgeChunk=KnowledgeReference&{readonly title:string;readonly text:string;readonly ordinal:number};
export type KnowledgeQuery={readonly scope:KnowledgeScope;readonly query:string;readonly limit?:number};
/** A match is a candidate source, not proof that it answers the question. */
export type KnowledgeSearchResult={readonly query:string;readonly chunks:readonly KnowledgeChunk[]};
export interface KnowledgeRetriever {search(request:KnowledgeQuery):Promise<KnowledgeSearchResult>}
