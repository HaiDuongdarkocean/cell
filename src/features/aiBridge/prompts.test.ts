import { DEFAULT_AI_BRIDGE_SETTINGS } from '@/shared/config/config';
import { CURRENT_SCHEMA_VERSION, loadSettings } from '@/shared/lib/storage/settingsStore';
import type { AiFeature } from '@/entities/settings';
import {
  composePrompt,
  DEFAULT_PROMPTS,
  fillPrompt,
  validatePromptPlaceholders,
} from './prompts';

const store: Record<string, unknown> = {};

jest.mock('@/shared/lib/chrome-apis', () => ({
  getStorage: jest.fn(async (key?: string) =>
    key === undefined ? { ...store } : { [key]: store[key] },
  ),
  setStorage: jest.fn(async (items: Record<string, unknown>) => {
    Object.assign(store, items);
  }),
}));

test('fillPrompt replaces all four placeholders', () => {
  const out = fillPrompt('[SENTENCE] has [WORD] → [TARGET_LANG] for [INTERFACE_LANG]', {
    word: 'bank',
    sentence: 'I sat by the bank.',
    targetLang: 'vi',
    interfaceLang: 'en',
  });
  expect(out).toBe('I sat by the bank. has bank → vi for en');
});

test('fillPrompt leaves unknown and unfilled placeholders untouched', () => {
  expect(fillPrompt('a [FOO] b [WORD]', { word: 'bank' })).toBe('a [FOO] b bank');
  expect(fillPrompt('x [WORD] y', {})).toBe('x [WORD] y');
});

test('validatePromptPlaceholders accepts all stock prompts', () => {
  for (const template of Object.values(DEFAULT_PROMPTS)) {
    expect(validatePromptPlaceholders(template.system)).toEqual({ ok: true });
    expect(validatePromptPlaceholders(template.user)).toEqual({ ok: true });
  }
});

test('validatePromptPlaceholders rejects renamed or suffixed placeholders', () => {
  const result = validatePromptPlaceholders('Explain [WROD] in [WORD2] now');
  expect(result).toEqual({ ok: false, invalid: ['[WROD]', '[WORD2]'] });
});

test('validatePromptPlaceholders accepts a prompt with no placeholders', () => {
  expect(validatePromptPlaceholders('Reply concisely.')).toEqual({ ok: true });
});

test('composePrompt joins system and user with a blank line and fills vars', () => {
  const out = composePrompt('sentenceTranslate', DEFAULT_PROMPTS, {
    sentence: 'Hello!',
    targetLang: 'vi',
  });
  expect(out).toBe(
    `${DEFAULT_PROMPTS.sentenceTranslate.system.replaceAll('[TARGET_LANG]', 'vi')}\n\nHello!`,
  );
});

test('DEFAULT_AI_BRIDGE_SETTINGS.prompts has non-empty templates for all features', () => {
  const features: AiFeature[] = ['wordExplain', 'sentenceBreakdown', 'sentenceTranslate'];
  for (const feature of features) {
    const template = DEFAULT_AI_BRIDGE_SETTINGS.prompts[feature];
    expect(template.system.length).toBeGreaterThan(0);
    expect(template.user.length).toBeGreaterThan(0);
  }
});

test('DEFAULT_AI_BRIDGE_SETTINGS.providerOrder covers all four providers once', () => {
  expect([...DEFAULT_AI_BRIDGE_SETTINGS.providerOrder].sort()).toEqual(
    ['chatgpt', 'claude', 'deepseek', 'gemini'].sort(),
  );
});

test('stored settings missing aiBridge get defaults on load', async () => {
  store.settings = { schemaVersion: CURRENT_SCHEMA_VERSION };
  const settings = await loadSettings();
  expect(settings.aiBridge).toEqual(DEFAULT_AI_BRIDGE_SETTINGS);
});

test('stored partial aiBridge gets nested prompt fields filled on load', async () => {
  store.settings = {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    aiBridge: {
      defaultProvider: 'gemini',
      prompts: { wordExplain: { system: 'custom system' } },
    },
  };
  const settings = await loadSettings();
  const aiBridge = settings.aiBridge;
  expect(aiBridge?.defaultProvider).toBe('gemini');
  expect(aiBridge?.providerOrder).toEqual(DEFAULT_AI_BRIDGE_SETTINGS.providerOrder);
  expect(aiBridge?.prompts.wordExplain.system).toBe('custom system');
  expect(aiBridge?.prompts.wordExplain.user).toBe(DEFAULT_PROMPTS.wordExplain.user);
  expect(aiBridge?.prompts.sentenceBreakdown).toEqual(DEFAULT_PROMPTS.sentenceBreakdown);
  expect(aiBridge?.prompts.sentenceTranslate).toEqual(DEFAULT_PROMPTS.sentenceTranslate);
});
