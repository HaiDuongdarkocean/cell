import { describe, expect, it, jest, beforeEach } from '@jest/globals';
import type { FrequencyEntry } from '@/entities/dictionary';

const getWordStatuses = jest.fn() as jest.MockedFunction<(langCode: string, terms: readonly string[]) => Promise<Map<string, string>>>;
const getTokenizeMeta = jest.fn() as jest.MockedFunction<(langCode: string, terms: readonly string[]) => Promise<{ statuses: Map<string, string>; frequencyEntries: Map<string, FrequencyEntry[]> }>>;
const setWordStatus = jest.fn() as jest.MockedFunction<(langCode: string, term: string, status: string) => Promise<void>>;
const getReadings = jest.fn() as jest.MockedFunction<(langCode: string, terms: readonly string[]) => Promise<Map<string, string>>>;
const getWordTranslations = jest.fn() as jest.MockedFunction<(sl: string, tl: string, terms: readonly string[]) => Promise<Map<string, string>>>;

jest.mock('@/features/dictionary/services/wordStatusClient', () => ({ getWordStatuses, setWordStatus }));
jest.mock('@/features/dictionary/services/tokenizeMetaClient', () => ({ getTokenizeMeta, pingTokenizeMeta: jest.fn() }));
jest.mock('@/features/dictionary/services/readingsClient', () => ({ getReadings }));
jest.mock('@/features/translate', () => ({ getWordTranslations }));

import { createSubtitleTokenizeController } from '@/features/tokenize/controller/subtitleTokenizeController';
import type { SrtCue } from '@/entities/media';

beforeEach(() => {
  getWordStatuses.mockResolvedValue(new Map([['wait', 'unknown'], ['for', 'unknown'], ['love', 'unknown']]));
  getTokenizeMeta.mockResolvedValue({
    statuses: new Map([['wait', 'unknown'], ['for', 'unknown'], ['love', 'unknown']]),
    frequencyEntries: new Map([['wait', [{ rank: 50 }] as unknown as FrequencyEntry[]]]),
  });
  getReadings.mockResolvedValue(new Map([['wait', 'weɪt']]));
  getWordTranslations.mockResolvedValue(new Map([['wait', 'chờ']]));
  setWordStatus.mockResolvedValue(undefined);
  document.body.innerHTML = '';
});

describe('subtitle block annotations', () => {
  it('bound block tokens receive reading + gloss attrs after resolve', async () => {
    const target = document.createElement('div');
    const native = document.createElement('div');
    document.body.append(target, native);
    const cues: SrtCue[] = [{ index: 1, start: 0, end: 1000, text: 'wait for love' }];
    const controller = createSubtitleTokenizeController({
      langCode: 'en',
      getLineElements: () => ({ target, native }),
      onOpenDictionary: jest.fn(),
      windowSize: 1,
      readingDisplay: 'always',
      glossDisplay: 'always',
      glossTargetLanguage: 'vi',
    });
    target.textContent = cues[0]!.text;
    controller.setCues(cues, cues);
    controller.enable();
    controller.render(0, -1);
    await new Promise((r) => setTimeout(r, 120));
    const wait = target.querySelector('[data-tihoka-term="wait"]') as HTMLElement | null;
    expect(getReadings).toHaveBeenCalled();
    expect(getWordTranslations).toHaveBeenCalled();
    expect(wait?.getAttribute('data-reading')).toBe('weɪt');
    expect(wait?.getAttribute('data-gloss')).toBe('chờ');
    controller.destroy();
  });
});
