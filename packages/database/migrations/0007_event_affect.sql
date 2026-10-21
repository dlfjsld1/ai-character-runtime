-- O2 slice 1: natural-language persona values bound to a config version, and
-- the accepted event-affect interpretation of one input revision per owner.
CREATE TABLE character_persona_values (
 id uuid PRIMARY KEY,
 character_id uuid NOT NULL,
 config_version bigint NOT NULL,
 ordinal int NOT NULL CHECK(ordinal>=0),
 kind text NOT NULL CHECK(kind IN ('persona','goal')),
 text text NOT NULL CHECK(length(text) BETWEEN 1 AND 2000),
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(character_id,config_version,ordinal),
 FOREIGN KEY(character_id,config_version) REFERENCES character_configs(character_id,version)
);
CREATE TABLE affective_appraisals (
 id uuid PRIMARY KEY,
 character_id uuid NOT NULL,
 owner_id uuid NOT NULL REFERENCES identities(id),
 event_id uuid NOT NULL,
 event_revision bigint NOT NULL CHECK(event_revision>0),
 config_version bigint NOT NULL,
 policy_version text NOT NULL,
 prompt_version text NOT NULL,
 status text NOT NULL CHECK(status IN ('active','deleted')),
 record jsonb,
 stimuli jsonb,
 latency_ms int CHECK(latency_ms>=0),
 created_at timestamptz NOT NULL DEFAULT now(),
 deleted_at timestamptz,
 UNIQUE(character_id,event_id,event_revision),
 FOREIGN KEY(character_id,event_id) REFERENCES events(character_id,id),
 FOREIGN KEY(character_id,config_version) REFERENCES character_configs(character_id,version),
 CHECK((status='active' AND record IS NOT NULL AND jsonb_typeof(record)='object' AND deleted_at IS NULL) OR (status='deleted' AND record IS NULL AND stimuli IS NULL AND deleted_at IS NOT NULL))
);
CREATE INDEX affective_appraisals_active_idx ON affective_appraisals(character_id,owner_id,created_at) WHERE status='active';
