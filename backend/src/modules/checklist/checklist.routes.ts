import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { requireRole } from '../../middleware/authorize';
import { checklistController } from './checklist.controller';

const router = Router();

/**
 * GET /api/checklist
 * List all active checklist items
 * Auth: Any authenticated user
 */
router.get('/', authenticate, async (req, res, next) => {
  try {
    await checklistController.getAllItems(req, res);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/checklist/my-progress
 * Get checklist progress for authenticated student
 * Auth: STUDENT only
 */
router.get('/my-progress', authenticate, async (req, res, next) => {
  try {
    await checklistController.getMyProgress(req, res);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/checklist/mentee/:studentId
 * Get checklist progress for a mentee
 * Auth: FACULTY_MENTOR only
 */
router.get('/mentee/:studentId', authenticate, requireRole('FACULTY_MENTOR'), async (req, res, next) => {
  try {
    await checklistController.getMenteeProgress(req, res);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/checklist/:id
 * Get a specific checklist item
 * Auth: Any authenticated user
 */
router.get('/:id', authenticate, async (req, res, next) => {
  try {
    await checklistController.getItemById(req, res);
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/checklist
 * Create a new checklist item
 * Auth: PLACEMENT_COORDINATOR or PROGRAM_ADMIN
 */
router.post(
  '/',
  authenticate,
  requireRole('PLACEMENT_COORDINATOR', 'PROGRAM_ADMIN'),
  async (req, res, next) => {
    try {
      await checklistController.createItem(req, res);
    } catch (err) {
      next(err);
    }
  }
);

/**
 * POST /api/checklist/import-csv
 * Bulk import checklist items from CSV
 * Auth: PLACEMENT_COORDINATOR or PROGRAM_ADMIN
 */
router.post(
  '/import-csv',
  authenticate,
  requireRole('PLACEMENT_COORDINATOR', 'PROGRAM_ADMIN'),
  async (req, res, next) => {
    try {
      await checklistController.importCSV(req, res);
    } catch (err) {
      next(err);
    }
  }
);

/**
 * POST /api/checklist/:itemId/toggle
 * Toggle checklist item completion for authenticated student
 * Auth: STUDENT only
 */
router.post('/:itemId/toggle', authenticate, async (req, res, next) => {
  try {
    await checklistController.toggleItem(req, res);
  } catch (err) {
    next(err);
  }
});

/**
 * PUT /api/checklist/:id
 * Update an existing checklist item
 * Auth: PLACEMENT_COORDINATOR or PROGRAM_ADMIN
 */
router.put(
  '/:id',
  authenticate,
  requireRole('PLACEMENT_COORDINATOR', 'PROGRAM_ADMIN'),
  async (req, res, next) => {
    try {
      await checklistController.updateItem(req, res);
    } catch (err) {
      next(err);
    }
  }
);

/**
 * DELETE /api/checklist/:id
 * Soft delete a checklist item
 * Auth: PLACEMENT_COORDINATOR or PROGRAM_ADMIN
 */
router.delete(
  '/:id',
  authenticate,
  requireRole('PLACEMENT_COORDINATOR', 'PROGRAM_ADMIN'),
  async (req, res, next) => {
    try {
      await checklistController.deleteItem(req, res);
    } catch (err) {
      next(err);
    }
  }
);

export default router;
