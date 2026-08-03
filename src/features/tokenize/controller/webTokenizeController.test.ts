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
  DEFAULT_TOKENIZE_SETTINGS: { schemaVersion: 1, origins: {}, urls: {}, subtitleUrls: {} },
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

// MutationObserver mock: records every constructed observer's callback so tests
// can simulate continuous DOM mutations (e.g. heavy SPA re-renders on Facebook)
// without relying on jsdom's async mutation dispatch.
class MockMutationObserver {
  static instances: MockMutationObserver[] = [];

  constructor(public callback: (mutations: MutationRecord[]) => void) {
    MockMutationObserver.instances.push(this);
  }

  observe(_target: Node, _options: MutationObserverInit): void { /* no-op */ }
  disconnect(): void { /* no-op */ }
  takeRecords(): MutationRecord[] { return []; }

  static triggerAll(mutations: MutationRecord[] = []): void {
    for (const inst of MockMutationObserver.instances) inst.callback(mutations);
  }

  static reset(): void {
    MockMutationObserver.instances = [];
  }
}

beforeEach(() => {
  MockIntersectionObserver.callbacks.clear();
  MockMutationObserver.reset();
  global.IntersectionObserver = MockIntersectionObserver as unknown as typeof IntersectionObserver;
  global.MutationObserver = MockMutationObserver as unknown as typeof MutationObserver;
  // jsdom does not implement matchMedia — mock the same shape popupShell.test.ts uses.
  if (!window.matchMedia) {
    window.matchMedia = jest.fn((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: jest.fn(),
      removeListener: jest.fn(),
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      dispatchEvent: jest.fn(),
    })) as unknown as typeof window.matchMedia;
  }
  const g = global as unknown as { chrome?: unknown };
  g.chrome = g.chrome ?? {};
  const c = g.chrome as { storage: Record<string, unknown> };
  c.storage = c.storage ?? {};
  c.storage.local = {
    get: jest.fn(() => Promise.resolve({})),
    set: jest.fn(() => Promise.resolve()),
  };
  c.storage.onChanged = {
    addListener: jest.fn(),
    removeListener: jest.fn(),
  };
  loadTokenizeSettings.mockResolvedValue({ schemaVersion: 1, origins: {}, urls: {}, subtitleUrls: {} });
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
      subtitleUrls: {},
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

  it('activates within the max-delay cap even under continuous mutations (heavy SPA)', async () => {
    // Regression guard: Facebook/Twitter mutate continuously, so the 500ms
    // quiet-period gate never fires. The MAX_ACTIVATION_DELAY_MS hard cap must
    // guarantee activation regardless. Without the cap, tokenize stays at 0
    // tokens indefinitely on slow devices (observed: 9s+ delay under throttle).
    jest.useFakeTimers();
    const readyState = jest.spyOn(document, 'readyState', 'get').mockReturnValue('interactive');
    loadTokenizeSettings.mockResolvedValue({
      schemaVersion: 1,
      origins: {},
      urls: { 'https://example.com/': true },
      subtitleUrls: {},
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
      window.dispatchEvent(new Event('load'));

      // The stability observer is the second MutationObserver instance created
      // (the first is the main re-scan observer, which is only connected after
      // activation in production). Only trigger the stability observer to
      // simulate continuous hydration mutations without prematurely running the
      // re-scan (which the mock would do regardless of connection state).
      const stabilityObserver = MockMutationObserver.instances[MockMutationObserver.instances.length - 1];
      expect(stabilityObserver).toBeTruthy();

      // Simulate continuous mutations every 100ms — well under HYDRATION_QUIET_MS
      // (500ms), so the quiet-period timer keeps resetting and would never fire.
      for (let elapsed = 0; elapsed < 2900; elapsed += 100) {
        stabilityObserver.callback([]);
        await jest.advanceTimersByTimeAsync(100);
      }
      // Just before the 3000ms cap: still not activated (quiet period never met).
      expect(MockIntersectionObserver.callbacks.has(paragraph)).toBe(false);

      // Trigger one more mutation batch and advance past the 3000ms cap.
      stabilityObserver.callback([]);
      await jest.advanceTimersByTimeAsync(200);

      // Activated despite continuous mutations — the hard cap fired.
      expect(MockIntersectionObserver.callbacks.has(paragraph)).toBe(true);
      controller.destroy();
    } finally {
      readyState.mockRestore();
      jest.useRealTimers();
    }
  });

  it('re-scans dynamically added content within the max-delay cap under continuous mutations', async () => {
    // Regression guard: the MutationObserver re-scan uses a trailing 300ms
    // debounce. On heavy SPAs that mutate continuously, a pure trailing debounce
    // is starved forever and new/replaced content never gets tokenized. The
    // MAX_MUTATION_SCAN_DELAY_MS cap must force a re-scan even while mutations
    // keep coming.
    jest.useFakeTimers();
    const root = document.createElement('div');
    const paragraph = document.createElement('p');
    paragraph.textContent = 'Initial content';
    root.appendChild(paragraph);
    document.body.appendChild(root);

    try {
      const controller = await createWebTokenizeController({
        url: 'https://example.com/',
        root,
      });
      controller.enable();
      MockIntersectionObserver.trigger(paragraph);
      await jest.advanceTimersByTimeAsync(50);

      // Add a new text block AFTER activation — the mutation observer should
      // eventually pick it up. Simulate continuous mutations every 100ms (well
      // under the 300ms debounce) so a pure trailing debounce would starve.
      const newParagraph = document.createElement('p');
      newParagraph.textContent = 'Dynamically added content';
      root.appendChild(newParagraph);

      const mutationObservers = MockMutationObserver.instances;
      // The last MutationObserver instance is the main re-scan observer (created
      // in createWebTokenizeController). Trigger it continuously for 1.6s — past
      // the 1500ms max-delay cap but with mutations every 100ms so the trailing
      // 300ms debounce never settles.
      for (let elapsed = 0; elapsed < 1600; elapsed += 100) {
        for (const obs of mutationObservers) {
          obs.callback([{ addedNodes: [newParagraph], type: 'childList' } as unknown as MutationRecord]);
        }
        await jest.advanceTimersByTimeAsync(100);
      }

      // The new paragraph must have been observed by the viewport tracker —
      // proving the re-scan fired despite continuous mutations.
      expect(MockIntersectionObserver.callbacks.has(newParagraph)).toBe(true);
      controller.destroy();
    } finally {
      jest.useRealTimers();
    }
  });

  it('does not activate a persisted session disabled before page load', async () => {
    const readyState = jest.spyOn(document, 'readyState', 'get').mockReturnValue('interactive');
    loadTokenizeSettings.mockResolvedValue({
      schemaVersion: 1,
      origins: {},
      urls: { 'https://example.com/': true },
      subtitleUrls: {},
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

  it('off→on→off removes ALL token spans (no orphans after re-toggle)', async () => {
    const root = document.createElement('div');
    const p1 = document.createElement('p');
    p1.textContent = 'Hello world.';
    const p2 = document.createElement('p');
    p2.textContent = 'Foo bar baz.';
    root.appendChild(p1);
    root.appendChild(p2);
    document.body.appendChild(root);

    const controller = await createWebTokenizeController({
      url: 'https://example.com/',
      root,
    });

    // ON
    controller.enable();
    MockIntersectionObserver.trigger(p1);
    MockIntersectionObserver.trigger(p2);
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(p1.querySelectorAll('.js-cell-token').length).toBeGreaterThan(0);
    expect(p2.querySelectorAll('.js-cell-token').length).toBeGreaterThan(0);

    // OFF
    controller.disable();
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(p1.querySelectorAll('.js-cell-token').length).toBe(0);
    expect(p2.querySelectorAll('.js-cell-token').length).toBe(0);

    // ON again
    controller.enable();
    MockIntersectionObserver.trigger(p1);
    MockIntersectionObserver.trigger(p2);
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(p1.querySelectorAll('.js-cell-token').length).toBeGreaterThan(0);
    expect(p2.querySelectorAll('.js-cell-token').length).toBeGreaterThan(0);

    // OFF again — ALL spans must be gone (no orphans)
    controller.disable();
    await new Promise((resolve) => setTimeout(resolve, 20));
    const remainingSpans = root.querySelectorAll('.js-cell-token');
    expect(remainingSpans.length).toBe(0);
    expect(p1.textContent).toBe('Hello world.');
    expect(p2.textContent).toBe('Foo bar baz.');

    controller.destroy();
  });

  it('disable sweeps orphan token spans that are not in the block list', async () => {
    const root = document.createElement('div');
    const p1 = document.createElement('p');
    p1.textContent = 'Orphan span here.';
    const injected = document.createElement('span');
    injected.className = 'js-cell-token';
    injected.textContent = 'orphan';
    p1.appendChild(injected);
    root.appendChild(p1);
    document.body.appendChild(root);

    const controller = await createWebTokenizeController({
      url: 'https://example.com/',
      root,
    });

    controller.enable();
    await new Promise((resolve) => setTimeout(resolve, 20));

    // OFF must remove the injected orphan span too.
    controller.disable();
    await new Promise((resolve) => setTimeout(resolve, 20));
    const remainingSpans = root.querySelectorAll('.js-cell-token');
    expect(remainingSpans.length).toBe(0);
    expect(p1.textContent).toBe('Orphan span here.orphan');

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

  it('changes status of every token inside a native text selection with 1-4 keys', async () => {
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

    const hello = paragraph.querySelector('[data-cell-term="hello"]') as HTMLElement;
    const world = paragraph.querySelector('[data-cell-term="world"]') as HTMLElement;
    expect(hello).not.toBeNull();
    expect(world).not.toBeNull();

    // Native selection spanning both tokens (no Ctrl+Click, no hover).
    const range = document.createRange();
    range.setStartBefore(hello);
    range.setEndAfter(world);
    const sel = window.getSelection()!;
    sel.removeAllRanges();
    sel.addRange(range);

    setWordStatus.mockClear();
    const event = new KeyboardEvent('keydown', { key: '3', bubbles: true });
    document.dispatchEvent(event);

    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(setWordStatus).toHaveBeenCalledWith('en', 'hello', 'known');
    expect(setWordStatus).toHaveBeenCalledWith('en', 'world', 'known');
    // Selection is cleared after applying.
    expect(window.getSelection()!.isCollapsed).toBe(true);

    controller.destroy();
  });

  it('keyboard status change is not clobbered by an in-flight metadata flush (race guard)', async () => {
    const root = document.createElement('div');
    const paragraph = document.createElement('p');
    paragraph.textContent = 'Hello world.';
    root.appendChild(paragraph);
    document.body.appendChild(root);

    // Background read resolves after a real delay so the flush is mid-await
    // when the shortcut key fires. Returns the OLD status ('unknown') to
    // simulate a snapshot taken before the user pressed the key.
    getWordStatuses.mockImplementation(() => new Promise<Map<string, string>>((resolve) => {
      setTimeout(() => resolve(new Map<string, string>([['hello', 'unknown'], ['world', 'unknown']])), 80);
    }));

    const controller = await createWebTokenizeController({
      url: 'https://example.com/',
      root,
    });

    controller.enable();
    MockIntersectionObserver.trigger(paragraph);
    // Let the metadata flush schedule + start awaiting getWordStatuses.
    await new Promise((resolve) => setTimeout(resolve, 20));
    // Flush is now blocked on the 80ms background read.

    const hello = paragraph.querySelector('[data-cell-term="hello"]') as HTMLElement;
    expect(hello).not.toBeNull();
    hello!.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));

    // Press 2 (tracking) WHILE the flush is still awaiting the background.
    setWordStatus.mockClear();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: '2', bubbles: true }));

    // Wait for the stale background snapshot to resolve + flush to rebind.
    await new Promise((resolve) => setTimeout(resolve, 100));

    // rebind recreates the span, so re-query by term after the flush settles.
    const helloAfter = paragraph.querySelector('[data-cell-term="hello"]') as HTMLElement;
    expect(helloAfter.classList.contains('js-cell-token--status-tracking')).toBe(true);
    expect(helloAfter.classList.contains('js-cell-token--status-unknown')).toBe(false);
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

  it('skips subtitle-line native text', async () => {
    const root = document.createElement('div');
    root.innerHTML = '<div class="subtitle-block"><div class="subtitle-line target">Hello world.</div><div class="subtitle-line native">Xin chào.</div></div>';
    document.body.appendChild(root);

    const native = root.querySelector('.subtitle-line.native')!;

    const controller = await createWebTokenizeController({
      url: 'https://example.com/',
      root,
    });

    controller.enable();
    MockIntersectionObserver.trigger(native);
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(native.querySelectorAll('.js-cell-token').length).toBe(0);
    expect(native.textContent).toBe('Xin chào.');

    controller.destroy();
  });

  it('applyStatusForTerm rebinds visible tokens with the new status without persisting', async () => {
    const root = document.createElement('div');
    const paragraph = document.createElement('p');
    paragraph.textContent = 'Hello world. Hello again.';
    root.appendChild(paragraph);
    document.body.appendChild(root);

    const controller = await createWebTokenizeController({
      url: 'https://example.com/',
      root,
    });

    controller.enable();
    MockIntersectionObserver.trigger(paragraph);
    await new Promise((resolve) => setTimeout(resolve, 50));

    const helloSpansBefore = paragraph.querySelectorAll('[data-cell-term="hello"]');
    expect(helloSpansBefore.length).toBe(2);
    expect(Array.from(helloSpansBefore[0]!.classList).some((c) => c === 'js-cell-token--status-unknown')).toBe(true);

    // Simulate popup status cycle: applyStatusForTerm must NOT call setWordStatus
    // (popup already persisted) but must rebind visible tokens with new status.
    setWordStatus.mockClear();
    controller.applyStatusForTerm('hello', 'known');
    await new Promise((resolve) => setTimeout(resolve, 20));

    expect(setWordStatus).not.toHaveBeenCalled();
    const helloSpansAfter = paragraph.querySelectorAll('[data-cell-term="hello"]');
    expect(helloSpansAfter.length).toBe(2);
    for (const span of helloSpansAfter) {
      expect(span.classList.contains('js-cell-token--status-known')).toBe(true);
      expect(span.classList.contains('js-cell-token--status-unknown')).toBe(false);
      // showFrequency is on by default; known/ignore no longer forces frequency-off.
      expect(span.classList.contains('js-cell-token--frequency-off')).toBe(false);
    }

    controller.destroy();
  });

  it('binds viewport blocks immediately on enable without waiting for IO callback (VDLT-Predict C1)', async () => {
    const root = document.createElement('div');
    const paragraph = document.createElement('p');
    paragraph.textContent = 'Hello world.';
    root.appendChild(paragraph);
    document.body.appendChild(root);
    // jsdom does not layout, so getBoundingClientRect returns height=0 and
    // isElementInViewport would reject. Mock a non-zero rect so bindViewportNow
    // treats the paragraph as inside the viewport.
    paragraph.getBoundingClientRect = jest.fn(() => ({
      top: 0, bottom: 100, height: 100, left: 0, right: 100, width: 100, x: 0, y: 0,
      toJSON: () => {},
    })) as unknown as typeof paragraph.getBoundingClientRect;

    const controller = await createWebTokenizeController({ url: 'https://example.com/', root });

    controller.enable();
    // Cold-start viewport-first: viewport blocks bind synchronously via
    // bindViewportNow, before any IntersectionObserver callback fires.
    const spans = paragraph.querySelectorAll('.js-cell-token');
    expect(spans.length).toBeGreaterThan(0);

    controller.destroy();
  });

  it('binds viewport blocks before the hydration quiet window for persisted sessions (VDLT-Predict C2)', async () => {
    jest.useFakeTimers();
    const readyState = jest.spyOn(document, 'readyState', 'get').mockReturnValue('interactive');
    loadTokenizeSettings.mockResolvedValue({
      schemaVersion: 1,
      origins: {},
      urls: { 'https://example.com/': true },
      subtitleUrls: {},
    });
    const root = document.createElement('div');
    const paragraph = document.createElement('p');
    paragraph.textContent = 'Challenge content';
    root.appendChild(paragraph);
    document.body.appendChild(root);
    paragraph.getBoundingClientRect = jest.fn(() => ({
      top: 0, bottom: 100, height: 100, left: 0, right: 100, width: 100, x: 0, y: 0,
      toJSON: () => {},
    })) as unknown as typeof paragraph.getBoundingClientRect;

    try {
      const controller = await createWebTokenizeController({
        url: 'https://example.com/',
        root,
      });

      // Before load: nothing bound yet.
      expect(paragraph.querySelectorAll('.js-cell-token').length).toBe(0);

      window.dispatchEvent(new Event('load'));

      // FR4: viewport blocks bind immediately after load, before the 500ms
      // hydration quiet window fires the full activate (observe + mutation).
      const spansAfterLoad = paragraph.querySelectorAll('.js-cell-token');
      expect(spansAfterLoad.length).toBeGreaterThan(0);

      // Observer is NOT connected yet (quiet window has not elapsed).
      expect(MockIntersectionObserver.callbacks.has(paragraph)).toBe(false);

      await jest.advanceTimersByTimeAsync(500);

      // After quiet: full activate → observe connected.
      expect(MockIntersectionObserver.callbacks.has(paragraph)).toBe(true);
      controller.destroy();
    } finally {
      readyState.mockRestore();
      jest.useRealTimers();
    }
  });

  it('recreates ViewportTracker with asymmetric margin when scroll direction changes (VDLT-Predict B2/B3)', async () => {
    // rAF must run synchronously in jsdom for this test. Mock requestAnimationFrame
    // to invoke the callback immediately so the scroll handler updates direction
    // in the same tick.
    const rafSpy = jest.spyOn(window, 'requestAnimationFrame').mockImplementation((cb: FrameRequestCallback) => {
      cb(0);
      return 0;
    });
    try {
      const root = document.createElement('div');
      const paragraph = document.createElement('p');
      paragraph.textContent = 'Hello world.';
      root.appendChild(paragraph);
      document.body.appendChild(root);

      const controller = await createWebTokenizeController({ url: 'https://example.com/', root });
      controller.enable();
      // Initial: paragraph observed with isotropic margin
      expect(MockIntersectionObserver.callbacks.has(paragraph)).toBe(true);

      // Simulate scroll down: window.scrollY increases past hysteresis (16px)
      Object.defineProperty(window, 'scrollY', { value: 500, writable: true, configurable: true });
      Object.defineProperty(window, 'innerHeight', { value: 800, writable: true, configurable: true });
      window.dispatchEvent(new Event('scroll'));

      // After direction change, tracker recreated and paragraph re-observed
      expect(MockIntersectionObserver.callbacks.has(paragraph)).toBe(true);

      controller.destroy();
      // destroy must remove the scroll listener — dispatching scroll after
      // destroy must not throw or recreate the tracker.
      expect(() => window.dispatchEvent(new Event('scroll'))).not.toThrow();
    } finally {
      rafSpy.mockRestore();
      Object.defineProperty(window, 'scrollY', { value: 0, writable: true, configurable: true });
      Object.defineProperty(window, 'innerHeight', { value: 768, writable: true, configurable: true });
    }
  });
});
