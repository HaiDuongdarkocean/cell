// popupDictionaryController tests — spec §4.6.3 P0: full flow wiring.

import { describe, expect, it, beforeEach, beforeAll, jest } from '@jest/globals';

jest.mock('@/shared/lib/chrome-apis/runtime');

import {
  createPopupDictionaryState,
  showPopup,
  hidePopup,
  destroyPopup,
  cycleStatus,
  toggleDefinition,
  toggleTab,
  getInitialPopupSize,
  appendCandidate,
} from './popupDictionaryController';
import type { LookupResult, WordStatus } from '../types';
import type { DictionaryPopupSettings, CardCreatorSettings } from '@/entities/settings/types';
import { sendMessage } from '@/shared/lib/chrome-apis/runtime';

const mockSendMessage = jest.mocked(sendMessage);

// Mock chrome.storage.local + matchMedia (needed by PopupShell theme detection)
beforeAll(() => {
  const g = global as unknown as { chrome?: unknown };
  g.chrome = g.chrome ?? {};
  const c = g.chrome as { storage: Record<string, unknown>; runtime?: { sendMessage: jest.Mock } };
  c.storage = c.storage ?? {};
  c.storage.local = {
    get: jest.fn(() => Promise.resolve({})),
    set: jest.fn(() => Promise.resolve()),
  };
  c.storage.onChanged = {
    addListener: jest.fn(),
    removeListener: jest.fn(),
  };
  c.runtime = { sendMessage: jest.fn() };
  window.matchMedia = jest.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(),
    removeListener: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  }));
});

function makeResult(overrides: Partial<LookupResult> = {}): LookupResult {
  return {
    term: 'take off',
    langCode: 'en',
    reading: '/teɪk ɒf/',
    readingKind: 'ipa',
    frequency: null,
    status: 'unknown',
    partsOfSpeech: ['verb'],
    definitions: [{
      id: 'd1',
      pos: 'verb',
      text: 'to remove something',
      examples: ['Take off your shoes.'],
      source: 'Cambridge',
      defaultSelected: true,
    }],
    detectedPhrase: null,
    matchSource: 'dictionary',
    ...overrides,
  };
}

function makePopupSettings(overrides: Partial<DictionaryPopupSettings> = {}): DictionaryPopupSettings {
  return {
    enabled: true,
    triggerMode: 'click',
    defaultActiveTab: null,
    srsDestination: 'anki',
    popupWidthPx: 560,
    popupMaxHeightPx: 480,
    translateTargetLang: 'vi',
    externalDictLinks: [],
    ...overrides,
  };
}

function makeCardCreatorSettings(overrides: Partial<CardCreatorSettings> = {}): CardCreatorSettings {
  return {
    ankiConnectUrl: 'http://localhost:8765',
    defaultDeck: 'Default',
    defaultNoteType: 'Cell Video Card',
    defaultTags: '',
    mediaUpdateMode: 'overwrite',
    autoCompleteToggles: {
      definitions: true,
      wordAudios: true,
      sentenceAudios: true,
      images: true,
      sentenceTranslation: true,
      sentence: true,
    },
    audioFallback: 'community-then-tts',
    ...overrides,
  };
}

describe('createPopupDictionaryState', () => {
  it('creates state with default values', () => {
    const state = createPopupDictionaryState(makePopupSettings(), makeCardCreatorSettings());
    expect(state.currentResult).toBeNull();
    expect(state.currentStatus).toBe('unknown');
    expect(state.activeTab).toBeNull();
    expect(state.shell).toBeNull();
  });

  it('uses defaultActiveTab from settings', () => {
    const state = createPopupDictionaryState(
      makePopupSettings({ defaultActiveTab: 'audio' }),
      makeCardCreatorSettings(),
    );
    expect(state.activeTab).toBe('audio');
  });
});

