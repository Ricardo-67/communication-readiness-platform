import { db } from '../../shared/db/pool';
import {
  MentorVerification,
  VerificationWithDetails,
  VerificationTypeType,
  VerificationStatusType,
} from './verification.types';

/**
 * Repository for mentor_verifications table
 */
export class VerificationRepository {
  /**
   * Find verification by ID
   */
  async findById(id: string): Promise<MentorVerification | null> {
    const result = await db.query(
      'SELECT * FROM mentor_verifications WHERE id = $1',
      [id]
    );
    return result.rows[0] || null;
  }

  /**
   * Find pending verifications for a mentor
   */
  async findPendingByMentor(mentorUserId: string): Promise<VerificationWithDetails[]> {
    const result = await db.query(
      `SELECT
        mv.id,
        mv.student_id,
        u.first_name || ' ' || u.last_name as student_name,
        s.roll_number as student_roll_number,
        mv.mentor_user_id,
        mv.verification_type,
        mv.checklist_progress_id,
        ci.name as checklist_item_name,
        mv.status,
        mv.notes,
        mv.verified_at,
        mv.created_at,
        mv.updated_at
      FROM mentor_verifications mv
      JOIN org.students s ON mv.student_id = s.id
      JOIN identity.users u ON s.user_id = u.id
      LEFT JOIN checklist_progress cp ON mv.checklist_progress_id = cp.id
      LEFT JOIN checklist_items ci ON cp.checklist_item_id = ci.id
      WHERE mv.mentor_user_id = $1 AND mv.status = 'PENDING'
      ORDER BY mv.created_at DESC`,
      [mentorUserId]
    );
    return result.rows;
  }

  /**
   * Create a verification request
   */
  async create(
    studentId: string,
    mentorUserId: string,
    verificationType: VerificationTypeType,
    checklistProgressId?: string | null
  ): Promise<MentorVerification> {
    const result = await db.query(
      `INSERT INTO mentor_verifications (
        id, student_id, mentor_user_id, verification_type,
        checklist_progress_id, status, created_at, updated_at
      ) VALUES (
        gen_random_uuid(), $1, $2, $3, $4, 'PENDING', NOW(), NOW()
      ) RETURNING *`,
      [studentId, mentorUserId, verificationType, checklistProgressId || null]
    );
    return result.rows[0];
  }

  /**
   * Update verification status
   */
  async updateStatus(
    id: string,
    status: VerificationStatusType,
    notes?: string
  ): Promise<MentorVerification | null> {
    const verifiedAt = status !== 'PENDING' ? 'NOW()' : 'NULL';

    const result = await db.query(
      `UPDATE mentor_verifications
       SET status = $2, notes = $3, verified_at = ${verifiedAt}, updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [id, status, notes || null]
    );
    return result.rows[0] || null;
  }

  /**
   * Check if mentor is assigned to student
   */
  async isMentorAssignedToStudent(mentorUserId: string, studentId: string): Promise<boolean> {
    const result = await db.query(
      `SELECT id FROM org.student_mentor_assignments
       WHERE student_id = $1 AND mentor_user_id = $2 AND is_active = true`,
      [studentId, mentorUserId]
    );
    return result.rows.length > 0;
  }

  /**
   * Get mentor user ID for a student
   */
  async getMentorForStudent(studentId: string): Promise<string | null> {
    const result = await db.query(
      `SELECT mentor_user_id FROM org.student_mentor_assignments
       WHERE student_id = $1 AND is_active = true
       LIMIT 1`,
      [studentId]
    );
    return result.rows[0]?.mentor_user_id || null;
  }
}

export const verificationRepository = new VerificationRepository();
