CREATE TABLE credit_transactions (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id        UUID NOT NULL REFERENCES credit_accounts(id) ON DELETE CASCADE,
  student_id        UUID NOT NULL REFERENCES org.students(id) ON DELETE CASCADE,
  transaction_type  VARCHAR(50) NOT NULL,
  amount            NUMERIC NOT NULL,
  balance_after     NUMERIC NOT NULL,
  idempotency_key   VARCHAR(255) UNIQUE NOT NULL,
  reference_type    VARCHAR(50),
  reference_id      UUID,
  metadata          JSONB,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
