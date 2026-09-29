import { Response } from 'express';
import { AuthRequest } from '../../middleware/authenticate';
import { checklistService } from './checklist.service';
import { progressService } from './progress.service';
import { createChecklistItemSchema, updateChecklistItemSchema, ChecklistItemCSVRow } from './checklist.types';
import { AppError } from '../../shared/errors/AppError';
import { db } from '../../shared/db/pool';

/**
 * Checklist Controller
 * Handles HTTP requests for checklist items and progress
 */
export class ChecklistController {
  /**
   * GET /api/checklist
   * List all active checklist items
   */
  async getAllItems(req: AuthRequest, res: Response): Promise<void> {
    const programId = req.query.programId as string | undefined;
    const subdivisionId = req.query.subdivisionId as string | undefined;

    const items = await checklistService.getAllItems(programId, subdivisionId);

    res.json({ data: items });
  }

  /**
   * GET /api/checklist/:id
   * Get a specific checklist item
   */
  async getItemById(req: AuthRequest, res: Response): Promise<void> {
    const { id } = req.params;
    const item = await checklistService.getItemById(id);
    res.json({ data: item });
  }

  /**
   * POST /api/checklist
   * Create a new checklist item
   */
  async createItem(req: AuthRequest, res: Response): Promise<void> {
    const validated = createChecklistItemSchema.parse(req.body);
    const item = await checklistService.createItem(validated);
    res.status(201).json({ data: item });
  }

  /**
   * PUT /api/checklist/:id
   * Update an existing checklist item
   */
  async updateItem(req: AuthRequest, res: Response): Promise<void> {
    const { id } = req.params;
    const validated = updateChecklistItemSchema.parse(req.body);
    const item = await checklistService.updateItem(id, validated);
    res.json({ data: item });
  }

  /**
   * DELETE /api/checklist/:id
   * Soft delete a checklist item
   */
  async deleteItem(req: AuthRequest, res: Response): Promise<void> {
    const { id } = req.params;
    await checklistService.deleteItem(id);
    res.status(204).send();
  }

  /**
   * POST /api/checklist/import-csv
   * Bulk import checklist items from CSV
   *
   * Request body: { programId, subdivisionId, csvData: string }
   * CSV format: name,description,category,max_score,weight,is_required
   */
  async importCSV(req: AuthRequest, res: Response): Promise<void> {
    const { programId, subdivisionId, csvData } = req.body;

    if (!programId || typeof programId !== 'string') {
      throw new AppError(400, 'programId is required', 'INVALID_INPUT');
    }

    if (!csvData || typeof csvData !== 'string') {
      throw new AppError(400, 'csvData is required', 'INVALID_INPUT');
    }

    // Parse CSV (simple line-by-line parser)
    const lines = csvData.trim().split('\n');
    if (lines.length < 2) {
      throw new AppError(400, 'CSV must have at least a header and one data row', 'INVALID_CSV');
    }

    // Skip header row
    const header = lines[0].toLowerCase().split(',').map((h) => h.trim());
    const rows: ChecklistItemCSVRow[] = [];

    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',').map((v) => v.trim());
      const row: any = {};

      header.forEach((key, index) => {
        row[key] = values[index] || '';
      });

      rows.push(row as ChecklistItemCSVRow);
    }

    const result = await checklistService.importFromCSV(
      programId,
      subdivisionId || null,
      rows
    );

    res.status(201).json({ data: result });
  }

  /**
   * GET /api/checklist/my-progress
   * Get checklist progress for authenticated student
   */
  async getMyProgress(req: AuthRequest, res: Response): Promise<void> {
    const user = req.user!;

    if (user.role !== 'STUDENT') {
      throw new AppError(403, 'Only students can view their progress', 'FORBIDDEN');
    }

    // Get student ID from user ID
    const studentResult = await db.query(
      'SELECT id FROM org.students WHERE user_id = $1',
      [user.id]
    );

    if (studentResult.rows.length === 0) {
      throw new AppError(404, 'Student record not found', 'STUDENT_NOT_FOUND');
    }

    const studentId = studentResult.rows[0].id;
    const progress = await progressService.getStudentProgress(studentId);

    res.json({ data: progress });
  }

  /**
   * POST /api/checklist/:itemId/toggle
   * Toggle checklist item completion for authenticated student
   */
  async toggleItem(req: AuthRequest, res: Response): Promise<void> {
    const { itemId } = req.params;
    const user = req.user!;

    if (user.role !== 'STUDENT') {
      throw new AppError(403, 'Only students can toggle checklist items', 'FORBIDDEN');
    }

    // Get student ID from user ID
    const studentResult = await db.query(
      'SELECT id FROM org.students WHERE user_id = $1',
      [user.id]
    );

    if (studentResult.rows.length === 0) {
      throw new AppError(404, 'Student record not found', 'STUDENT_NOT_FOUND');
    }

    const studentId = studentResult.rows[0].id;
    const progress = await progressService.toggleItem(studentId, itemId, user.id);

    res.json({ data: progress });
  }

  /**
   * GET /api/checklist/mentee/:studentId
   * Get checklist progress for a mentee (mentor only)
   */
  async getMenteeProgress(req: AuthRequest, res: Response): Promise<void> {
    const { studentId } = req.params;
    const user = req.user!;

    if (user.role !== 'FACULTY_MENTOR') {
      throw new AppError(403, 'Only mentors can view mentee progress', 'FORBIDDEN');
    }

    // Verify mentor is assigned to this student
    const assignmentResult = await db.query(
      'SELECT id FROM org.student_mentor_assignments WHERE student_id = $1 AND mentor_user_id = $2 AND is_active = true',
      [studentId, user.id]
    );

    if (assignmentResult.rows.length === 0) {
      throw new AppError(403, 'You are not assigned as mentor to this student', 'FORBIDDEN');
    }

    const progress = await progressService.getStudentProgress(studentId);

    res.json({ data: progress });
  }
}

export const checklistController = new ChecklistController();