describe('showPopup', () => {
  let state: ReturnType<typeof createPopupDictionaryState>;

  beforeEach(() => {
    state = createPopupDictionaryState(makePopupSettings(), makeCardCreatorSettings());
    mockSendMessage.mockReset();
    mockSendMessage.mockResolvedValue({ success: true, data: { translated: ['Bỏ giày ra.'] } });
  });

  it('sets currentResult', () => {
    const result = makeResult();
    const newState = showPopup(state, result, 170, 100, 150, 200, 'Take off your shoes.');
    expect(newState.currentResult).toBe(result);
  });

  it('sets contextSentence', () => {
    const result = makeResult();
    const newState = showPopup(state, result, 170, 100, 150, 200, 'Take off your shoes.');
    expect(newState.contextSentence).toBe('Take off your shoes.');
  });

  it('initializes definition selection from result', () => {
    const result = makeResult();
    const newState = showPopup(state, result, 170, 100, 150, 200, 'sentence');
    expect(newState.definitionSelection.get('d1')).toBe(true);
  });

  it('sets currentStatus from result', () => {
    const result = makeResult({ status: 'tracking' as WordStatus });
    const newState = showPopup(state, result, 170, 100, 150, 200, 'sentence');
    expect(newState.currentStatus).toBe('tracking');
  });

  it('creates shell on first show', () => {
    const result = makeResult();
    const newState = showPopup(state, result, 170, 100, 150, 200, 'sentence');
    expect(newState.shell).not.toBeNull();
  });

  it('initializes additionalResults as empty', () => {
    const result = makeResult();
    const newState = showPopup(state, result, 170, 100, 150, 200, 'sentence');
    expect(newState.additionalResults).toEqual([]);
  });

  it('invokes onDismiss callback with hidden state when shell dismisses', () => {
    const result = makeResult();
    const onDismiss = jest.fn();
    const newState = showPopup(state, result, 170, 100, 150, 200, 'sentence', onDismiss);
    // Simulate shell dismiss (Esc / click outside).
    newState.shell?.['onDismiss']();
    expect(onDismiss).toHaveBeenCalledTimes(1);
    const dismissedState = onDismiss.mock.calls[0]![0];
    expect(dismissedState.currentResult).toBeNull();
  });

  it('renders .js-cell-toolbar inside the winner candidate slot', () => {
    const result = makeResult();
    const newState = showPopup(state, result, 170, 100, 150, 200, 'sentence');
    const container = newState.shell?.getContainer();
    const candidates = container!.querySelectorAll('.js-cell-popup-candidate');
    expect(candidates).toHaveLength(1);
    const toolbars = candidates[0]!.querySelectorAll('.js-cell-toolbar');
    expect(toolbars).toHaveLength(1);
  });

  it('auto-translates sentence when translate tab is opened', async () => {
    const result = makeResult();
    const newState = showPopup(state, result, 170, 100, 150, 200, 'Take off your shoes.');
    const container = newState.shell?.getContainer();
    const translate = container!.querySelector('[data-cell-tab="translate"]') as HTMLButtonElement;
    translate.click();
    // Verify the panel opened.
    expect(container!.querySelector('[data-cell-panel="translate"]')).not.toBeNull();
    // Wait for async translateSentence (dynamic import + sendMessage roundtrip).
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(mockSendMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'TRANSLATE',
        payload: expect.objectContaining({ text: 'Take off your shoes.', sl: 'en', tl: 'vi' }),
      }),
    );
    // Panel must stay open after async translation completes (bug: it used to close
    // because the onTabOpen closure captured a stale state with activeTab=null).
    expect(container!.querySelector('[data-cell-panel="translate"]')).not.toBeNull();
  });

  it('does not auto-translate when context sentence is empty', async () => {
    const result = makeResult();
    const newState = showPopup(state, result, 170, 100, 150, 200, '');
    const container = newState.shell?.getContainer();
    const translate = container!.querySelector('[data-cell-tab="translate"]') as HTMLButtonElement;
    translate.click();
    await new Promise((resolve) => setTimeout(resolve, 10));
    const translateCalls = mockSendMessage.mock.calls.filter((c: unknown[]) => (c[0] as { type?: string })?.type === 'TRANSLATE');
    expect(translateCalls.length).toBe(0);
  });

  it('reuses cached translation when reopening same term+sentence', async () => {
    const result = makeResult();
    let shown = showPopup(state, result, 170, 100, 150, 200, 'Take off your shoes.');
    let container = shown.shell?.getContainer()!;
    const translate = container.querySelector('[data-cell-tab="translate"]') as HTMLButtonElement;
    translate.click();
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Close popup, then reopen same term + sentence.
    let hidden = hidePopup(shown);
    shown = showPopup(hidden, result, 170, 100, 150, 200, 'Take off your shoes.');
    container = shown.shell?.getContainer()!;

    // Translate tab should already show cached block; clicking tab does NOT re-fetch.
    mockSendMessage.mockClear();
    const translate2 = container.querySelector('[data-cell-tab="translate"]') as HTMLButtonElement;
    translate2.click();
    await new Promise((resolve) => setTimeout(resolve, 50));
    const translateCalls = mockSendMessage.mock.calls.filter((c: unknown[]) => (c[0] as { type?: string })?.type === 'TRANSLATE');
    expect(translateCalls.length).toBe(0);
    expect(container.querySelector('.cell-translate__block')).not.toBeNull();
  });

  it('caches tab data per term and restores on revisit', async () => {
    const resultA = makeResult({ term: 'take off' });
    const resultB = makeResult({ term: 'get out' });

    // Open A, fetch translate.
    let shown = showPopup(state, resultA, 170, 100, 150, 200, 'Take off your shoes.');
    let container = shown.shell?.getContainer()!;
    const translate = container.querySelector('[data-cell-tab="translate"]') as HTMLButtonElement;
    translate.click();
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(shown.translation).toBe('Bỏ giày ra.');

    // Switch to B (no translate fetched).
    shown = showPopup(shown, resultB, 170, 100, 150, 200, 'Get out of here.');
    expect(shown.translation).toBe('');

    // Switch back to A — translation and cache key should restore.
    shown = showPopup(shown, resultA, 170, 100, 150, 200, 'Take off your shoes.');
    expect(shown.translation).toBe('Bỏ giày ra.');
    expect(shown.cachedResultTerm).toBe('take off');

    // Reopening A's translate tab should NOT re-fetch.
    container = shown.shell?.getContainer()!;
    mockSendMessage.mockClear();
    const translate2 = container.querySelector('[data-cell-tab="translate"]') as HTMLButtonElement;
    translate2.click();
    await new Promise((resolve) => setTimeout(resolve, 50));
    const translateCalls = mockSendMessage.mock.calls.filter((c: unknown[]) => (c[0] as { type?: string })?.type === 'TRANSLATE');
    expect(translateCalls.length).toBe(0);
  });
});

