import type { CleanupRulesSetting, LocalizedError, SubtitleCleanupRule } from './types';
import type { MessageKey } from '@/shared/i18n';

export const MAX_CUSTOM_RULES = 50;
export const MAX_RULE_PATTERN_LENGTH = 500;
export const MAX_RULE_NAME_LENGTH = 80;

const MUSIC_GLYPHS = '♪♫♩♬♭♮𝄞𝄢𝄡🎵🎶🎤🎧';

function builtin(id: string, name: string, description: string, pattern: string, repeatUntilStable = false): SubtitleCleanupRule {
  return {
    id,
    name,
    description,
    nameKey: `cleanupRules.${id}.name` as MessageKey,
    descriptionKey: `cleanupRules.${id}.desc` as MessageKey,
    pattern,
    enabled: true,
    builtin: true,
    ...(repeatUntilStable ? { repeatUntilStable: true } : {}),
  };
}

export const BUILTIN_CLEANUP_RULES: readonly SubtitleCleanupRule[] = [
  builtin('html-tags', 'Markup tags', 'Residual markup like <i> or <font>', '<[^>]+>'),
  builtin('brackets', 'Bracketed annotations', 'Text inside ( ), [ ], { }', '\\([^()]*\\)|\\[[^\\[\\]]*\\]|\\{[^{}]*\\}', true),
  builtin('bracket-orphans', 'Unclosed brackets', 'An opening bracket with no matching close', '\\((?![^(]*\\))|\\[(?![^\\[]*\\])|\\{(?![^{]*\\})'),
  builtin('speaker-label', 'Speaker labels', 'Labels like -OWNER: or MAN 1: at line start', "^\\s*[-–—―]?\\s*[A-ZÀ-Þ][A-ZÀ-Þ0-9 .,'&()_-]{1,39}:"),
  builtin('speaker-chevrons', 'Chevron markers', '>> or >>> speaker-change markers at line start', '^\\s*>+\\s*'),
  builtin('dialogue-dash', 'Dialogue dashes', 'A leading dash marking a new speaker', '^\\s*[-–—―]+[ \\t]*'),
  builtin('trailing-dash', 'Orphan trailing dashes', 'A dash left dangling at line end', '[ \\t]*[-–—―]+[ \\t]*$'),
  builtin('music-wrapped', 'Music-wrapped lines', 'Whole lines wrapped in note glyphs like ♪ theme ♪', `^[ \\t]*[${MUSIC_GLYPHS}]+[^${MUSIC_GLYPHS}\\n]*[${MUSIC_GLYPHS}]+[ \\t]*$`),
  builtin('music-glyphs', 'Music glyphs', 'Stray note and music symbols', `[${MUSIC_GLYPHS}]+`),
  builtin('control-glyphs', 'Invisible marks', 'Zero-width and bidi control characters', '[\\u200B-\\u200F\\u202A-\\u202E\\uFEFF]'),
];

export const DEFAULT_CLEANUP_RULES_SETTING: CleanupRulesSetting = {
  builtinEnabled: {},
  custom: [],
};

export interface ResolvedCleanupRule extends SubtitleCleanupRule {
  readonly regex: RegExp | null;
}

function compileRule(pattern: string): RegExp | null {
  try {
    return new RegExp(pattern, 'gmu');
  } catch {
    return null;
  }
}

export function resolveCleanupRules(setting: CleanupRulesSetting | undefined): ResolvedCleanupRule[] {
  const builtinEnabled = setting?.builtinEnabled ?? {};
  const builtins = BUILTIN_CLEANUP_RULES.map((rule) => ({
    ...rule,
    enabled: builtinEnabled[rule.id] ?? rule.enabled,
    regex: compileRule(rule.pattern),
  }));
  const custom = (setting?.custom ?? [])
    .filter((rule) => !rule.builtin)
    .map((rule) => ({ ...rule, regex: compileRule(rule.pattern) }));
  return [...builtins, ...custom];
}

