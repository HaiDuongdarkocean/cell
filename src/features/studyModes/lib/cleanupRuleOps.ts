import type { CleanupRulesSetting, LocalizedError, SubtitleCleanupRule } from '@/entities/studyMode';
import {
  BUILTIN_CLEANUP_RULES,
  MAX_CUSTOM_RULES,
  MAX_RULE_NAME_LENGTH,
  validateCleanupPattern,
} from '@/entities/studyMode';
import { generateModeId } from './generateModeId';

export interface CleanupRuleDraft {
  name: string;
  description: string;
  pattern: string;
}

export interface CleanupRuleErrors {
  name?: LocalizedError;
  pattern?: LocalizedError;
}

function isNameTaken(setting: CleanupRulesSetting, name: string, excludeId?: string): boolean {
  const needle = name.trim().toLowerCase();
  return (
    BUILTIN_CLEANUP_RULES.some((rule) => rule.name.toLowerCase() === needle) ||
    setting.custom.some((rule) => rule.id !== excludeId && rule.name.trim().toLowerCase() === needle)
  );
}

export function validateCleanupRuleDraft(
  setting: CleanupRulesSetting,
  draft: CleanupRuleDraft,
  excludeId?: string,
): CleanupRuleErrors {
  const errors: CleanupRuleErrors = {};
  const name = draft.name.trim();
  if (!name) {
    errors.name = { key: 'cleanup.error.nameRequired' };
  } else if (name.length > MAX_RULE_NAME_LENGTH) {
    errors.name = { key: 'cleanup.error.nameTooLong', params: [MAX_RULE_NAME_LENGTH] };
  } else if (isNameTaken(setting, name, excludeId)) {
    errors.name = { key: 'cleanup.error.nameExists' };
  }
  const patternError = validateCleanupPattern(draft.pattern);
  if (patternError) errors.pattern = patternError;
  return errors;
}

export function toggleCleanupRule(setting: CleanupRulesSetting, rule: SubtitleCleanupRule): CleanupRulesSetting {
  if (rule.builtin) {
    const currentlyEnabled = setting.builtinEnabled[rule.id] ?? rule.enabled;
    return { ...setting, builtinEnabled: { ...setting.builtinEnabled, [rule.id]: !currentlyEnabled } };
  }
  return {
    ...setting,
    custom: setting.custom.map((r) => (r.id === rule.id ? { ...r, enabled: !r.enabled } : r)),
  };
}

export function addCleanupRule(
  setting: CleanupRulesSetting,
  draft: CleanupRuleDraft,
): { setting: CleanupRulesSetting; errors?: never } | { setting?: never; errors: CleanupRuleErrors & { limit?: LocalizedError } } {
  if (setting.custom.length >= MAX_CUSTOM_RULES) {
    return { errors: { limit: { key: 'cleanup.error.limit', params: [MAX_CUSTOM_RULES] } } };
  }
  const errors = validateCleanupRuleDraft(setting, draft);
  if (errors.name || errors.pattern) return { errors };
  const rule: SubtitleCleanupRule = {
    id: generateModeId(),
    name: draft.name.trim(),
    description: draft.description.trim(),
    pattern: draft.pattern,
    enabled: true,
    builtin: false,
  };
  return { setting: { ...setting, custom: [...setting.custom, rule] } };
}

export function updateCleanupRule(
  setting: CleanupRulesSetting,
  id: string,
  draft: CleanupRuleDraft,
): { setting: CleanupRulesSetting; errors?: never } | { setting?: never; errors: CleanupRuleErrors } {
  const index = setting.custom.findIndex((r) => r.id === id && !r.builtin);
  if (index === -1) return { errors: {} };
  const errors = validateCleanupRuleDraft(setting, draft, id);
  if (errors.name || errors.pattern) return { errors };
  const next = [...setting.custom];
  next[index] = {
    ...next[index],
    name: draft.name.trim(),
    description: draft.description.trim(),
    pattern: draft.pattern,
  };
  return { setting: { ...setting, custom: next } };
}

export function deleteCleanupRule(setting: CleanupRulesSetting, id: string): CleanupRulesSetting {
  return { ...setting, custom: setting.custom.filter((r) => r.id !== id) };
}
