-- O2 slice 2: a suggestion the character itself made in a reply. The reply's
-- annotation is held as a candidate and becomes an episode only after every
-- segment of that reply was shown and finished on Stage.
CREATE TABLE action_episodes (
 id uuid PRIMARY KEY,
 character_id uuid NOT NULL,
 owner_id uuid NOT NULL REFERENCES identities(id),
 response_id uuid NOT NULL,
 status text NOT NULL CHECK(status IN ('candidate','active','rejected','deleted')),
 annotation jsonb,
 episode jsonb,
 created_at timestamptz NOT NULL DEFAULT now(),
 delivered_at timestamptz,
 closed_at timestamptz,
 UNIQUE(response_id),
 FOREIGN KEY(character_id,response_id) REFERENCES response_runs(character_id,id),
 CHECK((status='candidate' AND jsonb_typeof(annotation)='object' AND episode IS NULL AND delivered_at IS NULL AND closed_at IS NULL)
  OR (status='active' AND annotation IS NULL AND jsonb_typeof(episode)='object' AND delivered_at IS NOT NULL AND closed_at IS NULL)
  OR (status IN ('rejected','deleted') AND annotation IS NULL AND episode IS NULL AND closed_at IS NOT NULL))
);
CREATE INDEX action_episodes_active_idx ON action_episodes(character_id,owner_id,delivered_at) WHERE status='active';
