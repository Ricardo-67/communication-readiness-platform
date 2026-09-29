import { z } from 'zod';

/**
 * Checklist item category types
 */
export const ChecklistCategory = {
  RESUME: 'RESUME',
  SKILLS: 'SKILLS',
  ASSESSMENTS: 'ASSESSMENTS',
  BEHAVIOR: 'BEHAVIOR',
  OTHER: 'OTHER',
} as const;

export type ChecklistCategoryType = typeof ChecklistCategory[keyof typeof ChecklistCategory];

/**
 * Database checklist item
 */
export interface ChecklistItem {
  id: string;
  program_id: string;
  subdivision_id: string | null;
  name: string;
  description: string | null;
  category: ChecklistCategoryType;
  max_score: number;
  weight: number;
  is_required: boolean;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

/**
 * Validation schema for creating a checklist item
 */
export const createChecklistItemSchema = z.object({
  program_id: z.string().uuid(),
  subdivision_id: z.string().uuid().nullable().optional(),
  name: z.string().min(1).max(255),
  description: z.string().optional(),
  category: z.enum(['RESUME', 'SKILLS', 'ASSESSMENTS', 'BEHAVIOR', 'OTHER']),
  max_score: z.number().min(0).default(100),
  weight: z.number().min(0).default(1.0),
  is_required: z.boolean().default(true),
  is_active: z.boolean().default(true),
});

/**
 * Validation schema for updating a checklist item
 */
export const updateChecklistItemSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().optional(),
  category: z.enum(['RESUME', 'SKILLS', 'ASSESSMENTS', 'BEHAVIOR', 'OTHER']).optional(),
  max_score: z.number().min(0).optional(),
  weight: z.number().min(0).optional(),
  is_required: z.boolean().optional(),
  is_active: z.boolean().optional(),
});

/**
 * CSV row format for bulk import
 */
export interface ChecklistItemCSVRow {
  name: string;
  description?: string;
  category: string;
  max_score?: string;
  weight?: string;
  is_required?: string;
}

/**
 * CSV import result
 */
export interface CSVImportResult {
  imported: number;
  skipped: number;
  errors: Array<{
    row: number;
    error: string;
  }>;
}

export type CreateChecklistItemInput = z.infer<typeof createChecklistItemSchema>;
export type UpdateChecklistItemInput = z.infer<typeof updateChecklistItemSchema>;
