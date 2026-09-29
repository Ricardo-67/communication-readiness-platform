-- Credit accounts indexes
CREATE INDEX idx_credit_accounts_student_id ON credit_accounts(student_id);

-- Credit transactions indexes
CREATE INDEX idx_credit_transactions_account_id ON credit_transactions(account_id);
CREATE INDEX idx_credit_transactions_student_id ON credit_transactions(student_id);
CREATE INDEX idx_credit_transactions_student_created ON credit_transactions(student_id, created_at DESC);
CREATE INDEX idx_credit_transactions_idempotency_key ON credit_transactions(idempotency_key);

-- Credit policies indexes
CREATE INDEX idx_credit_policies_scope_type ON credit_policies(scope_type) WHERE is_active = TRUE;
CREATE INDEX idx_credit_policies_institution_id ON credit_policies(institution_id) WHERE is_active = TRUE;
CREATE INDEX idx_credit_policies_program_id ON credit_policies(program_id) WHERE is_active = TRUE;
CREATE INDEX idx_credit_policies_subdivision_id ON credit_policies(subdivision_id) WHERE is_active = TRUE;
CREATE INDEX idx_credit_policies_student_id ON credit_policies(student_id) WHERE is_active = TRUE;
