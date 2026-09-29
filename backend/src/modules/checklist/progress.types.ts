/**
 * Checklist progress status types
 */
export const ChecklistProgressStatus = {
  PENDING: 'PENDING',
  IN_PROGRESS: 'IN_PROGRESS',
  COMPLETED: 'COMPLETED',
  FAILED: 'FAILED',
} as const;

export type ChecklistProgressStatusType = typeof ChecklistProgressStatus[keyof typeof ChecklistProgressStatus];

/**
 * Database checklist progress record
 */
export interface ChecklistProgress {
  id: string;
  student_id: string;
  checklist_item_id: string;
  status: ChecklistProgressStatusType;
  score: number | null;
  max_score: number | null;
  completed_at: Date | null;
  updated_at: Date;
}

/**
 * Checklist progress with item details (joined)
 */
export interface ChecklistProgressWithItem {
  id: string;
  student_id: string;
  checklist_item_id: string;
  status: ChecklistProgressStatusType;
  score: number | null;
  max_score: number | null;
  completed_at: Date | null;
  updated_at: Date;
  item_name: string;
  item_description: string | null;
  item_category: string;
  item_is_required: boolean;
  item_weight: number;
}
