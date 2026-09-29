import { db } from '../../shared/db/pool';
import { PlacementEligibility } from './eligibility.types';

/**
 * Repository for placement_eligibility table
 */
export class EligibilityRepository {
  /**
   * Find eligibility record by student ID
   */
  async findByStudentId(studentId: string): Promise<PlacementEligibility | null> {
    const result = await db.query(
      'SELECT * FROM placement_eligibility WHERE student_id = $1',
      [studentId]
    );
    return result.rows[0] || null;
  }

  /**
   * Find all eligible students
   */
  async findEligible(): Promise<PlacementEligibility[]> {
    const result = await db.query(
      'SELECT * FROM placement_eligibility WHERE is_eligible = true ORDER BY total_score DESC'
    );
    return result.rows;
  }

  /**
   * Upsert eligibility record
   */
  async upsert(
    studentId: string,
    totalScore: number,
    maximumScore: number,
    thresholdScore: number,
    isEligible: boolean,
    reason: string | null
  ): Promise<PlacementEligibility> {
    const result = await db.query(
      `INSERT INTO placement_eligibility (
        id, student_id, total_score, maximum_score, threshold_score,
        is_eligible, evaluated_at, updated_at, reason
      ) VALUES (
        gen_random_uuid(), $1, $2, $3, $4, $5, NOW(), NOW(), $6
      )
      ON CONFLICT (student_id)
      DO UPDATE SET
        total_score = $2,
        maximum_score = $3,
        threshold_score = $4,
        is_eligible = $5,
        evaluated_at = NOW(),
        updated_at = NOW(),
        reason = $6
      RETURNING *`,
      [studentId, totalScore, maximumScore, thresholdScore, isEligible, reason]
    );
    return result.rows[0];
  }

  /**
   * Get performance score for a student (from M3's table)
   */
  async getPerformanceScore(studentId: string): Promise<number | null> {
    const result = await db.query(
      'SELECT overall_score FROM performance_profiles WHERE student_id = $1',
      [studentId]
    );
    return result.rows[0]?.overall_score ?? null;
  }

  /**
   * Get student's program and subdivision for checklist scoping
   */
  async getStudentScope(studentId: string): Promise<{
    programId: string;
    subdivisionId: string | null;
  } | null> {
    const result = await db.query(
      `SELECT b.program_id, s.subdivision_id
       FROM org.students s
       JOIN org.batches b ON s.batch_id = b.id
       WHERE s.id = $1`,
      [studentId]
    );
    if (result.rows.length === 0) return null;
    return {
      programId: result.rows[0].program_id,
      subdivisionId: result.rows[0].subdivision_id,
    };
  }

  /**
   * Count completed required checklist items for a student
   */
  async countCompletedRequired(studentId: string, programId: string): Promise<number> {
    const result = await db.query(
      `SELECT COUNT(*) as count
       FROM checklist_progress cp
       JOIN checklist_items ci ON cp.checklist_item_id = ci.id
       WHERE cp.student_id = $1
         AND cp.status = 'COMPLETED'
         AND ci.is_required = true
         AND ci.is_active = true
         AND ci.program_id = $2`,
      [studentId, programId]
    );
    return parseInt(result.rows[0].count, 10);
  }

  /**
   * Count total required checklist items for a program
   */
  async countTotalRequired(programId: string): Promise<number> {
    const result = await db.query(
      `SELECT COUNT(*) as count
       FROM checklist_items
       WHERE is_required = true
         AND is_active = true
         AND program_id = $1`,
      [programId]
    );
    return parseInt(result.rows[0].count, 10);
  }

  /**
   * Get incomplete required checklist items for reason text
   */
  async getIncompleteRequiredItems(studentId: string, programId: string): Promise<string[]> {
    const result = await db.query(
      `SELECT ci.name
       FROM checklist_items ci
       LEFT JOIN checklist_progress cp ON ci.id = cp.checklist_item_id AND cp.student_id = $1
       WHERE ci.is_required = true
         AND ci.is_active = true
         AND ci.program_id = $2
         AND (cp.id IS NULL OR cp.status != 'COMPLETED')
       ORDER BY ci.name`,
      [studentId, programId]
    );
    return result.rows.map((row) => row.name);
  }
}

export const eligibilityRepository = new EligibilityRepository();