export function cleanupRulesFingerprint(setting: CleanupRulesSetting | undefined): string {
  return JSON.stringify(resolveCleanupRules(setting).map((r) => [r.id, r.enabled, r.pattern, r.repeatUntilStable === true]));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export function sanitizeCleanupRulesSetting(raw: unknown, legacyBracketsEnabled: boolean): CleanupRulesSetting {
  if (!isRecord(raw)) {
    return { builtinEnabled: { brackets: legacyBracketsEnabled }, custom: [] };
  }
  if (raw.builtinEnabled !== undefined && !isRecord(raw.builtinEnabled)) {
    return { builtinEnabled: { brackets: legacyBracketsEnabled }, custom: [] };
  }
  if (raw.custom !== undefined && !Array.isArray(raw.custom)) {
    return { builtinEnabled: { brackets: legacyBracketsEnabled }, custom: [] };
  }
  const builtinEnabled: Record<string, boolean> = {};
  if (isRecord(raw.builtinEnabled)) {
    for (const rule of BUILTIN_CLEANUP_RULES) {
      const value = raw.builtinEnabled[rule.id];
      if (typeof value === 'boolean') builtinEnabled[rule.id] = value;
    }
  }
  const custom: SubtitleCleanupRule[] = [];
  const seenIds = new Set<string>();
  for (const item of Array.isArray(raw.custom) ? raw.custom : []) {
    if (custom.length >= MAX_CUSTOM_RULES) break;
    if (!isRecord(item)) continue;
    if (typeof item.id !== 'string' || item.id.length === 0 || seenIds.has(item.id)) continue;
    if (typeof item.name !== 'string' || item.name.trim().length === 0 || item.name.length > MAX_RULE_NAME_LENGTH) continue;
    if (typeof item.pattern !== 'string' || item.pattern.length === 0 || item.pattern.length > MAX_RULE_PATTERN_LENGTH) continue;
    seenIds.add(item.id);
    custom.push({
      id: item.id,
      name: item.name,
      description: typeof item.description === 'string' ? item.description : '',
      pattern: item.pattern,
      enabled: typeof item.enabled === 'boolean' ? item.enabled : true,
      builtin: false,
    });
  }
  return { builtinEnabled, custom };
}

export function deriveRemoveBracketed(setting: CleanupRulesSetting | undefined): boolean {
  return setting?.builtinEnabled?.brackets ?? true;
}

export function validateCleanupPattern(pattern: string): LocalizedError | null {
  if (!pattern.trim()) return { key: 'cleanup.error.patternRequired' };
  if (pattern.length > MAX_RULE_PATTERN_LENGTH) {
    return { key: 'cleanup.error.patternTooLong', params: [MAX_RULE_PATTERN_LENGTH] };
  }
  try {
    new RegExp(pattern, 'gmu');
  } catch {
    return { key: 'cleanup.error.patternInvalid' };
  }
  return null;
}

const REPEAT_PASSES = 3;

export function applyCleanupRules(text: string, rules: readonly ResolvedCleanupRule[]): string {
  let out = text;
  for (const rule of rules) {
    if (!rule.enabled || rule.regex === null) continue;
    if (rule.repeatUntilStable) {
      for (let pass = 0; pass < REPEAT_PASSES; pass += 1) {
        const next = out.replace(rule.regex, '');
        if (next === out) break;
        out = next;
      }
    } else {
      out = out.replace(rule.regex, '');
    }
  }
  return normalizeCleanedText(out);
}

function normalizeCleanedText(text: string): string {
  return text
    .split('\n')
    .map((line) =>
      line
        .trim()
        .replace(/[ \t]{2,}/g, ' ')
        .replace(/^[,:;]+[ \t]*/, '')
        .replace(/[ \t]*[:;]+$/, '')
        .trim(),
    )
    .filter((line) => line.length > 0)
    .join('\n')
    .trim();
}
