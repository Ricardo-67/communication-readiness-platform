import { Router } from 'express';
import { healthRouter } from './health';
import { authRouter } from './auth.routes';
import { studentRouter } from './student.routes';
import { interviewRouter } from './interview.routes';
import { portalRouter } from './portal.routes';
import { orgRouter } from './org.routes';
import { mentorRouter } from './mentor.routes';
import { trainerRouter } from './trainer.routes';
import { adminRouter } from './admin.routes';
import { authenticate } from '../middleware/authenticate';

// Module 4 routes
import creditsRouter from '../modules/credits/credits.routes';
import checklistRouter from '../modules/checklist/checklist.routes';
import verificationRouter from '../modules/verifications/verification.routes';
import eligibilityRouter from '../modules/placement/eligibility.routes';

export const router = Router();

// Public
router.use('/health', healthRouter);
router.use('/auth', authRouter);

// Org lookup endpoints are read-only and needed before login (e.g. batch list on registration form).
router.use('/org', orgRouter);

// Protected — authenticate on every request; individual routes add authorize() as needed
router.use('/students', authenticate, studentRouter);
router.use('/sessions', authenticate, interviewRouter);
router.use('/portals', authenticate, portalRouter);
router.use('/mentors', authenticate, mentorRouter);
router.use('/trainers', authenticate, trainerRouter);
router.use('/admin', authenticate, adminRouter);

// Module 4: Credits, Checklist, Verifications, Placement
router.use('/credits', creditsRouter);
router.use('/checklist', checklistRouter);
router.use('/verifications', verificationRouter);
router.use('/placement-eligibility', eligibilityRouter);
