import { Response } from 'express';
import { AuthRequest } from '../../middleware/authenticate';
import { verificationService } from './verification.service';
import { AppError } from '../../shared/errors/AppError';

/**
 * Verification Controller
 * Handles HTTP requests for mentor verifications
 */
export class VerificationController {
  /**
   * GET /api/verifications/pending
   * Get pending verifications for the authenticated mentor
   */
  async getPending(req: AuthRequest, res: Response): Promise<void> {
    const user = req.user!;

    if (user.role !== 'FACULTY_MENTOR') {
      throw new AppError(403, 'Only mentors can view pending verifications', 'FORBIDDEN');
    }

    const verifications = await verificationService.getPendingForMentor(user.id);

    res.json({ data: verifications });
  }

  /**
   * POST /api/verifications/:id/approve
   * Approve a verification request
   */
  async approve(req: AuthRequest, res: Response): Promise<void> {
    const { id } = req.params;
    const { notes } = req.body;
    const user = req.user!;

    if (user.role !== 'FACULTY_MENTOR') {
      throw new AppError(403, 'Only mentors can approve verifications', 'FORBIDDEN');
    }

    const verification = await verificationService.approve(id, user.id, notes);

    res.json({ data: verification });
  }

  /**
   * POST /api/verifications/:id/reject
   * Reject a verification request
   */
  async reject(req: AuthRequest, res: Response): Promise<void> {
    const { id } = req.params;
    const { notes } = req.body;
    const user = req.user!;

    if (user.role !== 'FACULTY_MENTOR') {
      throw new AppError(403, 'Only mentors can reject verifications', 'FORBIDDEN');
    }

    if (!notes || typeof notes !== 'string' || !notes.trim()) {
      throw new AppError(400, 'Rejection reason (notes) is required', 'NOTES_REQUIRED');
    }

    const verification = await verificationService.reject(id, user.id, notes);

    res.json({ data: verification });
  }

  /**
   * POST /api/verifications/request
   * Create a verification request (student requesting mentor sign-off)
   */
  async createRequest(req: AuthRequest, res: Response): Promise<void> {
    const { checklistProgressId } = req.body;
    const user = req.user!;

    if (user.role !== 'STUDENT') {
      throw new AppError(403, 'Only students can request verifications', 'FORBIDDEN');
    }

    // Get student ID from user ID
    const { db } = await import('../../shared/db/pool');
    const studentResult = await db.query(
      'SELECT id FROM org.students WHERE user_id = $1',
      [user.id]
    );

    if (studentResult.rows.length === 0) {
      throw new AppError(404, 'Student record not found', 'STUDENT_NOT_FOUND');
    }

    const studentId = studentResult.rows[0].id;

    const verification = await verificationService.createRequest(
      studentId,
      checklistProgressId || null
    );

    res.status(201).json({ data: verification });
  }
}

export const verificationController = new VerificationController();
