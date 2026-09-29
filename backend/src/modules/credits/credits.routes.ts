import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { requireStudentSelfOrStaff } from '../../middleware/authorize';
import { creditsController } from './credits.controller';

const router = Router();

/**
 * GET /api/credits/balance/:studentId
 * Get credit balance for a student
 * Auth: STUDENT (self) or staff roles
 */
router.get(
  '/balance/:studentId',
  authenticate,
  requireStudentSelfOrStaff,
  async (req, res, next) => {
    try {
      await creditsController.getBalance(req, res);
    } catch (err) {
      next(err);
    }
  }
);

/**
 * GET /api/credits/transactions/:studentId
 * Get transaction history for a student
 * Auth: STUDENT (self) or staff roles
 */
router.get(
  '/transactions/:studentId',
  authenticate,
  requireStudentSelfOrStaff,
  async (req, res, next) => {
    try {
      await creditsController.getTransactions(req, res);
    } catch (err) {
      next(err);
    }
  }
);

export default router;
