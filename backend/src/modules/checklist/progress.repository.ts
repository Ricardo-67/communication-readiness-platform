import { db } from '../../shared/db/pool';
import {
  ChecklistProgress,
  ChecklistProgressWithItem,
  ChecklistProgressStatusType,
} from './progress.types';

/**
 * Repository for checklist_progress table
 */
export class ProgressRepository {
  /**
   * Find progress record for a specific student and item
   */
  async findByStudentAndItem(
    studentId: string,
    checklistItemId: string
  ): Promise<ChecklistProgress | null> {
    const result = await db.query(
      'SELECT * FROM checklist_progress WHERE student_id = $1 AND checklist_item_id = $2',
      [studentId, checklistItemId]
    );
    return result.rows[0] || null;
  }

  /**
   * Find all progress records for a student with item details
   */
  async findByStudent(studentId: string): Promise<ChecklistProgressWithItem[]> {
    const result = await db.query(
      `SELECT
        cp.*,
        ci.name as item_name,
        ci.description as item_description,
        ci.category as item_category,
        ci.is_required as item_is_required,
        ci.weight as item_weight
      FROM checklist_progress cp
      JOIN checklist_items ci ON cp.checklist_item_id = ci.id
      WHERE cp.student_id = $1 AND ci.is_active = true
      ORDER BY ci.name ASC`,
      [studentId]
    );
    return result.rows;
  }

  /**
   * Upsert progress record (create or update)
   */
  async upsert(
    studentId: string,
    checklistItemId: string,
    status: ChecklistProgressStatusType,
    score?: number | null,
    maxScore?: number | null
  ): Promise<ChecklistProgress> {
    const completedAt = status === 'COMPLETED' ? 'NOW()' : 'NULL';

    const result = await db.query(
      `INSERT INTO checklist_progress (
        id, student_id, checklist_item_id, status, score, max_score,
        completed_at, updated_at
      ) VALUES (
        gen_random_uuid(), $1, $2, $3, $4, $5, ${completedAt}, NOW()
      )
      ON CONFLICT (student_id, checklist_item_id)
      DO UPDATE SET
        status = $3,
        score = $4,
        max_score = $5,
        completed_at = ${completedAt},
        updated_at = NOW()
      RETURNING *`,
      [studentId, checklistItemId, status, score ?? null, maxScore ?? null]
    );
    return result.rows[0];
  }

  /**
   * Update status and timestamp
   */
  async updateStatus(
    studentId: string,
    checklistItemId: string,
    status: ChecklistProgressStatusType
  ): Promise<ChecklistProgress | null> {
    const completedAt = status === 'COMPLETED' ? 'NOW()' : 'completed_at';

    const result = await db.query(
      `UPDATE checklist_progress
       SET status = $3, completed_at = ${completedAt}, updated_at = NOW()
       WHERE student_id = $1 AND checklist_item_id = $2
       RETURNING *`,
      [studentId, checklistItemId, status]
    );
    return result.rows[0] || null;
  }

  /**
   * Count completed required items for a student
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
   * Count total required items for a program
   */
  async countTotalRequired(programId: string, subdivisionId?: string | null): Promise<number> {
    let query = `
      SELECT COUNT(*) as count
      FROM checklist_items
      WHERE is_required = true
        AND is_active = true
        AND program_id = $1
    `;
    const params: any[] = [programId];

    if (subdivisionId !== undefined) {
      if (subdivisionId === null) {
        query += ' AND subdivision_id IS NULL';
      } else {
        params.push(subdivisionId);
        query += ` AND (subdivision_id = $${params.length} OR subdivision_id IS NULL)`;
      }
    }

    const result = await db.query(query, params);
    return parseInt(result.rows[0].count, 10);
  }
}

export const progressRepository = new ProgressRepository();
