import { AppError } from '../../shared/errors/AppError';
import { eventBus } from '../../shared/events/eventBus';
import { Events } from '../../shared/events/events';
import { db } from '../../shared/db/pool';
import { verificationRepository } from './verification.repository';
import {
  MentorVerification,
  VerificationWithDetails,
  VerificationStatus,
} from './verification.types';

/**
 * VerificationService - Manages mentor verification requests
 *
 * Responsibilities:
 * - Create verification requests
 * - Approve/reject verifications with scope guards
 * - Update linked checklist progress
 * - Emit MENTOR_VERIFIED events
 */
export class VerificationService {
  /**
   * Get pending verifications for a mentor
   */
  async getPendingForMentor(mentorUserId: string): Promise<VerificationWithDetails[]> {
    return verificationRepository.findPendingByMentor(mentorUserId);
  }

  /**
   * Approve a verification request
   *
   * Scope guard: Ensures mentor is assigned to the student
   *
   * @param verificationId - UUID of the verification
   * @param mentorUserId - UUID of the mentor approving (from req.user.id)
   * @param notes - Optional notes from mentor
   */
  async approve(
    verificationId: string,
    mentorUserId: string,
    notes?: string
  ): Promise<MentorVerification> {
    // Get verification
    const verification = await verificationRepository.findById(verificationId);
    if (!verification) {
      throw new AppError(404, 'Verification request not found', 'VERIFICATION_NOT_FOUND');
    }

    // Scope guard: Check if mentor is assigned to this student
    const isAssigned = await verificationRepository.isMentorAssignedToStudent(
      mentorUserId,
      verification.student_id
    );

    if (!isAssigned) {
      throw new AppError(
        403,
        'You are not assigned as mentor to this student',
        'FORBIDDEN'
      );
    }

    // Check if already verified or rejected
    if (verification.status !== VerificationStatus.PENDING) {
      throw new AppError(
        409,
        `Verification already ${verification.status.toLowerCase()}`,
        'ALREADY_PROCESSED'
      );
    }

    // Begin transaction
    const client = await db.connect();
    try {
      await client.query('BEGIN');

      // Update verification status
      await client.query(
        `UPDATE mentor_verifications
         SET status = 'VERIFIED', notes = $2, verified_at = NOW(), updated_at = NOW()
         WHERE id = $1`,
        [verificationId, notes || null]
      );

      // If this is a checklist verification, mark the progress as COMPLETED
      if (
        verification.verification_type === 'CHECKLIST' &&
        verification.checklist_progress_id
      ) {
        await client.query(
          `UPDATE checklist_progress
           SET status = 'COMPLETED', completed_at = NOW(), updated_at = NOW()
           WHERE id = $1`,
          [verification.checklist_progress_id]
        );
      }

      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }

    // Get updated verification
    const updated = await verificationRepository.findById(verificationId);
    if (!updated) {
      throw new AppError(500, 'Failed to retrieve updated verification', 'INTERNAL_ERROR');
    }

    // Emit event
    eventBus.emit(Events.MENTOR_VERIFIED, {
      studentId: verification.student_id,
      mentorId: mentorUserId,
      verifiedAt: new Date().toISOString(),
    });

    // Trigger eligibility recalculation
    const { eligibilityService } = await import('../placement/eligibility.service');
    await eligibilityService.recalculate(verification.student_id).catch((err) => {
      console.error('[verification] Failed to recalculate eligibility:', err);
    });

    return updated;
  }

  /**
   * Reject a verification request
   *
   * Scope guard: Ensures mentor is assigned to the student
   *
   * @param verificationId - UUID of the verification
   * @param mentorUserId - UUID of the mentor rejecting (from req.user.id)
   * @param notes - Reason for rejection (required)
   */
  async reject(
    verificationId: string,
    mentorUserId: string,
    notes: string
  ): Promise<MentorVerification> {
    if (!notes || !notes.trim()) {
      throw new AppError(400, 'Rejection reason is required', 'NOTES_REQUIRED');
    }

    // Get verification
    const verification = await verificationRepository.findById(verificationId);
    if (!verification) {
      throw new AppError(404, 'Verification request not found', 'VERIFICATION_NOT_FOUND');
    }

    // Scope guard: Check if mentor is assigned to this student
    const isAssigned = await verificationRepository.isMentorAssignedToStudent(
      mentorUserId,
      verification.student_id
    );

    if (!isAssigned) {
      throw new AppError(
        403,
        'You are not assigned as mentor to this student',
        'FORBIDDEN'
      );
    }

    // Check if already verified or rejected
    if (verification.status !== VerificationStatus.PENDING) {
      throw new AppError(
        409,
        `Verification already ${verification.status.toLowerCase()}`,
        'ALREADY_PROCESSED'
      );
    }

    // Update verification status
    const updated = await verificationRepository.updateStatus(
      verificationId,
      VerificationStatus.REJECTED,
      notes
    );

    if (!updated) {
      throw new AppError(500, 'Failed to update verification', 'INTERNAL_ERROR');
    }

    // Emit event
    eventBus.emit(Events.MENTOR_VERIFIED, {
      studentId: verification.student_id,
      mentorId: mentorUserId,
      verifiedAt: new Date().toISOString(),
    });

    return updated;
  }

  /**
   * Create a verification request
   * (Called by student when requesting mentor sign-off)
   */
  async createRequest(
    studentId: string,
    checklistProgressId?: string
  ): Promise<MentorVerification> {
    // Get assigned mentor for this student
    const mentorUserId = await verificationRepository.getMentorForStudent(studentId);
    if (!mentorUserId) {
      throw new AppError(404, 'No mentor assigned to this student', 'MENTOR_NOT_FOUND');
    }

    return verificationRepository.create(
      studentId,
      mentorUserId,
      checklistProgressId ? 'CHECKLIST' : 'PROFILE',
      checklistProgressId
    );
  }
}

export const verificationService = new VerificationService();
