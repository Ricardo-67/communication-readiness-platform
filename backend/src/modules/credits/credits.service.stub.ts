import { ConsumeResult, EarnResult } from './credits.service';

/**
 * CreditServiceStub - Stub implementation for testing and development
 *
 * PURPOSE: This stub allows Member 2 (Assessment module) to build and test
 * POST /api/attempts/start WITHOUT waiting for:
 * - Database migrations to be run
 * - Real CreditService implementation to be complete
 *
 * USAGE:
 * ```typescript
 * import { creditServiceStub as creditService } from './credits.service.stub';
 * const result = await creditService.consume(studentId, 10, 'ASSESSMENT_START', attemptId, idempotencyKey);
 * ```
 *
 * IMPORTANT: This stub does NOT access the database. It returns hardcoded values.
 * Replace with the real CreditService once migrations are run.
 *
 * NOTE: idempotencyKey is REQUIRED in both stub and real service because
 * credit_transactions.idempotency_key has a UNIQUE NOT NULL constraint in the schema.
 */
export class CreditServiceStub {
  private stubBalance = 50; // Fake balance for testing

  /**
   * Stub implementation of consume()
   * Always succeeds and returns a fake transaction ID
   */
  async consume(
    studentId: string,
    amount: number,
    reason: string,
    referenceId: string,
    idempotencyKey: string
  ): Promise<ConsumeResult> {
    // Simulate balance check (but don't actually fail)
    this.stubBalance -= amount;

    return {
      newBalance: this.stubBalance,
      transactionId: `stub-consume-${Date.now()}`,
    };
  }

  /**
   * Stub implementation of earn()
   * Always succeeds and returns a fake transaction ID
   */
  async earn(
    studentId: string,
    amount: number,
    reason: string,
    referenceId: string,
    idempotencyKey: string
  ): Promise<EarnResult> {
    this.stubBalance += amount;

    return {
      newBalance: this.stubBalance,
      transactionId: `stub-earn-${Date.now()}`,
    };
  }

  /**
   * Stub implementation of getBalance()
   * Always returns the fake in-memory balance
   */
  async getBalance(studentId: string): Promise<number> {
    return this.stubBalance;
  }
}

export const creditServiceStub = new CreditServiceStub();
