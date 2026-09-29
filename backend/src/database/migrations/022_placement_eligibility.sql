CREATE TABLE placement_eligibility (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id       UUID UNIQUE NOT NULL REFERENCES org.students(id) ON DELETE CASCADE,
  total_score      NUMERIC NOT NULL DEFAULT 0,
  maximum_score    NUMERIC NOT NULL DEFAULT 100,
  threshold_score  NUMERIC NOT NULL DEFAULT 60,
  is_eligible      BOOLEAN NOT NULL DEFAULT FALSE,
  evaluated_at     TIMESTAMPTZ,
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  reason           TEXT
);
