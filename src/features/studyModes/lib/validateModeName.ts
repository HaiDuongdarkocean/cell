import type { StudyMode } from '@/entities/studyMode';

export interface ModeNameValidation {
  valid: boolean;
  error?: string;
}

export function validateModeName(
  name: string,
  existingModes: readonly StudyMode[],
  excludeId?: string,
): ModeNameValidation {
  const trimmed = name.trim();
  if (trimmed.length === 0) {
    return { valid: false, error: 'Name is required' };
  }
  if (trimmed.length > 50) {
    return { valid: false, error: 'Name must be 50 characters or less' };
  }
  const duplicate = existingModes.find(
    (m) => m.id !== excludeId && m.title.trim().toLowerCase() === trimmed.toLowerCase(),
  );
  if (duplicate) {
    return { valid: false, error: 'Name already exists' };
  }
  return { valid: true };
}
