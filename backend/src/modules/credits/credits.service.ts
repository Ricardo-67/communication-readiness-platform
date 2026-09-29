import { db } from '../../shared/db/pool';
import { AppError } from '../../shared/errors/AppError';

/**
 * Result of consuming credits from an account
 */
export interface ConsumeResult {
  newBalance: number;
  transactionId: string;
}

/**
 * Result of earning/adding credits to an account
 */
export interface EarnResult {
  newBalance: number;
  transactionId: string;
}

/**
 * CreditService - Manages student credit accounts and transactions
 *
 * Core responsibilities:
 * - Consume credits (e.g., when starting an assessment)
 * - Earn credits (e.g., when completing an assessment)
 * - Maintain immutable transaction ledger
 * - Enforce idempotency via unique keys
 *
 * IMPORTANT: All operations use idempotencyKey because credit_transactions.idempotency_key
 * has a UNIQUE NOT NULL constraint. This prevents duplicate transactions if the same
 * operation is retried (e.g., network failure, client retry).
 */
export class CreditService {
  /**
   * Consume credits from a student's account
   *
   * @param studentId - UUID of the student
   * @param amount - Number of credits to consume (must be positive)
   * @param reason - Human-readable reason (e.g., 'ASSESSMENT_START')
   * @param referenceId - UUID of the triggering entity (e.g., attempt_id)
   * @param idempotencyKey - Unique key to prevent duplicate transactions (REQUIRED)
   * @returns New balance and transaction ID
   * @throws AppError(404) if account not found
   * @throws AppError(402) if insufficient credits
   */
  async consume(
    studentId: string,
    amount: number,
    reason: string,
    referenceId: string,
    idempotencyKey: string
  ): Promise<ConsumeResult> {
    // Check for existing transaction with this idempotency key
    const existingTx = await db.query(
      'SELECT id, balance_after FROM credit_transactions WHERE idempotency_key = $1',
      [idempotencyKey]
    );

    if (existingTx.rows.length > 0) {
      // Already processed - return cached result (idempotent)
      return {
        newBalance: Number(existingTx.rows[0].balance_after),
        transactionId: existingTx.rows[0].id,
      };
    }

    // Begin transaction with SELECT FOR UPDATE to prevent concurrent modifications
    const client = await db.connect();
    try {
      await client.query('BEGIN');

      // Lock the account row
      const accountResult = await client.query(
        'SELECT id, balance FROM credit_accounts WHERE student_id = $1 FOR UPDATE',
        [studentId]
      );

      if (accountResult.rows.length === 0) {
        throw new AppError(404, 'Credit account not found', 'ACCOUNT_NOT_FOUND');
      }

      const account = accountResult.rows[0];
      const currentBalance = Number(account.balance);

      if (currentBalance < amount) {
        throw new AppError(402, 'Insufficient credits', 'INSUFFICIENT_CREDITS');
      }

      const newBalance = currentBalance - amount;

      // Update account balance
      await client.query(
        'UPDATE credit_accounts SET balance = $1, updated_at = NOW() WHERE id = $2',
        [newBalance, account.id]
      );

      // Insert transaction record
      const txResult = await client.query(
        `INSERT INTO credit_transactions (
          id, account_id, student_id, transaction_type, amount, balance_after,
          idempotency_key, reference_type, reference_id, metadata, created_at
        ) VALUES (
          gen_random_uuid(), $1, $2, 'CONSUME', $3, $4, $5, 'ATTEMPT', $6, $7, NOW()
        ) RETURNING id`,
        [account.id, studentId, -amount, newBalance, idempotencyKey, referenceId, JSON.stringify({ reason })]
      );

      await client.query('COMMIT');

      return {
        newBalance,
        transactionId: txResult.rows[0].id,
      };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Earn/add credits to a student's account
   *
   * @param studentId - UUID of the student
   * @param amount - Number of credits to earn (must be positive)
   * @param reason - Human-readable reason (e.g., 'ATTEMPT_COMPLETED')
   * @param referenceId - UUID of the triggering entity (e.g., attempt_id)
   * @param idempotencyKey - Unique key to prevent duplicate transactions (REQUIRED)
   * @returns New balance and transaction ID
   * @throws AppError(404) if account not found
   */
  async earn(
    studentId: string,
    amount: number,
    reason: string,
    referenceId: string,
    idempotencyKey: string
  ): Promise<EarnResult> {
    // Check for existing transaction with this idempotency key
    const existingTx = await db.query(
      'SELECT id, balance_after FROM credit_transactions WHERE idempotency_key = $1',
      [idempotencyKey]
    );

    if (existingTx.rows.length > 0) {
      // Already processed - return cached result (idempotent)
      return {
        newBalance: Number(existingTx.rows[0].balance_after),
        transactionId: existingTx.rows[0].id,
      };
    }

    // Begin transaction with SELECT FOR UPDATE
    const client = await db.connect();
    try {
      await client.query('BEGIN');

      // Lock the account row
      const accountResult = await client.query(
        'SELECT id, balance FROM credit_accounts WHERE student_id = $1 FOR UPDATE',
        [studentId]
      );

      if (accountResult.rows.length === 0) {
        throw new AppError(404, 'Credit account not found', 'ACCOUNT_NOT_FOUND');
      }

      const account = accountResult.rows[0];
      const currentBalance = Number(account.balance);

      // TODO: Apply max_balance cap from credit_policies (most specific scope wins)
      // For now, no cap - will implement when credit_policies service is ready
      const newBalance = currentBalance + amount;

      // Update account balance
      await client.query(
        'UPDATE credit_accounts SET balance = $1, updated_at = NOW() WHERE id = $2',
        [newBalance, account.id]
      );

      // Insert transaction record
      const txResult = await client.query(
        `INSERT INTO credit_transactions (
          id, account_id, student_id, transaction_type, amount, balance_after,
          idempotency_key, reference_type, reference_id, metadata, created_at
        ) VALUES (
          gen_random_uuid(), $1, $2, 'EARN', $3, $4, $5, 'ATTEMPT', $6, $7, NOW()
        ) RETURNING id`,
        [account.id, studentId, amount, newBalance, idempotencyKey, referenceId, JSON.stringify({ reason })]
      );

      await client.query('COMMIT');

      return {
        newBalance,
        transactionId: txResult.rows[0].id,
      };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Get current balance for a student
   *
   * @param studentId - UUID of the student
   * @returns Current balance
   * @throws AppError(404) if account not found
   */
  async getBalance(studentId: string): Promise<number> {
    const result = await db.query(
      'SELECT balance FROM credit_accounts WHERE student_id = $1',
      [studentId]
    );

    if (result.rows.length === 0) {
      throw new AppError(404, 'Credit account not found', 'ACCOUNT_NOT_FOUND');
    }

    return Number(result.rows[0].balance);
  }
}

export const creditService = new CreditService();
