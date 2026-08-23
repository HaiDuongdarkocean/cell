import { describe, expect, it } from '@jest/globals';
import { PADDLE_OCR_LANGUAGE_GROUPS, ISO_TO_PADDLE, resolveOcrLang, ENGINE_KEY_FOR_LANG } from './paddleOcrLanguages';

describe('PADDLE_OCR_LANGUAGE_GROUPS', () => {
  it('has 12 model groups', () => {
    expect(PADDLE_OCR_LANGUAGE_GROUPS).toHaveLength(12);
  });
  it('covers 108 languages, each abbr exactly once', () => {
    const abbrs = PADDLE_OCR_LANGUAGE_GROUPS.flatMap((g) => g.languages.map((l) => l.abbr));
    expect(new Set(abbrs).size).toBe(abbrs.length); // no duplicates
    expect(abbrs.length).toBe(108);
  });
});

describe('resolveOcrLang', () => {
  it('override wins', () => expect(resolveOcrLang('vi', 'en')).toBe('vi'));
  it('null → system default (ISO 639-1)', () => expect(resolveOcrLang(null, 'vi')).toBe('vi'));
  it('BCP-47 normalized (pt-BR → pt)', () => expect(resolveOcrLang(null, 'pt-BR')).toBe('pt'));
  it('zh → ch (default model abbr)', () => expect(resolveOcrLang(null, 'zh')).toBe('ch'));
  it('ja → japan', () => expect(resolveOcrLang(null, 'ja')).toBe('japan'));
  it('unknown ISO → auto', () => expect(resolveOcrLang(null, 'xx')).toBe('auto'));
});

describe('ENGINE_KEY_FOR_LANG', () => {
  it('maps abbr → model name', () => {
    expect(ENGINE_KEY_FOR_LANG('vi')).toBe('latin');
    expect(ENGINE_KEY_FOR_LANG('ch')).toBe('ch');
    expect(ENGINE_KEY_FOR_LANG('japan')).toBe('ch'); // japan/chinese_cht dùng chung default model
    expect(ENGINE_KEY_FOR_LANG('ko')).toBe('korean'); // NOTE: catalog abbr là 'korean' — ISO ko→'korean'
  });
  it('every catalog abbr has a model', () => {
    for (const g of PADDLE_OCR_LANGUAGE_GROUPS) {
      for (const l of g.languages) expect(ENGINE_KEY_FOR_LANG(l.abbr)).toBe(g.model);
    }
  });
});

describe('ISO_TO_PADDLE coverage', () => {
  it('every value is a valid catalog abbr or auto', () => {
    const abbrs = new Set<string>(PADDLE_OCR_LANGUAGE_GROUPS.flatMap((g) => g.languages.map((l) => l.abbr)));
    for (const v of Object.values(ISO_TO_PADDLE)) expect(abbrs.has(v)).toBe(true);
  });
});
