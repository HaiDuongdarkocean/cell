import { describe, it, expect } from '@jest/globals';
import {
  addCleanupRule,
  deleteCleanupRule,
  toggleCleanupRule,
  updateCleanupRule,
  validateCleanupRuleDraft,
} from './cleanupRuleOps';
import { DEFAULT_CLEANUP_RULES_SETTING } from '@/entities/studyMode';
import type { CleanupRulesSetting, SubtitleCleanupRule } from '@/entities/studyMode';

const customRule = (over: Partial<SubtitleCleanupRule> = {}): SubtitleCleanupRule => ({
  id: 'custom-1',
  name: 'Fansub credits',
  description: 'remove fansub lines',
  pattern: 'fansub',
  enabled: true,
  builtin: false,
  ...over,
});

const withCustom = (rules: SubtitleCleanupRule[]): CleanupRulesSetting => ({
  builtinEnabled: {},
  custom: rules,
});

describe('validateCleanupRuleDraft', () => {
  it('rejects empty names, oversized names, and name collisions with builtins or customs', () => {
    const setting = withCustom([customRule()]);
    expect(validateCleanupRuleDraft(setting, { name: '  ', description: '', pattern: 'x', replacement: '' }).name).toBeTruthy();
    expect(
      validateCleanupRuleDraft(setting, { name: 'a'.repeat(81), description: '', pattern: 'x', replacement: '' }).name,
    ).toBeTruthy();
    expect(
      validateCleanupRuleDraft(setting, { name: 'Bracketed annotations', description: '', pattern: 'x', replacement: '' }).name,
    ).toBeTruthy();
    expect(
      validateCleanupRuleDraft(setting, { name: 'fansub CREDITS', description: '', pattern: 'x', replacement: '' }).name,
    ).toBeTruthy();
    expect(
      validateCleanupRuleDraft(setting, { name: 'fansub credits', description: '', pattern: 'x', replacement: '' }, 'custom-1').name,
    ).toBeUndefined();
  });

  it('rejects empty, oversized, and invalid regex patterns', () => {
    const setting = DEFAULT_CLEANUP_RULES_SETTING;
    expect(validateCleanupRuleDraft(setting, { name: 'n', description: '', pattern: '', replacement: '' }).pattern).toBeTruthy();
    expect(
      validateCleanupRuleDraft(setting, { name: 'n', description: '', pattern: 'x'.repeat(501), replacement: '' }).pattern,
    ).toBeTruthy();
    expect(validateCleanupRuleDraft(setting, { name: 'n', description: '', pattern: '([', replacement: '' }).pattern).toBeTruthy();
    expect(
      validateCleanupRuleDraft(setting, { name: 'n', description: '', pattern: '\\[.*\\]', replacement: '' }).pattern,
    ).toBeUndefined();
  });

  it('rejects oversized replacements and accepts empty or short ones', () => {
    const setting = DEFAULT_CLEANUP_RULES_SETTING;
    const draft = { name: 'n', description: '', pattern: 'x' };
    expect(validateCleanupRuleDraft(setting, { ...draft, replacement: 'y'.repeat(201) }).replacement).toBeTruthy();
    expect(validateCleanupRuleDraft(setting, { ...draft, replacement: 'y'.repeat(200) }).replacement).toBeUndefined();
    expect(validateCleanupRuleDraft(setting, { ...draft, replacement: '' }).replacement).toBeUndefined();
  });
});

describe('addCleanupRule', () => {
  it('appends an enabled custom rule and refuses at the cap', () => {
    const { setting } = addCleanupRule(DEFAULT_CLEANUP_RULES_SETTING, {
      name: 'mine',
      description: 'd',
      pattern: 'x+',
      replacement: '',
    });
    expect(setting?.custom).toHaveLength(1);
    expect(setting?.custom[0]?.enabled).toBe(true);
    expect(setting?.custom[0]?.builtin).toBe(false);

    const full = withCustom(Array.from({ length: 50 }, (_, i) => customRule({ id: `c${i}`, name: `r${i}` })));
    expect(addCleanupRule(full, { name: 'one-more', description: '', pattern: 'x', replacement: '' }).errors?.limit).toBeTruthy();
  });

  it('stores a non-empty replacement and omits it when empty', () => {
    const withRepl = addCleanupRule(DEFAULT_CLEANUP_RULES_SETTING, {
      name: 'fix typo',
      description: '',
      pattern: 'teh',
      replacement: 'the',
    });
    expect(withRepl.setting?.custom[0]?.replacement).toBe('the');

    const noRepl = addCleanupRule(DEFAULT_CLEANUP_RULES_SETTING, {
      name: 'del',
      description: '',
      pattern: 'x',
      replacement: '',
    });
    expect(noRepl.setting?.custom[0]?.replacement).toBeUndefined();
  });
});

describe('updateCleanupRule', () => {
  it('edits custom rules in place, keeps enabled state, and refuses missing ids', () => {
    const setting = withCustom([customRule({ enabled: false })]);
    const result = updateCleanupRule(setting, 'custom-1', { name: 'renamed', description: 'd2', pattern: 'y+', replacement: '' });
    expect(result.setting?.custom[0]?.name).toBe('renamed');
    expect(result.setting?.custom[0]?.enabled).toBe(false);
    expect(updateCleanupRule(setting, 'nope', { name: 'x', description: '', pattern: 'x', replacement: '' }).errors).toBeTruthy();
  });

  it('sets, changes, and clears the replacement', () => {
    const setting = withCustom([customRule()]);
    const set = updateCleanupRule(setting, 'custom-1', { name: 'Fansub credits', description: '', pattern: 'x', replacement: '$1' });
    expect(set.setting?.custom[0]?.replacement).toBe('$1');
    const changed = updateCleanupRule(set.setting!, 'custom-1', { name: 'Fansub credits', description: '', pattern: 'x', replacement: 'z' });
    expect(changed.setting?.custom[0]?.replacement).toBe('z');
    const cleared = updateCleanupRule(changed.setting!, 'custom-1', { name: 'Fansub credits', description: '', pattern: 'x', replacement: '' });
    expect(cleared.setting?.custom[0]?.replacement).toBeUndefined();
    expect(cleared.setting?.custom[0]?.id).toBe('custom-1');
  });
});

describe('toggleCleanupRule', () => {
  it('flips builtin overrides and custom enabled flags independently', () => {
    const brackets = { id: 'brackets', name: 'Bracketed annotations', description: '', pattern: 'x', enabled: true, builtin: true };
    const setting = toggleCleanupRule(DEFAULT_CLEANUP_RULES_SETTING, brackets);
    expect(setting.builtinEnabled.brackets).toBe(false);
    const back = toggleCleanupRule(setting, brackets);
    expect(back.builtinEnabled.brackets).toBe(true);

    const custom = withCustom([customRule()]);
    expect(toggleCleanupRule(custom, custom.custom[0]!).custom[0]?.enabled).toBe(false);
  });
});

describe('deleteCleanupRule', () => {
  it('removes only the targeted custom rule', () => {
    const setting = withCustom([customRule(), customRule({ id: 'custom-2', name: 'other' })]);
    const next = deleteCleanupRule(setting, 'custom-1');
    expect(next.custom.map((r) => r.id)).toEqual(['custom-2']);
  });
});
