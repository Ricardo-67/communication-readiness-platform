import { Response } from 'express';
import { AuthRequest } from '../../middleware/authenticate';
import { eligibilityService } from './eligibility.service';
import { AppError } from '../../shared/errors/AppError';
import { db } from '../../shared/db/pool';

/**
 * Eligibility Controller
 * Handles HTTP requests for placement eligibility
 */
export class EligibilityController {
  /**
   * GET /api/placement-eligibility/:studentId
   * Get placement eligibility for a student
   */
  async getEligibility(req: AuthRequest, res: Response): Promise<void> {
    const { studentId } = req.params;
    const user = req.user!;

    // Scope check: Student can only view own eligibility
    if (user.role === 'STUDENT') {
      const studentResult = await db.query(
        'SELECT id FROM org.students WHERE user_id = $1',
        [user.id]
      );
      if (studentResult.rows.length === 0 || studentResult.rows[0].id !== studentId) {
        throw new AppError(403, 'You can only view your own eligibility', 'FORBIDDEN');
      }
    }

    // Mentor scope check
    if (user.role === 'FACULTY_MENTOR') {
      const assignmentResult = await db.query(
        'SELECT id FROM org.student_mentor_assignments WHERE student_id = $1 AND mentor_user_id = $2 AND is_active = true',
        [studentId, user.id]
      );

      if (assignmentResult.rows.length === 0) {
        throw new AppError(403, 'You can only view eligibility for your assigned mentees', 'FORBIDDEN');
      }
    }

    const eligibility = await eligibilityService.getEligibility(studentId);

    if (!eligibility) {
      // Calculate eligibility for the first time
      const calculated = await eligibilityService.recalculate(studentId);
      res.json({ data: calculated });
      return;
    }

    res.json({ data: eligibility });
  }

  /**
   * POST /api/placement-eligibility/:studentId/recalculate
   * Force recalculate eligibility for a student
   */
  async recalculate(req: AuthRequest, res: Response): Promise<void> {
    const { studentId } = req.params;
    const eligibility = await eligibilityService.recalculate(studentId);
    res.json({ data: eligibility });
  }

  /**
   * GET /api/placement-eligibility/eligible-students
   * Get all eligible students
   */
  async getEligibleStudents(req: AuthRequest, res: Response): Promise<void> {
    const students = await eligibilityService.getEligibleStudents();

    // Enhance with student details
    const enriched = await Promise.all(
      students.map(async (e) => {
        const studentResult = await db.query(
          `SELECT s.id, u.first_name, u.last_name, s.roll_number
           FROM org.students s
           JOIN identity.users u ON s.user_id = u.id
           WHERE s.id = $1`,
          [e.student_id]
        );

        return {
          ...e,
          studentName: studentResult.rows[0]
            ? `${studentResult.rows[0].first_name} ${studentResult.rows[0].last_name}`
            : 'Unknown',
          rollNumber: studentResult.rows[0]?.roll_number || 'N/A',
        };
      })
    );

    res.json({ data: enriched });
  }
}

export const eligibilityController = new EligibilityController();
