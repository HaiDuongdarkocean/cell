import { describe, expect, it, jest, beforeEach } from '@jest/globals';
import type { TokenizeSettings } from '@/features/tokenize/types';
import type { FrequencyEntry } from '@/entities/dictionary';

const loadTokenizeSettings = jest.fn() as jest.MockedFunction<() => Promise<TokenizeSettings>>;
const saveTokenizeSettings = jest.fn() as jest.MockedFunction<(settings: TokenizeSettings) => Promise<void>>;
const getWordStatuses = jest.fn() as jest.MockedFunction<(langCode: string, terms: readonly string[]) => Promise<Map<string, string>>>;
const findFrequencyByTerms = jest.fn() as jest.MockedFunction<(langCode: string, terms: readonly string[]) => Promise<Map<string, FrequencyEntry[]>>>;
const setWordStatus = jest.fn() as jest.MockedFunction<(langCode: string, term: string, status: string) => Promise<void>>;

jest.mock('@/features/tokenize/services/tokenizeSettingsStore', () => ({
  loadTokenizeSettings,
  saveTokenizeSettings,
  isTokenizeEnabledForUrl: jest.fn((settings: { urls: Record<string, boolean> }, url: string) => {
    const exact = settings.urls[url];
    return exact ?? false;
  }),
  setTokenizeEnabledForUrl: jest.fn((settings: { urls: Record<string, boolean> }, url: string, enabled: boolean) => ({
    ...settings,
    urls: { ...settings.urls, [url]: enabled },
  })),
  DEFAULT_TOKENIZE_SETTINGS: { schemaVersion: 1, origins: {}, urls: {} },
}));

jest.mock('@/features/dictionaryPopup/services/wordStatusStore', () => ({
  getWordStatuses,
  setWordStatus,
  getWordStatus: jest.fn(),
}));

jest.mock('@/features/dictionary/repositories/frequencyRepository', () => ({
  findFrequencyByTerms,
  findFrequencyByTerm: jest.fn(),
}));

import { createWebTokenizeController } from './webTokenizeController';

class MockIntersectionObserver {
  private static callbacks = new Map<Element, () => void>();

  constructor(private callback: (entries: { target: Element; isIntersecting: boolean }[]) => void) {}

  observe(element: Element): void {
    MockIntersectionObserver.callbacks.set(element, () => {
      this.callback([{ target: element, isIntersecting: true }]);
    });
  }

  unobserve(_element: Element): void { /* no-op */ }
  disconnect(): void { /* no-op */ }

  static trigger(element: Element): void {
    MockIntersectionObserver.callbacks.get(element)?.();
  }
}

beforeEach(() => {
  global.IntersectionObserver = MockIntersectionObserver as unknown as typeof IntersectionObserver;
  loadTokenizeSettings.mockResolvedValue({ schemaVersion: 1, origins: {}, urls: {} });
  saveTokenizeSettings.mockResolvedValue(undefined);
  getWordStatuses.mockResolvedValue(new Map<string, string>());
  findFrequencyByTerms.mockResolvedValue(new Map<string, FrequencyEntry[]>());
  setWordStatus.mockResolvedValue(undefined);
  document.body.innerHTML = '';
});

describe('createWebTokenizeController', () => {
  it('creates a badge and exposes state', async () => {
    const controller = await createWebTokenizeController({
      url: 'https://example.com/',
      root: document.body,
    });
    expect(controller.getState().enabled).toBe(false);
    expect(controller.badge).toBeTruthy();
    controller.destroy();
  });

  it('tokenizes a visible block after enable', async () => {
    const root = document.createElement('div');
    const paragraph = document.createElement('p');
    paragraph.textContent = 'Hello world.';
    root.appendChild(paragraph);
    document.body.appendChild(root);

    getWordStatuses.mockResolvedValue(new Map([['hello', 'known']]));
    findFrequencyByTerms.mockResolvedValue(new Map([['hello', [{ resourceId: 1, term: 'hello', reading: '', frequency: 100 } as FrequencyEntry]]]));

    const controller = await createWebTokenizeController({
      url: 'https://example.com/',
      root,
    });

    MockIntersectionObserver.trigger(paragraph);
    controller.enable();

    // Give the scheduler a frame to run idle tasks.
    await new Promise((resolve) => setTimeout(resolve, 50));

    const spans = paragraph.querySelectorAll('.js-cell-token');
    expect(spans.length).toBeGreaterThan(0);
    expect(paragraph.textContent).toBe('Hello world.');

    controller.destroy();
  });

  it('changes hovered token status with 1-4 keys', async () => {
    const root = document.createElement('div');
    const paragraph = document.createElement('p');
    paragraph.textContent = 'Hello world.';
    root.appendChild(paragraph);
    document.body.appendChild(root);

    const controller = await createWebTokenizeController({
      url: 'https://example.com/',
      root,
    });

    MockIntersectionObserver.trigger(paragraph);
    controller.enable();
    await new Promise((resolve) => setTimeout(resolve, 50));

    const hello = paragraph.querySelector('[data-cell-term="hello"]');
    expect(hello).not.toBeNull();
    hello!.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));

    const event = new KeyboardEvent('keydown', { key: '2', bubbles: true });
    document.dispatchEvent(event);

    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(setWordStatus).toHaveBeenCalledWith('en', 'hello', 'tracking');
    controller.destroy();
  });
});
