import type { StudyMode } from '@/entities/studyMode';
import type { MessageKey } from '@/shared/i18n';

export interface ModeNameValidation {
  valid: boolean;
  errorKey?: MessageKey;
}

export function validateModeName(
  name: string,
  existingModes: readonly StudyMode[],
  excludeId?: string,
): ModeNameValidation {
  const trimmed = name.trim();
  if (trimmed.length === 0) {
    return { valid: false, errorKey: 'studyModes.builder.errorNameRequired' };
  }
  if (trimmed.length > 50) {
    return { valid: false, errorKey: 'studyModes.builder.errorNameTooLong' };
  }
  const duplicate = existingModes.find(
    (m) => m.id !== excludeId && m.title.trim().toLowerCase() === trimmed.toLowerCase(),
  );
  if (duplicate) {
    return { valid: false, errorKey: 'studyModes.builder.errorNameExists' };
  }
  return { valid: true };
}
