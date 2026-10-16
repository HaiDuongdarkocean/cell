import { DEFAULT_AI_BRIDGE_SETTINGS } from '@/shared/config/config';
import type { AiFeature, AiPromptTemplate } from '@/entities/settings';

export const PROMPT_PLACEHOLDERS = ['[WORD]', '[SENTENCE]', '[TARGET_LANG]', '[INTERFACE_LANG]'] as const;

export type PromptVars = {
  word?: string;
  sentence?: string;
  targetLang?: string;
  interfaceLang?: string;
};

export const DEFAULT_PROMPTS: Record<AiFeature, AiPromptTemplate> = DEFAULT_AI_BRIDGE_SETTINGS.prompts;

const VAR_BY_PLACEHOLDER: Record<string, keyof PromptVars> = {
  '[WORD]': 'word',
  '[SENTENCE]': 'sentence',
  '[TARGET_LANG]': 'targetLang',
  '[INTERFACE_LANG]': 'interfaceLang',
};

// Digits included so renamed placeholders like [WORD2] are still caught by validation.
const PLACEHOLDER_RE = /\[([A-Z0-9_]+)\]/g;

export function fillPrompt(template: string, vars: PromptVars): string {
  return template.replace(PLACEHOLDER_RE, (token) => {
    const varKey = VAR_BY_PLACEHOLDER[token];
    const value = varKey === undefined ? undefined : vars[varKey];
    return value === undefined ? token : value;
  });
}

export function validatePromptPlaceholders(
  text: string,
): { ok: true } | { ok: false; invalid: string[] } {
  const known = new Set<string>(PROMPT_PLACEHOLDERS);
  const invalid = new Set<string>();
  for (const match of text.matchAll(PLACEHOLDER_RE)) {
    if (!known.has(match[0])) invalid.add(match[0]);
  }
  return invalid.size === 0 ? { ok: true } : { ok: false, invalid: [...invalid] };
}

export function composePrompt(
  feature: AiFeature,
  prompts: Record<AiFeature, AiPromptTemplate>,
  vars: PromptVars,
): string {
  const template = prompts[feature];
  return fillPrompt(`${template.system}\n\n${template.user}`, vars);
}
