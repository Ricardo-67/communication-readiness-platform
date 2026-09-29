/**
 * Database placement eligibility record
 */
export interface PlacementEligibility {
  id: string;
  student_id: string;
  total_score: number;
  maximum_score: number;
  threshold_score: number;
  is_eligible: boolean;
  evaluated_at: Date | null;
  updated_at: Date;
  reason: string | null;
}

/**
 * Configuration for eligibility calculation
 * NEEDS-CONFIRMATION: These weights are defaults and should be configurable
 */
export interface EligibilityConfig {
  checklistWeight: number; // Weight for checklist completion (0-1)
  performanceWeight: number; // Weight for performance score (0-1)
  thresholdScore: number; // Minimum total_score required for eligibility
  requireAllChecklist: boolean; // Require 100% checklist completion
}

/**
 * Default eligibility configuration
 */
export const DEFAULT_ELIGIBILITY_CONFIG: EligibilityConfig = {
  checklistWeight: 0.4, // 40% weight
  performanceWeight: 0.6, // 60% weight
  thresholdScore: 60.0, // 60% minimum
  requireAllChecklist: true, // All required items must be completed
};
