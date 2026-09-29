import { AppError } from '../../shared/errors/AppError';
import { eventBus } from '../../shared/events/eventBus';
import { Events } from '../../shared/events/events';
import { checklistRepository } from './checklist.repository';
import { progressRepository } from './progress.repository';
import {
  ChecklistProgress,
  ChecklistProgressWithItem,
  ChecklistProgressStatus,
} from './progress.types';

/**
 * ChecklistProgressService - Manages student progress on checklist items
 *
 * Responsibilities:
 * - Toggle item completion status
 * - Track scores
 * - Emit CHECKLIST_ITEM_TOGGLED events
 * - Determine if mentor verification is required
 *
 * DESIGN DECISION: Items in 'SKILLS' category require mentor verification.
 * This is configurable via the category field since there's no explicit
 * 'requires_mentor_verification' boolean in the schema.
 */
export class ProgressService {
  /**
   * Categories that require mentor verification
   * NEEDS-CONFIRMATION: Current default is 'SKILLS' category
   */
  private readonly VERIFICATION_REQUIRED_CATEGORIES = ['SKILLS'];

  /**
   * Get all progress for a student
   */
  async getStudentProgress(studentId: string): Promise<ChecklistProgressWithItem[]> {
    return progressRepository.findByStudent(studentId);
  }

  /**
   * Toggle a checklist item for a student
   *
   * Rules:
   * - If item category requires mentor verification (e.g., SKILLS),
   *   set status to IN_PROGRESS and create a pending verification request
   * - Otherwise, toggle between PENDING and COMPLETED
   * - Emits CHECKLIST_ITEM_TOGGLED event
   *
   * @param studentId - UUID of the student
   * @param checklistItemId - UUID of the checklist item
   * @param userId - UUID of the user performing the action (for events)
   * @returns Updated progress record
   */
  async toggleItem(
    studentId: string,
    checklistItemId: string,
    userId: string
  ): Promise<ChecklistProgress> {
    // Get the checklist item to check category
    const item = await checklistRepository.findById(checklistItemId);
    if (!item) {
      throw new AppError(404, 'Checklist item not found', 'ITEM_NOT_FOUND');
    }

    if (!item.is_active) {
      throw new AppError(400, 'Cannot toggle inactive checklist item', 'ITEM_INACTIVE');
    }

    // Get current progress if exists
    const currentProgress = await progressRepository.findByStudentAndItem(
      studentId,
      checklistItemId
    );

    // Determine new status
    let newStatus: string;
    const requiresVerification = this.VERIFICATION_REQUIRED_CATEGORIES.includes(item.category);

    if (!currentProgress || currentProgress.status === 'PENDING') {
      // Toggling to "complete"
      if (requiresVerification) {
        newStatus = ChecklistProgressStatus.IN_PROGRESS;
        // TODO: Create mentor_verifications entry when VerificationService is implemented
        // await verificationService.createVerificationRequest(studentId, checklistItemId);
      } else {
        newStatus = ChecklistProgressStatus.COMPLETED;
      }
    } else if (currentProgress.status === 'COMPLETED' || currentProgress.status === 'IN_PROGRESS') {
      // Toggling back to "not complete"
      newStatus = ChecklistProgressStatus.PENDING;
    } else {
      // If FAILED, allow retry
      newStatus = requiresVerification
        ? ChecklistProgressStatus.IN_PROGRESS
        : ChecklistProgressStatus.COMPLETED;
    }

    // Upsert progress record
    const progress = await progressRepository.upsert(
      studentId,
      checklistItemId,
      newStatus as any,
      item.max_score,
      item.max_score
    );

    // Emit event
    eventBus.emit(Events.CHECKLIST_ITEM_TOGGLED, {
      studentId,
      itemId: checklistItemId,
      isCompleted: newStatus === ChecklistProgressStatus.COMPLETED,
      toggledBy: userId,
    });

    // Trigger eligibility recalculation
    const { eligibilityService } = await import('../placement/eligibility.service');
    await eligibilityService.recalculate(studentId).catch((err) => {
      console.error('[progress] Failed to recalculate eligibility:', err);
    });

    return progress;
  }

  /**
   * Update score for a checklist item
   * (Called after manual grading or automated evaluation)
   */
  async updateScore(
    studentId: string,
    checklistItemId: string,
    score: number
  ): Promise<ChecklistProgress> {
    const item = await checklistRepository.findById(checklistItemId);
    if (!item) {
      throw new AppError(404, 'Checklist item not found', 'ITEM_NOT_FOUND');
    }

    if (score < 0 || score > item.max_score) {
      throw new AppError(
        400,
        `Score must be between 0 and ${item.max_score}`,
        'INVALID_SCORE'
      );
    }

    // Determine status based on score
    const passingScore = item.max_score * 0.6; // 60% passing threshold
    const status = score >= passingScore
      ? ChecklistProgressStatus.COMPLETED
      : ChecklistProgressStatus.FAILED;

    const progress = await progressRepository.upsert(
      studentId,
      checklistItemId,
      status,
      score,
      item.max_score
    );

    return progress;
  }

  /**
   * Get completion percentage for a student
   * (Required items only)
   */
  async getCompletionPercentage(studentId: string, programId: string): Promise<number> {
    const completed = await progressRepository.countCompletedRequired(studentId, programId);
    const total = await progressRepository.countTotalRequired(programId);

    if (total === 0) {
      return 100; // No required items = 100% complete
    }

    return (completed / total) * 100;
  }
}

export const progressService = new ProgressService();
