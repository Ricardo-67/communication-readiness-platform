import { AppError } from '../../shared/errors/AppError';
import { eligibilityRepository } from './eligibility.repository';
import {
  PlacementEligibility,
  EligibilityConfig,
  DEFAULT_ELIGIBILITY_CONFIG,
} from './eligibility.types';

/**
 * EligibilityService - Calculates placement eligibility
 *
 * Scoring Model:
 * total_score = (checklist_completion_pct * checklistWeight) + (performance_score * performanceWeight)
 *
 * Eligibility Rules:
 * 1. All required checklist items must be COMPLETED
 * 2. total_score >= threshold_score
 *
 * NEEDS-CONFIRMATION: Weights and thresholds are configurable via DEFAULT_ELIGIBILITY_CONFIG
 */
export class EligibilityService {
  private config: EligibilityConfig = DEFAULT_ELIGIBILITY_CONFIG;

  /**
   * Recalculate placement eligibility for a student
   *
   * This is called:
   * - After assessment completion (via ATTEMPT_COMPLETED event)
   * - After checklist item toggle (via CHECKLIST_ITEM_TOGGLED event)
   * - After mentor verification (via MENTOR_VERIFIED event)
   * - Manually by admin
   */
  async recalculate(studentId: string): Promise<PlacementEligibility> {
    // Get student's program and subdivision for checklist scoping
    const scope = await eligibilityRepository.getStudentScope(studentId);
    if (!scope) {
      throw new AppError(404, 'Student not found', 'STUDENT_NOT_FOUND');
    }

    const { programId } = scope;

    // 1. Calculate checklist completion percentage
    const completedRequired = await eligibilityRepository.countCompletedRequired(
      studentId,
      programId
    );
    const totalRequired = await eligibilityRepository.countTotalRequired(programId);

    const checklistCompletionPct = totalRequired > 0 ? (completedRequired / totalRequired) * 100 : 100;

    // 2. Get performance score from M3's performance_profiles table
    const performanceScore = await eligibilityRepository.getPerformanceScore(studentId) ?? 0;

    // 3. Calculate weighted total score
    // Formula: total_score = (checklist * 0.4) + (performance * 0.6)
    // Both are on a 0-100 scale
    const totalScore =
      (checklistCompletionPct * this.config.checklistWeight) +
      (performanceScore * this.config.performanceWeight);

    const maximumScore = 100; // Both components are 0-100

    // 4. Determine eligibility
    let isEligible = true;
    const reasons: string[] = [];

    // Rule 1: All required checklist items must be completed
    if (this.config.requireAllChecklist && completedRequired < totalRequired) {
      isEligible = false;
      const incompleteItems = await eligibilityRepository.getIncompleteRequiredItems(
        studentId,
        programId
      );
      if (incompleteItems.length > 0) {
        reasons.push(
          `Incomplete required checklist items (${completedRequired}/${totalRequired}): ${incompleteItems.slice(0, 3).join(', ')}${incompleteItems.length > 3 ? `, and ${incompleteItems.length - 3} more` : ''}`
        );
      } else {
        reasons.push(
          `Incomplete required checklist items (${completedRequired}/${totalRequired})`
        );
      }
    }

    // Rule 2: Total score must meet threshold
    if (totalScore < this.config.thresholdScore) {
      isEligible = false;
      reasons.push(
        `Total score below threshold (current: ${totalScore.toFixed(1)}, minimum: ${this.config.thresholdScore})`
      );
    }

    // Build reason text
    const reason = isEligible
      ? null
      : reasons.join('. ');

    // 5. Upsert eligibility record
    return eligibilityRepository.upsert(
      studentId,
      totalScore,
      maximumScore,
      this.config.thresholdScore,
      isEligible,
      reason
    );
  }

  /**
   * Get eligibility for a student
   */
  async getEligibility(studentId: string): Promise<PlacementEligibility | null> {
    return eligibilityRepository.findByStudentId(studentId);
  }

  /**
   * Get all eligible students
   */
  async getEligibleStudents(): Promise<PlacementEligibility[]> {
    return eligibilityRepository.findEligible();
  }

  /**
   * Update configuration
   * (Can be called by admin to adjust weights/thresholds)
   */
  setConfig(config: Partial<EligibilityConfig>): void {
    this.config = { ...this.config, ...config };

    // Validate weights sum to 1.0
    if (this.config.checklistWeight + this.config.performanceWeight !== 1.0) {
      throw new AppError(
        400,
        'Checklist and performance weights must sum to 1.0',
        'INVALID_WEIGHTS'
      );
    }
  }

  /**
   * Get current configuration
   */
  getConfig(): EligibilityConfig {
    return { ...this.config };
  }
}

export const eligibilityService = new EligibilityService();
