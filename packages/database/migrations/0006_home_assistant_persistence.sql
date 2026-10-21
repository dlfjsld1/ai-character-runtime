-- H1 rows keep their original session-only lifetime.
ALTER TABLE knowledge_documents ADD COLUMN retention text NOT NULL DEFAULT 'session' CHECK(retention IN ('session','persistent'));
CREATE INDEX knowledge_documents_persistent_idx ON knowledge_documents(character_id,identity_id) WHERE retention='persistent' AND deleted_at IS NULL;
CREATE TABLE knowledge_libraries (
 character_id uuid NOT NULL REFERENCES characters(id),
 identity_id uuid NOT NULL REFERENCES identities(id),
 revision bigint NOT NULL DEFAULT 0 CHECK(revision>=0),
 PRIMARY KEY(character_id,identity_id)
);
CREATE TABLE personal_fact_scopes (
 character_id uuid NOT NULL REFERENCES characters(id),
 identity_id uuid NOT NULL REFERENCES identities(id),
 revision bigint NOT NULL DEFAULT 0 CHECK(revision>=0),
 PRIMARY KEY(character_id,identity_id)
);
CREATE TABLE personal_facts (
 id uuid PRIMARY KEY,
 character_id uuid NOT NULL REFERENCES characters(id),
 identity_id uuid NOT NULL REFERENCES identities(id),
 key text NOT NULL CHECK(length(key) BETWEEN 1 AND 80 AND key=btrim(key) AND key=normalize(key,NFKC)),
 value text,
 revision bigint NOT NULL DEFAULT 1 CHECK(revision>0),
 deleted_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(character_id,id),
 CHECK((deleted_at IS NULL AND value IS NOT NULL AND length(value) BETWEEN 1 AND 300) OR (deleted_at IS NOT NULL AND value IS NULL))
);
CREATE UNIQUE INDEX personal_facts_key_uq ON personal_facts(character_id,identity_id,key) WHERE deleted_at IS NULL;
ALTER TABLE response_runs ADD COLUMN personal_context jsonb CHECK(personal_context IS NULL OR jsonb_typeof(personal_context)='object');
ALTER TABLE response_sources ADD COLUMN personal_fact_id uuid;
ALTER TABLE response_sources DROP CONSTRAINT response_sources_one_source;
ALTER TABLE response_sources ADD CONSTRAINT response_sources_one_source CHECK(num_nonnulls(event_id,memory_id,source_response_id,personal_fact_id)=1);
ALTER TABLE response_sources ADD CONSTRAINT response_sources_personal_fact_fk FOREIGN KEY(character_id,personal_fact_id) REFERENCES personal_facts(character_id,id);
CREATE UNIQUE INDEX response_sources_personal_fact_uq ON response_sources(response_id,personal_fact_id) WHERE personal_fact_id IS NOT NULL;
CREATE INDEX response_sources_personal_fact_idx ON response_sources(character_id,personal_fact_id,response_id) WHERE personal_fact_id IS NOT NULL;
