CREATE TABLE checklist_progress (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id         UUID NOT NULL REFERENCES org.students(id) ON DELETE CASCADE,
  checklist_item_id  UUID NOT NULL REFERENCES checklist_items(id) ON DELETE CASCADE,
  status             VARCHAR(50) NOT NULL DEFAULT 'PENDING',
  score              NUMERIC,
  max_score          NUMERIC,
  completed_at       TIMESTAMPTZ,
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (student_id, checklist_item_id)
);
