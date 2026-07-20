import { describe, expect, it, jest, beforeEach } from '@jest/globals';
import type { TokenizeSettings } from '@/features/tokenize/types';
import type { FrequencyEntry } from '@/entities/dictionary';

const loadTokenizeSettings = jest.fn() as jest.MockedFunction<() => Promise<TokenizeSettings>>;
const saveTokenizeSettings = jest.fn() as jest.MockedFunction<(settings: TokenizeSettings) => Promise<void>>;
const getWordStatuses = jest.fn() as jest.MockedFunction<(langCode: string, terms: readonly string[]) => Promise<Map<string, string>>>;
const getFrequencyEntries = jest.fn() as jest.MockedFunction<(langCode: string, terms: readonly string[]) => Promise<Map<string, FrequencyEntry[]>>>;
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

jest.mock('@/features/dictionaryPopup/services/wordStatusClient', () => ({
  getWordStatuses,
  setWordStatus,
}));

jest.mock('@/features/dictionaryPopup/services/frequencyClient', () => ({
  getFrequencyEntries,
}));

import { createWebTokenizeController } from './webTokenizeController';

class MockIntersectionObserver {
  static callbacks = new Map<Element, () => void>();

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
  MockIntersectionObserver.callbacks.clear();
  global.IntersectionObserver = MockIntersectionObserver as unknown as typeof IntersectionObserver;
  loadTokenizeSettings.mockResolvedValue({ schemaVersion: 1, origins: {}, urls: {} });
  saveTokenizeSettings.mockResolvedValue(undefined);
  getWordStatuses.mockResolvedValue(new Map<string, string>());
  getFrequencyEntries.mockResolvedValue(new Map<string, FrequencyEntry[]>());
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

  it('falls back to documentElement when the page body is unavailable', async () => {
    const controller = await createWebTokenizeController({
      url: 'https://example.com/',
      root: null,
    });

    expect(() => controller.enable()).not.toThrow();
    expect(controller.getState().enabled).toBe(true);
    controller.destroy();
  });

  it('does not scan text blocks until enabled', async () => {
    const root = document.createElement('div');
    const paragraph = document.createElement('p');
    paragraph.textContent = 'Challenge content';
    root.appendChild(paragraph);
    document.body.appendChild(root);

    const controller = await createWebTokenizeController({
      url: 'https://example.com/',
      root,
    });

    expect(MockIntersectionObserver.callbacks.has(paragraph)).toBe(false);
    expect(paragraph.querySelector('.js-cell-token')).toBeNull();

    controller.enable();

    expect(MockIntersectionObserver.callbacks.has(paragraph)).toBe(true);
    controller.destroy();
  });

  it('waits for DOM quiescence after page load before activating a persisted session', async () => {
    jest.useFakeTimers();
    const readyState = jest.spyOn(document, 'readyState', 'get').mockReturnValue('interactive');
    loadTokenizeSettings.mockResolvedValue({
      schemaVersion: 1,
      origins: {},
      urls: { 'https://example.com/': true },
    });
    const root = document.createElement('div');
    const paragraph = document.createElement('p');
    paragraph.textContent = 'Challenge content';
    root.appendChild(paragraph);

    try {
      const controller = await createWebTokenizeController({
        url: 'https://example.com/',
        root,
      });

      expect(MockIntersectionObserver.callbacks.has(paragraph)).toBe(false);
      window.dispatchEvent(new Event('load'));
      expect(MockIntersectionObserver.callbacks.has(paragraph)).toBe(false);

      await jest.advanceTimersByTimeAsync(500);

      expect(MockIntersectionObserver.callbacks.has(paragraph)).toBe(true);
      controller.destroy();
    } finally {
      readyState.mockRestore();
      jest.useRealTimers();
    }
  });

  it('does not activate a persisted session disabled before page load', async () => {
    const readyState = jest.spyOn(document, 'readyState', 'get').mockReturnValue('interactive');
    loadTokenizeSettings.mockResolvedValue({
      schemaVersion: 1,
      origins: {},
      urls: { 'https://example.com/': true },
    });
    const root = document.createElement('div');
    const paragraph = document.createElement('p');
    paragraph.textContent = 'Challenge content';
    root.appendChild(paragraph);

    try {
      const controller = await createWebTokenizeController({
        url: 'https://example.com/',
        root,
      });

      controller.disable();
      window.dispatchEvent(new Event('load'));

      expect(MockIntersectionObserver.callbacks.has(paragraph)).toBe(false);
      controller.destroy();
    } finally {
      readyState.mockRestore();
    }
  });

