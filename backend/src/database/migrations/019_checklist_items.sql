CREATE TABLE checklist_items (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id      UUID NOT NULL REFERENCES org.programs(id) ON DELETE CASCADE,
  subdivision_id  UUID REFERENCES org.subdivisions(id) ON DELETE CASCADE,
  name            VARCHAR(255) NOT NULL,
  description     TEXT,
  category        VARCHAR(50) NOT NULL,
  max_score       NUMERIC NOT NULL DEFAULT 0,
  weight          NUMERIC NOT NULL DEFAULT 1.0,
  is_required     BOOLEAN NOT NULL DEFAULT TRUE,
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (program_id, name)
);
