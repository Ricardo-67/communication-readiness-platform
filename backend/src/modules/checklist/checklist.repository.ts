import { db } from '../../shared/db/pool';
import { ChecklistItem, CreateChecklistItemInput, UpdateChecklistItemInput } from './checklist.types';

/**
 * Repository for checklist_items table
 * Raw SQL queries only - no business logic
 */
export class ChecklistRepository {
  /**
   * Find all active checklist items
   */
  async findAll(programId?: string, subdivisionId?: string): Promise<ChecklistItem[]> {
    let query = 'SELECT * FROM checklist_items WHERE is_active = true';
    const params: any[] = [];

    if (programId) {
      params.push(programId);
      query += ` AND program_id = $${params.length}`;
    }

    if (subdivisionId !== undefined) {
      if (subdivisionId === null) {
        query += ' AND subdivision_id IS NULL';
      } else {
        params.push(subdivisionId);
        query += ` AND subdivision_id = $${params.length}`;
      }
    }

    query += ' ORDER BY name ASC';

    const result = await db.query(query, params);
    return result.rows;
  }

  /**
   * Find checklist item by ID
   */
  async findById(id: string): Promise<ChecklistItem | null> {
    const result = await db.query(
      'SELECT * FROM checklist_items WHERE id = $1',
      [id]
    );
    return result.rows[0] || null;
  }

  /**
   * Create a new checklist item
   */
  async create(data: CreateChecklistItemInput): Promise<ChecklistItem> {
    const result = await db.query(
      `INSERT INTO checklist_items (
        id, program_id, subdivision_id, name, description, category,
        max_score, weight, is_required, is_active, created_at, updated_at
      ) VALUES (
        gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW()
      ) RETURNING *`,
      [
        data.program_id,
        data.subdivision_id || null,
        data.name,
        data.description || null,
        data.category,
        data.max_score,
        data.weight,
        data.is_required,
        data.is_active,
      ]
    );
    return result.rows[0];
  }

  /**
   * Update an existing checklist item
   */
  async update(id: string, data: UpdateChecklistItemInput): Promise<ChecklistItem | null> {
    const fields: string[] = [];
    const values: any[] = [];
    let paramCount = 1;

    if (data.name !== undefined) {
      fields.push(`name = $${paramCount++}`);
      values.push(data.name);
    }
    if (data.description !== undefined) {
      fields.push(`description = $${paramCount++}`);
      values.push(data.description);
    }
    if (data.category !== undefined) {
      fields.push(`category = $${paramCount++}`);
      values.push(data.category);
    }
    if (data.max_score !== undefined) {
      fields.push(`max_score = $${paramCount++}`);
      values.push(data.max_score);
    }
    if (data.weight !== undefined) {
      fields.push(`weight = $${paramCount++}`);
      values.push(data.weight);
    }
    if (data.is_required !== undefined) {
      fields.push(`is_required = $${paramCount++}`);
      values.push(data.is_required);
    }
    if (data.is_active !== undefined) {
      fields.push(`is_active = $${paramCount++}`);
      values.push(data.is_active);
    }

    if (fields.length === 0) {
      return this.findById(id);
    }

    fields.push(`updated_at = NOW()`);
    values.push(id);

    const result = await db.query(
      `UPDATE checklist_items SET ${fields.join(', ')} WHERE id = $${paramCount} RETURNING *`,
      values
    );

    return result.rows[0] || null;
  }

  /**
   * Soft delete a checklist item
   */
  async softDelete(id: string): Promise<boolean> {
    const result = await db.query(
      'UPDATE checklist_items SET is_active = false, updated_at = NOW() WHERE id = $1 RETURNING id',
      [id]
    );
    return result.rowCount > 0;
  }

  /**
   * Check if a checklist item with the same name exists in the program
   */
  async existsByName(programId: string, name: string, excludeId?: string): Promise<boolean> {
    let query = 'SELECT id FROM checklist_items WHERE program_id = $1 AND name = $2';
    const params: any[] = [programId, name];

    if (excludeId) {
      params.push(excludeId);
      query += ` AND id != $${params.length}`;
    }

    const result = await db.query(query, params);
    return result.rows.length > 0;
  }
}

export const checklistRepository = new ChecklistRepository();
