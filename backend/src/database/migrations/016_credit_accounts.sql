CREATE TABLE credit_accounts (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id  UUID UNIQUE NOT NULL REFERENCES org.students(id) ON DELETE CASCADE,
  balance     NUMERIC NOT NULL DEFAULT 0 CHECK (balance >= 0),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
