import { Response } from 'express';
import { AuthRequest } from '../../middleware/authenticate';
import { creditService } from './credits.service';
import { AppError } from '../../shared/errors/AppError';
import { db } from '../../shared/db/pool';

/**
 * Credits Controller
 * Handles HTTP requests for credit operations
 */
export class CreditsController {
  /**
   * GET /api/credits/balance/:studentId
   * Get credit balance for a student
   */
  async getBalance(req: AuthRequest, res: Response): Promise<void> {
    const { studentId } = req.params;
    const user = req.user!;

    // Scope check: Student can only view own balance
    if (user.role === 'STUDENT') {
      const studentResult = await db.query(
        'SELECT id FROM org.students WHERE user_id = $1',
        [user.id]
      );
      if (studentResult.rows.length === 0 || studentResult.rows[0].id !== studentId) {
        throw new AppError(403, 'You can only view your own credit balance', 'FORBIDDEN');
      }
    }

    const balance = await creditService.getBalance(studentId);

    // Get account details
    const accountResult = await db.query(
      'SELECT id, balance, created_at, updated_at FROM credit_accounts WHERE student_id = $1',
      [studentId]
    );

    if (accountResult.rows.length === 0) {
      throw new AppError(404, 'Credit account not found', 'ACCOUNT_NOT_FOUND');
    }

    const account = accountResult.rows[0];

    res.json({
      data: {
        balance: Number(account.balance),
        accountId: account.id,
        createdAt: account.created_at,
        updatedAt: account.updated_at,
      },
    });
  }

  /**
   * GET /api/credits/transactions/:studentId
   * Get transaction history for a student
   */
  async getTransactions(req: AuthRequest, res: Response): Promise<void> {
    const { studentId } = req.params;
    const user = req.user!;
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = parseInt(req.query.offset as string) || 0;

    // Scope check: Student can only view own transactions
    if (user.role === 'STUDENT') {
      const studentResult = await db.query(
        'SELECT id FROM org.students WHERE user_id = $1',
        [user.id]
      );
      if (studentResult.rows.length === 0 || studentResult.rows[0].id !== studentId) {
        throw new AppError(403, 'You can only view your own transactions', 'FORBIDDEN');
      }
    }

    const result = await db.query(
      `SELECT
        id, transaction_type, amount, balance_after,
        reference_type, reference_id, metadata, created_at
       FROM credit_transactions
       WHERE student_id = $1
       ORDER BY created_at DESC
       LIMIT $2 OFFSET $3`,
      [studentId, limit, offset]
    );

    const countResult = await db.query(
      'SELECT COUNT(*) as total FROM credit_transactions WHERE student_id = $1',
      [studentId]
    );

    res.json({
      data: {
        transactions: result.rows.map((row) => ({
          id: row.id,
          type: row.transaction_type,
          amount: Number(row.amount),
          balanceAfter: Number(row.balance_after),
          referenceType: row.reference_type,
          referenceId: row.reference_id,
          metadata: row.metadata,
          createdAt: row.created_at,
        })),
        pagination: {
          total: parseInt(countResult.rows[0].total, 10),
          limit,
          offset,
        },
      },
    });
  }
}

export const creditsController = new CreditsController();