describe('appendCandidate', () => {
  let state: ReturnType<typeof createPopupDictionaryState>;

  beforeEach(() => {
    state = createPopupDictionaryState(makePopupSettings(), makeCardCreatorSettings());
  });

  it('appends a candidate to additionalResults', () => {
    const winner = makeResult({ term: 'get out' });
    const candidate = makeResult({ term: 'get over' });
    let s = showPopup(state, winner, 170, 100, 150, 200, 'sentence');
    s = appendCandidate(s, candidate, 'sentence');
    expect(s.additionalResults).toHaveLength(1);
    expect(s.additionalResults[0]!.term).toBe('get over');
  });

  it('renders a second .js-cell-popup-candidate element in the shell', () => {
    const winner = makeResult({ term: 'get out' });
    const candidate = makeResult({ term: 'get over' });
    let s = showPopup(state, winner, 170, 100, 150, 200, 'sentence');
    s = appendCandidate(s, candidate, 'sentence');
    const container = s.shell?.getContainer();
    expect(container).not.toBeNull();
    const candidates = container!.querySelectorAll('.js-cell-popup-candidate');
    expect(candidates).toHaveLength(2);
  });

  it('no-ops when shell is null', () => {
    const candidate = makeResult({ term: 'get over' });
    const s = appendCandidate(state, candidate, 'sentence');
    expect(s.additionalResults).toEqual([]);
  });

  it('every candidate (winner + appended) has a .js-cell-toolbar', () => {
    const winner = makeResult({ term: 'get out' });
    const candidate = makeResult({ term: 'get over' });
    let s = showPopup(state, winner, 170, 100, 150, 200, 'sentence');
    s = appendCandidate(s, candidate, 'sentence');
    const container = s.shell?.getContainer();
    const candidates = container!.querySelectorAll('.js-cell-popup-candidate');
    expect(candidates).toHaveLength(2);
    for (const cand of candidates) {
      const toolbars = cand.querySelectorAll('.js-cell-toolbar');
      expect(toolbars).toHaveLength(1);
    }
  });
});

describe('hidePopup', () => {
  it('clears currentResult', () => {
    const state = createPopupDictionaryState(makePopupSettings(), makeCardCreatorSettings());
    const shown = showPopup(state, makeResult(), 170, 100, 150, 200, 'sentence');
    const hidden = hidePopup(shown);
    expect(hidden.currentResult).toBeNull();
  });

  it('clears activeTab', () => {
    const state = createPopupDictionaryState(
      makePopupSettings({ defaultActiveTab: 'audio' }),
      makeCardCreatorSettings(),
    );
    const hidden = hidePopup(state);
    expect(hidden.activeTab).toBeNull();
  });

  it('keeps tab panel cache data', () => {
    const state = createPopupDictionaryState(makePopupSettings(), makeCardCreatorSettings());
    const shown = showPopup(state, makeResult(), 170, 100, 150, 200, 'Take off your shoes.');
    const hidden = hidePopup(shown);
    expect(hidden.translation).toBe(shown.translation);
    expect(hidden.cachedResultTerm).toBe('take off');
    expect(hidden.cachedContextSentence).toBe('Take off your shoes.');
  });
});

