-- Checklist items indexes
CREATE INDEX idx_checklist_items_program_id ON checklist_items(program_id) WHERE is_active = TRUE;
CREATE INDEX idx_checklist_items_program_subdivision ON checklist_items(program_id, subdivision_id) WHERE is_active = TRUE;

-- Checklist progress indexes
CREATE INDEX idx_checklist_progress_student_id ON checklist_progress(student_id);
CREATE INDEX idx_checklist_progress_student_status ON checklist_progress(student_id, status);
CREATE INDEX idx_checklist_progress_item_id ON checklist_progress(checklist_item_id);

-- Mentor verifications indexes
CREATE INDEX idx_mentor_verifications_student_id ON mentor_verifications(student_id);
CREATE INDEX idx_mentor_verifications_mentor_user_id ON mentor_verifications(mentor_user_id);
CREATE INDEX idx_mentor_verifications_student_type ON mentor_verifications(student_id, verification_type);
CREATE INDEX idx_mentor_verifications_mentor_student ON mentor_verifications(mentor_user_id, student_id);
CREATE INDEX idx_mentor_verifications_checklist_progress ON mentor_verifications(checklist_progress_id);
CREATE INDEX idx_mentor_verifications_status ON mentor_verifications(status) WHERE status = 'PENDING';

-- Placement eligibility indexes
CREATE INDEX idx_placement_eligibility_student_id ON placement_eligibility(student_id);
CREATE INDEX idx_placement_eligibility_is_eligible ON placement_eligibility(is_eligible);
CREATE INDEX idx_placement_eligibility_evaluated_at ON placement_eligibility(evaluated_at DESC);