  it('tokenizes a visible block after enable', async () => {
    const root = document.createElement('div');
    const paragraph = document.createElement('p');
    paragraph.textContent = 'Hello world.';
    root.appendChild(paragraph);
    document.body.appendChild(root);

    getWordStatuses.mockResolvedValue(new Map([['hello', 'known']]));
    getFrequencyEntries.mockResolvedValue(new Map([['hello', [{ resourceId: 1, term: 'hello', reading: '', frequency: 100 } as FrequencyEntry]]]));

    const controller = await createWebTokenizeController({
      url: 'https://example.com/',
      root,
    });

    controller.enable();
    MockIntersectionObserver.trigger(paragraph);

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

    controller.enable();
    MockIntersectionObserver.trigger(paragraph);
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

  it('re-binds visible blocks when showFrequency is toggled off', async () => {
    const root = document.createElement('div');
    const paragraph = document.createElement('p');
    paragraph.textContent = 'Hello world.';
    root.appendChild(paragraph);
    document.body.appendChild(root);

    const controller = await createWebTokenizeController({
      url: 'https://example.com/',
      root,
    });

    controller.enable();
    MockIntersectionObserver.trigger(paragraph);
    await new Promise((resolve) => setTimeout(resolve, 50));

    const helloBefore = paragraph.querySelector('[data-cell-term="hello"]') as HTMLElement;
    expect(helloBefore).not.toBeNull();
    // showFrequency defaults to true, status unknown -> frequency layer visible
    expect(helloBefore.classList.contains('js-cell-token--frequency-off')).toBe(false);

    controller.setShowFrequency(false);
    await new Promise((resolve) => setTimeout(resolve, 50));

    const helloAfter = paragraph.querySelector('[data-cell-term="hello"]') as HTMLElement;
    expect(helloAfter).not.toBeNull();
    // toggle off must re-bind so the frequency-off class is now applied
    expect(helloAfter.classList.contains('js-cell-token--frequency-off')).toBe(true);

    controller.destroy();
  });

  it('re-binds visible blocks when showStatus is toggled off', async () => {
    const root = document.createElement('div');
    const paragraph = document.createElement('p');
    paragraph.textContent = 'Hello world.';
    root.appendChild(paragraph);
    document.body.appendChild(root);

    const controller = await createWebTokenizeController({
      url: 'https://example.com/',
      root,
    });

    controller.enable();
    MockIntersectionObserver.trigger(paragraph);
    await new Promise((resolve) => setTimeout(resolve, 50));

    const helloBefore = paragraph.querySelector('[data-cell-term="hello"]') as HTMLElement;
    expect(helloBefore).not.toBeNull();
    expect(helloBefore.classList.contains('js-cell-token--status-off')).toBe(false);

    controller.setShowStatus(false);
    await new Promise((resolve) => setTimeout(resolve, 50));

    const helloAfter = paragraph.querySelector('[data-cell-term="hello"]') as HTMLElement;
    expect(helloAfter).not.toBeNull();
    expect(helloAfter.classList.contains('js-cell-token--status-off')).toBe(true);

    controller.destroy();
  });

  it('tokenizes a subtitle-line target element', async () => {
    const root = document.createElement('div');
    root.innerHTML = '<div class="subtitle-block"><div class="subtitle-line target">Hello world.</div></div>';
    document.body.appendChild(root);

    const target = root.querySelector('.subtitle-line.target')!;

    const controller = await createWebTokenizeController({
      url: 'https://example.com/',
      root,
    });

    controller.enable();
    MockIntersectionObserver.trigger(target);
    await new Promise((resolve) => setTimeout(resolve, 50));

    const spans = target.querySelectorAll('.js-cell-token');
    expect(spans.length).toBeGreaterThan(0);
    expect(target.textContent).toBe('Hello world.');

    controller.destroy();
  });
});
