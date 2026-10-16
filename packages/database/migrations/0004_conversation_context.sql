ALTER TABLE response_runs ADD COLUMN conversation_refs jsonb;
ALTER TABLE response_sources ADD COLUMN source_response_id uuid;
-- Discover the original anonymous event/memory XOR check; preserve other checks.
DO $$ DECLARE constraint_name text; BEGIN
 SELECT conname INTO STRICT constraint_name FROM pg_constraint
 WHERE conrelid='response_sources'::regclass AND contype='c'
 AND pg_get_constraintdef(oid) LIKE '%event_id%' AND pg_get_constraintdef(oid) LIKE '%memory_id%';
 EXECUTE format('ALTER TABLE response_sources DROP CONSTRAINT %I',constraint_name);
END $$;
ALTER TABLE response_sources ADD CONSTRAINT response_sources_one_source CHECK(num_nonnulls(event_id,memory_id,source_response_id)=1);
ALTER TABLE response_sources ADD CONSTRAINT response_sources_response_fk FOREIGN KEY(character_id,source_response_id) REFERENCES response_runs(character_id,id);
ALTER TABLE response_sources ADD CONSTRAINT response_sources_not_self CHECK(source_response_id IS NULL OR source_response_id<>response_id);
CREATE UNIQUE INDEX response_sources_response_uq ON response_sources(response_id,source_response_id) WHERE source_response_id IS NOT NULL;
CREATE INDEX response_sources_response_idx ON response_sources(character_id,source_response_id,response_id) WHERE source_response_id IS NOT NULL;
