CREATE TABLE credit_policies (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scope_type                VARCHAR(50) NOT NULL,
  institution_id            UUID REFERENCES org.institutions(id) ON DELETE CASCADE,
  program_id                UUID REFERENCES org.programs(id) ON DELETE CASCADE,
  subdivision_id            UUID REFERENCES org.subdivisions(id) ON DELETE CASCADE,
  student_id                UUID REFERENCES org.students(id) ON DELETE CASCADE,
  initial_credit_amount     NUMERIC NOT NULL DEFAULT 0,
  consume_amount            NUMERIC NOT NULL DEFAULT 0,
  reward_ceiling            NUMERIC NOT NULL DEFAULT 0,
  max_balance               NUMERIC,
  self_practice_enabled     BOOLEAN NOT NULL DEFAULT TRUE,
  conducted_attempt_policy  JSONB,
  is_active                 BOOLEAN NOT NULL DEFAULT TRUE,
  created_at                TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT now()
);
