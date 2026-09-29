import { db } from '../../shared/db/pool';
import { eventBus } from '../../shared/events/eventBus';
import { Events, UserRegisteredPayload, AttemptCompletedPayload } from '../../shared/events/events';
import { creditService } from './credits.service';

/**
 * Event Handlers for Credit Module
 *
 * Handles:
 * - USER_REGISTERED: Create credit account with initial balance
 * - ATTEMPT_COMPLETED: Award credits for completing assessment
 */

/**
 * Handler for USER_REGISTERED event
 * Creates a credit account for new students with initial balance from credit_policies
 */
async function handleUserRegistered(payload: UserRegisteredPayload) {
  try {
    // Only create credit accounts for students
    const userResult = await db.query(
      'SELECT id FROM org.students WHERE user_id = $1',
      [payload.userId]
    );

    if (userResult.rows.length === 0) {
      // Not a student, skip credit account creation
      return;
    }

    const studentId = userResult.rows[0].id;

    // Get initial credit amount from credit_policies
    // Priority: student-specific > subdivision > program > institution > global
    const policyResult = await db.query(`
      SELECT initial_credit_amount
      FROM credit_policies
      WHERE is_active = true
        AND (
          (scope_type = 'STUDENT' AND student_id = $1)
          OR (scope_type = 'SUBDIVISION' AND subdivision_id = (SELECT subdivision_id FROM org.students WHERE id = $1))
          OR (scope_type = 'PROGRAM' AND program_id = (SELECT s.program_id FROM org.students s JOIN org.batches b ON s.batch_id = b.id WHERE s.id = $1))
          OR (scope_type = 'INSTITUTION')
          OR (scope_type = 'GLOBAL')
        )
      ORDER BY
        CASE scope_type
          WHEN 'STUDENT' THEN 1
          WHEN 'SUBDIVISION' THEN 2
          WHEN 'PROGRAM' THEN 3
          WHEN 'INSTITUTION' THEN 4
          WHEN 'GLOBAL' THEN 5
        END
      LIMIT 1
    `, [studentId]);

    const initialBalance = policyResult.rows.length > 0
      ? Number(policyResult.rows[0].initial_credit_amount)
      : 50; // Default fallback

    // Create credit account (ON CONFLICT DO NOTHING for idempotency)
    await db.query(`
      INSERT INTO credit_accounts (id, student_id, balance, created_at, updated_at)
      VALUES (gen_random_uuid(), $1, $2, NOW(), NOW())
      ON CONFLICT (student_id) DO NOTHING
    `, [studentId, initialBalance]);

    // Record the initial credit grant as a transaction
    // Use deterministic idempotency key so re-firing is safe
    const idempotencyKey = `initial-${studentId}`;

    // Check if this transaction already exists
    const existingTx = await db.query(
      'SELECT id FROM credit_transactions WHERE idempotency_key = $1',
      [idempotencyKey]
    );

    if (existingTx.rows.length === 0) {
      // Get the account ID
      const accountResult = await db.query(
        'SELECT id FROM credit_accounts WHERE student_id = $1',
        [studentId]
      );

      if (accountResult.rows.length > 0) {
        await db.query(`
          INSERT INTO credit_transactions (
            id, account_id, student_id, transaction_type, amount, balance_after,
            idempotency_key, reference_type, reference_id, metadata, created_at
          ) VALUES (
            gen_random_uuid(), $1, $2, 'EARN', $3, $3, $4, 'INITIAL_GRANT', NULL,
            $5, NOW()
          )
        `, [
          accountResult.rows[0].id,
          studentId,
          initialBalance,
          idempotencyKey,
          JSON.stringify({ reason: 'INITIAL_CREDIT_GRANT', userId: payload.userId })
        ]);
      }
    }

    console.log(`[credits] Created account for student ${studentId} with initial balance ${initialBalance}`);
  } catch (error) {
    console.error('[credits] USER_REGISTERED handler error:', error);
    // Don't throw - event handlers should be non-blocking
  }
}

/**
 * Handler for ATTEMPT_COMPLETED event
 * Awards credits for completing an assessment and recalculates placement eligibility
 */
async function handleAttemptCompleted(payload: AttemptCompletedPayload) {
  try {
    // Get reward amount from credit_policies
    // For now, use a fixed reward amount - can be made configurable later
    const policyResult = await db.query(`
      SELECT reward_ceiling
      FROM credit_policies
      WHERE is_active = true
        AND (
          (scope_type = 'STUDENT' AND student_id = $1)
          OR (scope_type = 'SUBDIVISION' AND subdivision_id = (SELECT subdivision_id FROM org.students WHERE id = $1))
          OR (scope_type = 'PROGRAM' AND program_id = (SELECT s.program_id FROM org.students s JOIN org.batches b ON s.batch_id = b.id WHERE s.id = $1))
          OR (scope_type = 'INSTITUTION')
          OR (scope_type = 'GLOBAL')
        )
      ORDER BY
        CASE scope_type
          WHEN 'STUDENT' THEN 1
          WHEN 'SUBDIVISION' THEN 2
          WHEN 'PROGRAM' THEN 3
          WHEN 'INSTITUTION' THEN 4
          WHEN 'GLOBAL' THEN 5
        END
      LIMIT 1
    `, [payload.studentId]);

    const rewardAmount = policyResult.rows.length > 0
      ? Number(policyResult.rows[0].reward_ceiling)
      : 10; // Default fallback

    // Use deterministic idempotency key based on attemptId (from sessionId)
    const idempotencyKey = `earn-attempt-${payload.sessionId}`;

    // Award credits
    await creditService.earn(
      payload.studentId,
      rewardAmount,
      'ATTEMPT_COMPLETED',
      payload.sessionId, // Using sessionId as reference_id
      idempotencyKey
    );

    console.log(`[credits] Awarded ${rewardAmount} credits to student ${payload.studentId} for attempt ${payload.sessionId}`);

    // Trigger placement eligibility recalculation
    const { eligibilityService } = await import('../placement/eligibility.service');
    await eligibilityService.recalculate(payload.studentId).catch((err) => {
      console.error('[credits] Failed to recalculate eligibility:', err);
    });
  } catch (error) {
    console.error('[credits] ATTEMPT_COMPLETED handler error:', error);
    // Don't throw - event handlers should be non-blocking
  }
}

/**
 * Register all credit-related event handlers
 * Call this function during application startup
 */
export function registerCreditEventHandlers() {
  eventBus.on(Events.USER_REGISTERED, handleUserRegistered);
  eventBus.on(Events.ATTEMPT_COMPLETED, handleAttemptCompleted);

  console.log('[credits] Event handlers registered');
}
