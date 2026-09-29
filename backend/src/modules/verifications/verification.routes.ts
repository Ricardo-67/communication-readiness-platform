import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { requireRole } from '../../middleware/authorize';
import { verificationController } from './verification.controller';

const router = Router();

/**
 * GET /api/verifications/pending
 * Get pending verifications for the authenticated mentor
 * Auth: FACULTY_MENTOR only
 */
router.get('/pending', authenticate, requireRole('FACULTY_MENTOR'), async (req, res, next) => {
  try {
    await verificationController.getPending(req, res);
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/verifications/request
 * Create a verification request (student requesting mentor sign-off)
 * Auth: STUDENT only
 */
router.post('/request', authenticate, requireRole('STUDENT'), async (req, res, next) => {
  try {
    await verificationController.createRequest(req, res);
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/verifications/:id/approve
 * Approve a verification request
 * Auth: FACULTY_MENTOR only
 */
router.post('/:id/approve', authenticate, requireRole('FACULTY_MENTOR'), async (req, res, next) => {
  try {
    await verificationController.approve(req, res);
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/verifications/:id/reject
 * Reject a verification request
 * Auth: FACULTY_MENTOR only
 */
router.post('/:id/reject', authenticate, requireRole('FACULTY_MENTOR'), async (req, res, next) => {
  try {
    await verificationController.reject(req, res);
  } catch (err) {
    next(err);
  }
});

export default router;
