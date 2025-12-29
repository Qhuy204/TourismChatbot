import { z } from 'zod';
import { DatasetRecord } from '@/types/dataset';

/**
 * Maximum allowed size for a single record's JSONB data (100KB)
 */
const MAX_RECORD_SIZE_BYTES = 100 * 1024;

/**
 * Minimal schema for validating essential DatasetRecord fields.
 * Uses passthrough to allow additional fields required by the type.
 * More lenient to accept various input formats.
 */
const datasetRecordSchema = z.object({
  id: z.union([z.string(), z.number()]).transform(v => String(v)),
  status: z.enum(['pending', 'approved', 'rejected', 'needs_review']).optional(),
  timestamp: z.string().optional(),
  paths: z.object({
    image: z.string().optional(),
    audio_evidence: z.string().optional(),
  }).passthrough().optional(),
  metadata: z.object({
    landmark_name: z.string().max(5000, 'Landmark name too long').optional(),
  }).passthrough().optional(),
  qa_pairs: z.array(z.object({
    q: z.string().optional(),
    a: z.string().optional(),
    type: z.string().optional(),
  }).passthrough()).max(500, 'Too many QA pairs').optional(),
}).passthrough();

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  sanitizedRecord?: DatasetRecord;
}

/**
 * Validates and sanitizes a dataset record before database insertion.
 * @param record The record to validate
 * @returns Validation result with sanitized record if valid
 */
export function validateDatasetRecord(record: unknown): ValidationResult {
  const errors: string[] = [];

  // Check if record is an object
  if (!record || typeof record !== 'object') {
    return { valid: false, errors: ['Record must be an object'] };
  }

  // Check record size (approximate)
  const recordSize = new Blob([JSON.stringify(record)]).size;
  if (recordSize > MAX_RECORD_SIZE_BYTES) {
    errors.push(`Record size (${Math.round(recordSize / 1024)}KB) exceeds maximum allowed (${MAX_RECORD_SIZE_BYTES / 1024}KB)`);
  }

  // Validate against schema
  const result = datasetRecordSchema.safeParse(record);
  
  if (!result.success) {
    result.error.errors.forEach(err => {
      errors.push(`${err.path.join('.')}: ${err.message}`);
    });
    return { valid: false, errors };
  }

  // If size error exists, still return invalid
  if (errors.length > 0) {
    return { valid: false, errors };
  }

  // Cast through unknown since passthrough allows all original fields
  return { 
    valid: true, 
    errors: [], 
    sanitizedRecord: result.data as unknown as DatasetRecord 
  };
}

/**
 * Validates a batch of dataset records.
 * @param records Array of records to validate
 * @returns Object with valid records and error summary
 */
export function validateDatasetRecords(records: unknown[]): {
  validRecords: DatasetRecord[];
  invalidCount: number;
  errors: Array<{ index: number; errors: string[] }>;
} {
  const validRecords: DatasetRecord[] = [];
  const errors: Array<{ index: number; errors: string[] }> = [];

  records.forEach((record, index) => {
    const result = validateDatasetRecord(record);
    if (result.valid && result.sanitizedRecord) {
      validRecords.push(result.sanitizedRecord);
    } else {
      errors.push({ index, errors: result.errors });
    }
  });

  return {
    validRecords,
    invalidCount: errors.length,
    errors: errors.slice(0, 10), // Only return first 10 errors to avoid huge payloads
  };
}

/**
 * Sanitizes a string by removing potentially dangerous characters.
 * Use for display purposes after validation.
 */
export function sanitizeString(input: string, maxLength = 1000): string {
  if (!input || typeof input !== 'string') return '';
  
  return input
    .slice(0, maxLength)
    .replace(/[<>]/g, '') // Remove basic HTML chars
    .trim();
}
