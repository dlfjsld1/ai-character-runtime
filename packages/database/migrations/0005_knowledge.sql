-- H1 documents have their own lifecycle; they are not character memories.
ALTER TABLE sessions ADD COLUMN knowledge_revision bigint NOT NULL DEFAULT 0 CHECK(knowledge_revision>=0);
ALTER TABLE response_runs ADD COLUMN knowledge_context jsonb CHECK(knowledge_context IS NULL OR jsonb_typeof(knowledge_context)='object');
CREATE TABLE knowledge_documents (
 id uuid PRIMARY KEY,
 character_id uuid NOT NULL,
 session_id uuid NOT NULL,
 identity_id uuid NOT NULL REFERENCES identities(id),
 title text NOT NULL CHECK(length(title) BETWEEN 1 AND 160),
 revision bigint NOT NULL CHECK(revision>0),
 deleted_at timestamptz,
 FOREIGN KEY(character_id,session_id) REFERENCES sessions(character_id,id),
 UNIQUE(id,revision)
);
CREATE INDEX knowledge_documents_scope_idx ON knowledge_documents(character_id,session_id,identity_id) WHERE deleted_at IS NULL;
CREATE TABLE knowledge_chunks (
 document_id uuid NOT NULL,
 revision bigint NOT NULL,
 chunk_id text NOT NULL CHECK(length(chunk_id) BETWEEN 1 AND 80),
 ordinal int NOT NULL CHECK(ordinal>=0),
 body text NOT NULL CHECK(length(body) BETWEEN 1 AND 1200),
 PRIMARY KEY(document_id,revision,chunk_id),
 UNIQUE(document_id,revision,ordinal),
 FOREIGN KEY(document_id,revision) REFERENCES knowledge_documents(id,revision) ON DELETE CASCADE
);
