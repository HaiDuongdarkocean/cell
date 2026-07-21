import { describe, expect, it, jest, beforeEach } from '@jest/globals';
import type { FrequencyEntry } from '@/entities/dictionary';

const getWordStatuses = jest.fn() as jest.MockedFunction<(langCode: string, terms: readonly string[]) => Promise<Map<string, string>>>;
const getFrequencyEntries = jest.fn() as jest.MockedFunction<(langCode: string, terms: readonly string[]) => Promise<Map<string, FrequencyEntry[]>>>;
const setWordStatus = jest.fn() as jest.MockedFunction<(langCode: string, term: string, status: string) => Promise<void>>;

jest.mock('@/features/dictionaryPopup/services/wordStatusClient', () => ({
  getWordStatuses,
  setWordStatus,
}));

jest.mock('@/features/dictionaryPopup/services/frequencyClient', () => ({
  getFrequencyEntries,
}));

import { createSubtitleTokenizeController } from './subtitleTokenizeController';
import type { SrtCue } from '@/entities/media';

beforeEach(() => {
  getWordStatuses.mockResolvedValue(new Map<string, string>());
  getFrequencyEntries.mockResolvedValue(new Map<string, FrequencyEntry[]>());
  setWordStatus.mockResolvedValue(undefined);
  document.body.innerHTML = '';
});

describe('createSubtitleTokenizeController', () => {
  function setup() {
    const target = document.createElement('div');
    const native = document.createElement('div');
    document.body.append(target, native);

    const cues: SrtCue[] = [
      { index: 1, start: 0, end: 1000, text: 'Hello world.' },
      { index: 2, start: 1000, end: 2000, text: 'Second cue.' },
      { index: 3, start: 2000, end: 3000, text: 'Third cue.' },
    ];

    const onOpenDictionary = jest.fn();
    const controller = createSubtitleTokenizeController({
      langCode: 'en',
      getLineElements: () => ({ target, native }),
      onOpenDictionary,
      windowSize: 1,
    });

    return { target, native, cues, controller, onOpenDictionary };
  }

  it('tokenizes the active target cue and leaves the native line plain', async () => {
    const { target, native, cues, controller } = setup();

    target.textContent = cues[0]!.text;
    native.textContent = cues[0]!.text;
    controller.setCues(cues, cues);
    controller.enable();
    controller.render(0, 0);

    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(target.querySelectorAll('.js-cell-token').length).toBeGreaterThan(0);
    expect(native.querySelectorAll('.js-cell-token').length).toBe(0);
    expect(target.textContent).toBe('Hello world.');
    expect(native.textContent).toBe('Hello world.');

    controller.destroy();
  });

  it('calls onOpenDictionary when a token is clicked', async () => {
    const { target, cues, controller, onOpenDictionary } = setup();

    target.textContent = cues[0]!.text;
    controller.setCues(cues, []);
    controller.enable();
    controller.render(0, -1);

    await new Promise((resolve) => setTimeout(resolve, 50));

    const hello = target.querySelector('[data-cell-term="hello"]');
    expect(hello).not.toBeNull();
    hello!.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    expect(onOpenDictionary).toHaveBeenCalled();

    controller.destroy();
  });

  it('updates status of hovered token with 1-4 keys', async () => {
    getWordStatuses.mockResolvedValue(new Map([['hello', 'unknown']]));

    const { target, cues, controller } = setup();

    target.textContent = cues[0]!.text;
    controller.setCues(cues, []);
    controller.enable();
    controller.render(0, -1);

    await new Promise((resolve) => setTimeout(resolve, 50));

    const hello = target.querySelector('[data-cell-term="hello"]') as HTMLElement | null;
    expect(hello).not.toBeNull();
    hello!.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));

    document.dispatchEvent(new KeyboardEvent('keydown', { key: '2', bubbles: true }));

    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(setWordStatus).toHaveBeenCalledWith('en', 'hello', 'tracking');

    controller.destroy();
  });

  it('disables tokenization and restores plain text', async () => {
    const { target, cues, controller } = setup();

    target.textContent = cues[0]!.text;
    controller.setCues(cues, []);
    controller.enable();
    controller.render(0, -1);

    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(target.querySelectorAll('.js-cell-token').length).toBeGreaterThan(0);

    controller.disable();

    expect(target.querySelectorAll('.js-cell-token').length).toBe(0);
    expect(target.textContent).toBe('Hello world.');

    controller.destroy();
  });
});
