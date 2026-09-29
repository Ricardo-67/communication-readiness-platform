import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { requireRole, requireStudentSelfOrStaff } from '../../middleware/authorize';
import { eligibilityController } from './eligibility.controller';

const router = Router();

/**
 * GET /api/placement-eligibility/eligible-students
 * Get all eligible students
 * Auth: PLACEMENT_COORDINATOR or PROGRAM_ADMIN
 */
router.get(
  '/eligible-students',
  authenticate,
  requireRole('PLACEMENT_COORDINATOR', 'PROGRAM_ADMIN'),
  async (req, res, next) => {
    try {
      await eligibilityController.getEligibleStudents(req, res);
    } catch (err) {
      next(err);
    }
  }
);

/**
 * GET /api/placement-eligibility/:studentId
 * Get placement eligibility for a student
 * Auth: STUDENT (self) or staff roles
 */
router.get(
  '/:studentId',
  authenticate,
  requireStudentSelfOrStaff,
  async (req, res, next) => {
    try {
      await eligibilityController.getEligibility(req, res);
    } catch (err) {
      next(err);
    }
  }
);

/**
 * POST /api/placement-eligibility/:studentId/recalculate
 * Force recalculate eligibility for a student
 * Auth: PLACEMENT_COORDINATOR or PROGRAM_ADMIN
 */
router.post(
  '/:studentId/recalculate',
  authenticate,
  requireRole('PLACEMENT_COORDINATOR', 'PROGRAM_ADMIN'),
  async (req, res, next) => {
    try {
      await eligibilityController.recalculate(req, res);
    } catch (err) {
      next(err);
    }
  }
);

export default router;
