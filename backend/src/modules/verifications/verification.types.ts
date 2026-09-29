/**
 * Verification type
 */
export const VerificationType = {
  PROFILE: 'PROFILE',
  CHECKLIST: 'CHECKLIST',
} as const;

export type VerificationTypeType = typeof VerificationType[keyof typeof VerificationType];

/**
 * Verification status
 */
export const VerificationStatus = {
  PENDING: 'PENDING',
  VERIFIED: 'VERIFIED',
  REJECTED: 'REJECTED',
} as const;

export type VerificationStatusType = typeof VerificationStatus[keyof typeof VerificationStatus];

/**
 * Database mentor verification record
 */
export interface MentorVerification {
  id: string;
  student_id: string;
  mentor_user_id: string;
  verification_type: VerificationTypeType;
  checklist_progress_id: string | null;
  status: VerificationStatusType;
  notes: string | null;
  verified_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

/**
 * Verification with student and checklist item details (joined)
 */
export interface VerificationWithDetails {
  id: string;
  student_id: string;
  student_name: string;
  student_roll_number: string;
  mentor_user_id: string;
  verification_type: VerificationTypeType;
  checklist_progress_id: string | null;
  checklist_item_name: string | null;
  status: VerificationStatusType;
  notes: string | null;
  verified_at: Date | null;
  created_at: Date;
  updated_at: Date;
}
