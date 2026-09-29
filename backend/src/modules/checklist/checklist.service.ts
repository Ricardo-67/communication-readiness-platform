import { AppError } from '../../shared/errors/AppError';
import { checklistRepository } from './checklist.repository';
import {
  ChecklistItem,
  CreateChecklistItemInput,
  UpdateChecklistItemInput,
  ChecklistItemCSVRow,
  CSVImportResult,
  ChecklistCategory,
} from './checklist.types';

/**
 * ChecklistService - Business logic for checklist items
 *
 * Responsibilities:
 * - CRUD operations for checklist items
 * - CSV bulk import
 * - Duplicate name validation
 * - Program/subdivision scoping
 */
export class ChecklistService {
  /**
   * Get all checklist items, optionally filtered by program/subdivision
   */
  async getAllItems(programId?: string, subdivisionId?: string): Promise<ChecklistItem[]> {
    return checklistRepository.findAll(programId, subdivisionId);
  }

  /**
   * Get a specific checklist item by ID
   */
  async getItemById(id: string): Promise<ChecklistItem> {
    const item = await checklistRepository.findById(id);
    if (!item) {
      throw new AppError(404, 'Checklist item not found', 'ITEM_NOT_FOUND');
    }
    return item;
  }

  /**
   * Create a new checklist item
   */
  async createItem(data: CreateChecklistItemInput): Promise<ChecklistItem> {
    // Check for duplicate name within the same program
    const exists = await checklistRepository.existsByName(data.program_id, data.name);
    if (exists) {
      throw new AppError(
        409,
        `Checklist item with name "${data.name}" already exists in this program`,
        'DUPLICATE_NAME'
      );
    }

    return checklistRepository.create(data);
  }

  /**
   * Update an existing checklist item
   */
  async updateItem(id: string, data: UpdateChecklistItemInput): Promise<ChecklistItem> {
    const existing = await checklistRepository.findById(id);
    if (!existing) {
      throw new AppError(404, 'Checklist item not found', 'ITEM_NOT_FOUND');
    }

    // Check for duplicate name if name is being updated
    if (data.name && data.name !== existing.name) {
      const exists = await checklistRepository.existsByName(
        existing.program_id,
        data.name,
        id
      );
      if (exists) {
        throw new AppError(
          409,
          `Checklist item with name "${data.name}" already exists in this program`,
          'DUPLICATE_NAME'
        );
      }
    }

    const updated = await checklistRepository.update(id, data);
    if (!updated) {
      throw new AppError(404, 'Checklist item not found', 'ITEM_NOT_FOUND');
    }

    return updated;
  }

  /**
   * Soft delete a checklist item
   */
  async deleteItem(id: string): Promise<void> {
    const deleted = await checklistRepository.softDelete(id);
    if (!deleted) {
      throw new AppError(404, 'Checklist item not found', 'ITEM_NOT_FOUND');
    }
  }

  /**
   * Import checklist items from CSV data
   *
   * CSV format:
   * name, description, category, max_score, weight, is_required
   *
   * @param programId - Program to import items into
   * @param subdivisionId - Optional subdivision scope
   * @param csvRows - Parsed CSV rows
   * @returns Import result with success/error counts
   */
  async importFromCSV(
    programId: string,
    subdivisionId: string | null,
    csvRows: ChecklistItemCSVRow[]
  ): Promise<CSVImportResult> {
    const result: CSVImportResult = {
      imported: 0,
      skipped: 0,
      errors: [],
    };

    for (let i = 0; i < csvRows.length; i++) {
      const row = csvRows[i];
      const rowNumber = i + 2; // +2 because CSV has header row and is 1-indexed

      try {
        // Validate required fields
        if (!row.name || !row.name.trim()) {
          result.errors.push({
            row: rowNumber,
            error: 'Missing required field: name',
          });
          result.skipped++;
          continue;
        }

        if (!row.category || !row.category.trim()) {
          result.errors.push({
            row: rowNumber,
            error: 'Missing required field: category',
          });
          result.skipped++;
          continue;
        }

        // Validate category
        const category = row.category.toUpperCase() as keyof typeof ChecklistCategory;
        if (!ChecklistCategory[category]) {
          result.errors.push({
            row: rowNumber,
            error: `Invalid category: ${row.category}. Must be one of: RESUME, SKILLS, ASSESSMENTS, BEHAVIOR, OTHER`,
          });
          result.skipped++;
          continue;
        }

        // Parse numeric fields with defaults
        const maxScore = row.max_score ? parseFloat(row.max_score) : 100;
        const weight = row.weight ? parseFloat(row.weight) : 1.0;

        if (isNaN(maxScore) || maxScore < 0) {
          result.errors.push({
            row: rowNumber,
            error: `Invalid max_score: ${row.max_score}. Must be a non-negative number`,
          });
          result.skipped++;
          continue;
        }

        if (isNaN(weight) || weight < 0) {
          result.errors.push({
            row: rowNumber,
            error: `Invalid weight: ${row.weight}. Must be a non-negative number`,
          });
          result.skipped++;
          continue;
        }

        // Parse boolean field
        const isRequired = row.is_required
          ? ['true', '1', 'yes', 'y'].includes(row.is_required.toLowerCase())
          : true;

        // Check for duplicate name
        const exists = await checklistRepository.existsByName(programId, row.name.trim());
        if (exists) {
          result.errors.push({
            row: rowNumber,
            error: `Duplicate name: "${row.name}" already exists in this program`,
          });
          result.skipped++;
          continue;
        }

        // Create the item
        await checklistRepository.create({
          program_id: programId,
          subdivision_id: subdivisionId,
          name: row.name.trim(),
          description: row.description?.trim(),
          category: ChecklistCategory[category],
          max_score: maxScore,
          weight: weight,
          is_required: isRequired,
          is_active: true,
        });

        result.imported++;
      } catch (error) {
        result.errors.push({
          row: rowNumber,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
        result.skipped++;
      }
    }

    return result;
  }
}

export const checklistService = new ChecklistService();