describe('destroyPopup', () => {
  it('clears shell', () => {
    const state = createPopupDictionaryState(makePopupSettings(), makeCardCreatorSettings());
    const shown = showPopup(state, makeResult(), 170, 100, 150, 200, 'sentence');
    const destroyed = destroyPopup(shown);
    expect(destroyed.shell).toBeNull();
    expect(destroyed.currentResult).toBeNull();
  });
});

describe('cycleStatus', () => {
  it('cycles unknown → tracking', () => {
    const state = createPopupDictionaryState(makePopupSettings(), makeCardCreatorSettings());
    const shown = showPopup(state, makeResult(), 170, 100, 150, 200, 'sentence');
    const cycled = cycleStatus(shown);
    expect(cycled.currentStatus).toBe('tracking');
  });

  it('cycles tracking → known', () => {
    const state = createPopupDictionaryState(makePopupSettings(), makeCardCreatorSettings());
    const shown = showPopup(state, makeResult(), 170, 100, 150, 200, 'sentence');
    const cycled1 = cycleStatus(shown);
    const cycled2 = cycleStatus(cycled1);
    expect(cycled2.currentStatus).toBe('known');
  });

  it('cycles ignore → unknown (wraps around)', () => {
    const state = createPopupDictionaryState(makePopupSettings(), makeCardCreatorSettings());
    const shown = showPopup(state, makeResult({ status: 'ignore' as WordStatus }), 170, 100, 150, 200, 'sentence');
    const cycled = cycleStatus(shown);
    expect(cycled.currentStatus).toBe('unknown');
  });

  it('no-op when no current result', () => {
    const state = createPopupDictionaryState(makePopupSettings(), makeCardCreatorSettings());
    const cycled = cycleStatus(state);
    expect(cycled.currentStatus).toBe('unknown');
  });
});

describe('toggleDefinition', () => {
  it('toggles definition selection', () => {
    const state = createPopupDictionaryState(makePopupSettings(), makeCardCreatorSettings());
    const shown = showPopup(state, makeResult(), 170, 100, 150, 200, 'sentence');
    const toggled = toggleDefinition(shown, 'd1', false);
    expect(toggled.definitionSelection.get('d1')).toBe(false);
  });
});

describe('toggleTab', () => {
  it('opens tab when none active', () => {
    const state = createPopupDictionaryState(makePopupSettings(), makeCardCreatorSettings());
    const shown = showPopup(state, makeResult(), 170, 100, 150, 200, 'sentence');
    const toggled = toggleTab(shown, 'audio');
    expect(toggled.activeTab).toBe('audio');
  });

  it('closes tab when clicking active tab', () => {
    const state = createPopupDictionaryState(makePopupSettings(), makeCardCreatorSettings());
    const shown = showPopup(state, makeResult(), 170, 100, 150, 200, 'sentence');
    const opened = toggleTab(shown, 'audio');
    const closed = toggleTab(opened, 'audio');
    expect(closed.activeTab).toBeNull();
  });

  it('switches tab when clicking different tab', () => {
    const state = createPopupDictionaryState(makePopupSettings(), makeCardCreatorSettings());
    const shown = showPopup(state, makeResult(), 170, 100, 150, 200, 'sentence');
    const opened = toggleTab(shown, 'audio');
    const switched = toggleTab(opened, 'image');
    expect(switched.activeTab).toBe('image');
  });
});

describe('getInitialPopupSize', () => {
  it('clamps to viewport', () => {
    const size = getInitialPopupSize(makePopupSettings({ popupWidthPx: 2000, popupMaxHeightPx: 2000 }));
    expect(size.width).toBeLessThanOrEqual(1920 - 16);
    expect(size.maxHeight).toBeLessThanOrEqual(1080 * 0.7);
  });

  it('enforces minimum width', () => {
    const size = getInitialPopupSize(makePopupSettings({ popupWidthPx: 100, popupMaxHeightPx: 100 }));
    expect(size.width).toBeGreaterThanOrEqual(320);
    expect(size.maxHeight).toBeGreaterThanOrEqual(200);
  });
});
