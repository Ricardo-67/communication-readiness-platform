CREATE TABLE mentor_verifications (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id             UUID NOT NULL REFERENCES org.students(id) ON DELETE CASCADE,
  mentor_user_id         UUID NOT NULL REFERENCES identity.users(id) ON DELETE CASCADE,
  verification_type      VARCHAR(50) NOT NULL,
  checklist_progress_id  UUID REFERENCES checklist_progress(id) ON DELETE SET NULL,
  status                 VARCHAR(50) NOT NULL DEFAULT 'PENDING',
  notes                  TEXT,
  verified_at            TIMESTAMPTZ,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);
