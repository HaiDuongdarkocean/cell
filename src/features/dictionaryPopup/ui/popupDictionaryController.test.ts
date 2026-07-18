// popupDictionaryController tests — spec redesign: active candidate + candidates chips.

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
  appendCandidate,
  setActiveCandidate,
  getInitialPopupSize,
} from './popupDictionaryController';
import type { PopupDictionaryState } from './popupDictionaryController';
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

/** Create popup state with default settings + nativeLang='vi'. Hides the
 *  two undefined positional args (onCardCreatorAction, onQuickAddDirect). */
function makePopupState(
  popupOverrides: Partial<DictionaryPopupSettings> = {},
  nativeLang = 'vi',
): PopupDictionaryState {
  return createPopupDictionaryState(makePopupSettings(popupOverrides), makeCardCreatorSettings(), undefined, undefined, nativeLang);
}

describe('createPopupDictionaryState', () => {
  it('creates state with default values', () => {
    const state = makePopupState();
    expect(state.currentResult).toBeNull();
    expect(state.currentStatus).toBe('unknown');
    expect(state.activeTab).toBeNull();
    expect(state.shell).toBeNull();
    expect(state.activeCandidateIndex).toBe(0);
    expect(state.candidateStates.size).toBe(0);
  });

  it('uses defaultActiveTab from settings', () => {
    const state = makePopupState({ defaultActiveTab: 'audio' });
    expect(state.activeTab).toBe('audio');
  });
});

describe('showPopup', () => {
  let state: ReturnType<typeof createPopupDictionaryState>;

  beforeEach(() => {
    state = makePopupState();
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

  it('resets activeCandidateIndex on show', () => {
    state = { ...state, activeCandidateIndex: 2 };
    const result = makeResult();
    const newState = showPopup(state, result, 170, 100, 150, 200, 'sentence');
    expect(newState.activeCandidateIndex).toBe(0);
  });

  it('invokes onDismiss callback with hidden state when shell dismisses', () => {
    const result = makeResult();
    const onDismiss = jest.fn();
    const newState = showPopup(state, result, 170, 100, 150, 200, 'sentence', onDismiss);
    // Simulate shell dismiss (Esc / click outside).
    (newState.shell as unknown as { onDismiss: () => void })?.onDismiss?.();
    expect(onDismiss).toHaveBeenCalledTimes(1);
    const dismissedState = onDismiss.mock.calls[0]![0] as PopupDictionaryState;
    expect(dismissedState.currentResult).toBeNull();
  });

  it('renders .js-cell-toolbar inside the materials slot (1 toolbar per popup)', () => {
    const result = makeResult();
    const newState = showPopup(state, result, 170, 100, 150, 200, 'sentence');
    const container = newState.shell?.getContainer();
    const materialsSlot = container!.querySelector('.js-cell-materials-slot');
    expect(materialsSlot).not.toBeNull();
    expect(materialsSlot!.querySelector('.js-cell-toolbar')).not.toBeNull();
  });

  it('renders active entry + candidates + footer', () => {
    const result = makeResult();
    const newState = showPopup(state, result, 170, 100, 150, 200, 'sentence');
    const container = newState.shell?.getContainer();
    expect(container!.querySelector('.js-cell-active-entry')).not.toBeNull();
    expect(container!.querySelector('.js-cell-candidates')).not.toBeNull();
    expect(container!.querySelector('.js-cell-footer')).not.toBeNull();
  });

  it('auto-translates sentence when translate tab is opened', async () => {
    const result = makeResult();
    const newState = showPopup(state, result, 170, 100, 150, 200, 'Take off your shoes.');
    const container = newState.shell?.getContainer();
    const translate = container!.querySelector('.js-cell-tab[data-cell-tab="translate"]') as HTMLButtonElement;
    translate.click();
    // Verify the panel opened.
    expect(container!.querySelector('.js-cell-panel[data-cell-panel="translate"]')).not.toBeNull();
    // Wait for async translateSentence (dynamic import + sendMessage roundtrip).
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(mockSendMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'TRANSLATE',
        payload: expect.objectContaining({ text: 'Take off your shoes.', sl: 'en', tl: 'vi' }),
      }),
    );
    // Panel must stay open after async translation completes.
    expect(container!.querySelector('.js-cell-panel[data-cell-panel="translate"]')).not.toBeNull();
  });

  it('does not auto-translate when context sentence is empty', async () => {
    const result = makeResult();
    const newState = showPopup(state, result, 170, 100, 150, 200, '');
    const container = newState.shell?.getContainer();
    const translate = container!.querySelector('.js-cell-tab[data-cell-tab="translate"]') as HTMLButtonElement;
    translate.click();
    await new Promise((resolve) => setTimeout(resolve, 10));
    const translateCalls = mockSendMessage.mock.calls.filter((c: unknown[]) => (c[0] as { type?: string })?.type === 'TRANSLATE');
    expect(translateCalls.length).toBe(0);
  });

  it('reuses cached translation when reopening same term+sentence', async () => {
    const result = makeResult();
    let shown = showPopup(state, result, 170, 100, 150, 200, 'Take off your shoes.');
    let container = shown.shell!.getContainer()!;
    const translate = container.querySelector('.js-cell-tab[data-cell-tab="translate"]') as HTMLButtonElement;
    translate.click();
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Close popup, then reopen same term + sentence.
    const hidden = hidePopup(shown);
    shown = showPopup(hidden, result, 170, 100, 150, 200, 'Take off your shoes.');
    container = shown.shell!.getContainer()!;

    // Translate tab should already show cached block; clicking tab does NOT re-fetch.
    mockSendMessage.mockClear();
    const translate2 = container.querySelector('.js-cell-tab[data-cell-tab="translate"]') as HTMLButtonElement;
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
    let container = shown.shell!.getContainer()!;
    const translate = container.querySelector('.js-cell-tab[data-cell-tab="translate"]') as HTMLButtonElement;
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
    container = shown.shell!.getContainer()!;
    mockSendMessage.mockClear();
    const translate2 = container.querySelector('.js-cell-tab[data-cell-tab="translate"]') as HTMLButtonElement;
    translate2.click();
    await new Promise((resolve) => setTimeout(resolve, 50));
    const translateCalls = mockSendMessage.mock.calls.filter((c: unknown[]) => (c[0] as { type?: string })?.type === 'TRANSLATE');
    expect(translateCalls.length).toBe(0);
  });
});

describe('appendCandidate', () => {
  let state: ReturnType<typeof createPopupDictionaryState>;

  beforeEach(() => {
    state = makePopupState();
  });

  it('appends a candidate to additionalResults', () => {
    const winner = makeResult({ term: 'get out' });
    const candidate = makeResult({ term: 'get over' });
    let s = showPopup(state, winner, 170, 100, 150, 200, 'sentence');
    s = appendCandidate(s, candidate, 'sentence');
    expect(s.additionalResults).toHaveLength(1);
    expect(s.additionalResults[0]!.term).toBe('get over');
  });

  it('renders candidates chips after append (only when > 2 candidates)', () => {
    const winner = makeResult({ term: 'get out' });
    const c1 = makeResult({ term: 'get over' });
    const c2 = makeResult({ term: 'get by' });
    let s = showPopup(state, winner, 170, 100, 150, 200, 'sentence');
    s = appendCandidate(s, c1, 'sentence');
    // 2 candidates → no chips rendered
    let container = s.shell?.getContainer();
    expect(container!.querySelectorAll('.js-cell-chip').length).toBe(0);
    s = appendCandidate(s, c2, 'sentence');
    // 3 candidates → chips rendered
    container = s.shell?.getContainer();
    expect(container!.querySelectorAll('.js-cell-chip').length).toBe(3);
  });

  it('no-ops when shell is null', () => {
    const candidate = makeResult({ term: 'get over' });
    const s = appendCandidate(state, candidate, 'sentence');
    expect(s.additionalResults).toEqual([]);
  });

  it('keeps active entry on winner after append', () => {
    const winner = makeResult({ term: 'get out' });
    const candidate = makeResult({ term: 'get over' });
    let s = showPopup(state, winner, 170, 100, 150, 200, 'sentence');
    s = appendCandidate(s, candidate, 'sentence');
    expect(s.activeCandidateIndex).toBe(0);
    const container = s.shell?.getContainer();
    const activeTerm = container!.querySelector('.js-cell-active-entry .js-cell-term')?.textContent;
    expect(activeTerm).toBe('get out');
  });
});

describe('hidePopup', () => {
  it('clears currentResult', () => {
    const state = makePopupState();
    const shown = showPopup(state, makeResult(), 170, 100, 150, 200, 'sentence');
    const hidden = hidePopup(shown);
    expect(hidden.currentResult).toBeNull();
  });

  it('clears activeTab', () => {
    const state = makePopupState({ defaultActiveTab: 'audio' });
    const shown = showPopup(state, makeResult(), 170, 100, 150, 200, 'sentence');
    const hidden = hidePopup(shown);
    expect(hidden.activeTab).toBeNull();
  });

  it('keeps tab panel cache data', () => {
    const state = makePopupState();
    const shown = showPopup(state, makeResult(), 170, 100, 150, 200, 'Take off your shoes.');
    const hidden = hidePopup(shown);
    expect(hidden.translation).toBe(shown.translation);
    expect(hidden.cachedResultTerm).toBe('take off');
    expect(hidden.cachedContextSentence).toBe('Take off your shoes.');
  });
});

describe('destroyPopup', () => {
  it('clears shell', () => {
    const state = makePopupState();
    const shown = showPopup(state, makeResult(), 170, 100, 150, 200, 'sentence');
    const destroyed = destroyPopup(shown);
    expect(destroyed.shell).toBeNull();
    expect(destroyed.currentResult).toBeNull();
  });
});

describe('cycleStatus', () => {
  it('cycles unknown → tracking', () => {
    const state = makePopupState();
    const shown = showPopup(state, makeResult(), 170, 100, 150, 200, 'sentence');
    const cycled = cycleStatus(shown);
    expect(cycled.currentStatus).toBe('tracking');
  });

  it('cycles tracking → known', () => {
    const state = makePopupState();
    const shown = showPopup(state, makeResult(), 170, 100, 150, 200, 'sentence');
    const cycled1 = cycleStatus(shown);
    const cycled2 = cycleStatus(cycled1);
    expect(cycled2.currentStatus).toBe('known');
  });

  it('updates header status badge in DOM', () => {
    const state = makePopupState();
    const shown = showPopup(state, makeResult(), 170, 100, 150, 200, 'sentence');
    const cycled = cycleStatus(shown);
    const container = cycled.shell?.getContainer();
    const badge = container!.querySelector('.cell-header__second .js-cell-status');
    expect(badge?.textContent).toBe('tracking');
  });
});

describe('toggleDefinition', () => {
  it('toggles definition selection', () => {
    const state = makePopupState();
    const shown = showPopup(state, makeResult(), 170, 100, 150, 200, 'sentence');
    const toggled = toggleDefinition(shown, 'd1', false);
    expect(toggled.definitionSelection.get('d1')).toBe(false);
  });
});

describe('toggleTab', () => {
  it('sets activeTab to clicked tab', () => {
    const state = makePopupState();
    const shown = showPopup(state, makeResult(), 170, 100, 150, 200, 'sentence');
    const toggled = toggleTab(shown, 'audio');
    expect(toggled.activeTab).toBe('audio');
  });

  it('closes activeTab when same tab clicked', () => {
    const state = makePopupState({ defaultActiveTab: 'audio' });
    const shown = showPopup(state, makeResult(), 170, 100, 150, 200, 'sentence');
    const toggled = toggleTab(shown, 'audio');
    expect(toggled.activeTab).toBeNull();
  });

  it('renders panel in materials body', () => {
    const state = makePopupState();
    const shown = showPopup(state, makeResult(), 170, 100, 150, 200, 'sentence');
    const toggled = toggleTab(shown, 'links');
    const container = toggled.shell?.getContainer();
    const body = container!.querySelector('.js-cell-materials-slot .cell-materials__body');
    expect(body?.children.length).toBeGreaterThan(0);
  });
});

describe('getInitialPopupSize', () => {
  it('clamps popup size to viewport', () => {
    const settings = makePopupSettings({ popupWidthPx: 10000, popupMaxHeightPx: 10000 });
    const size = getInitialPopupSize(settings);
    expect(size.width).toBeLessThanOrEqual(window.innerWidth - 16);
    expect(size.maxHeight).toBeLessThanOrEqual(Math.round(window.innerHeight * 0.7));
  });
});

describe('setActiveCandidate', () => {
  let state: ReturnType<typeof createPopupDictionaryState>;

  beforeEach(() => {
    state = makePopupState();
  });

  it('switches activeCandidateIndex from 0 to 1', () => {
    const winner = makeResult({ term: 'get out' });
    const candidate = makeResult({ term: 'get over' });
    let s = showPopup(state, winner, 170, 100, 150, 200, 'sentence');
    s = appendCandidate(s, candidate, 'sentence');
    s = setActiveCandidate(s, 1);
    expect(s.activeCandidateIndex).toBe(1);
  });

  it('updates active entry term to the selected candidate', () => {
    const winner = makeResult({ term: 'get out' });
    const candidate = makeResult({ term: 'get over' });
    let s = showPopup(state, winner, 170, 100, 150, 200, 'sentence');
    s = appendCandidate(s, candidate, 'sentence');
    s = setActiveCandidate(s, 1);
    const container = s.shell?.getContainer();
    const activeTerm = container!.querySelector('.js-cell-active-entry .js-cell-term')?.textContent;
    expect(activeTerm).toBe('get over');
  });

  it('switches back to winner (index 0)', () => {
    const winner = makeResult({ term: 'get out' });
    const candidate = makeResult({ term: 'get over' });
    let s = showPopup(state, winner, 170, 100, 150, 200, 'sentence');
    s = appendCandidate(s, candidate, 'sentence');
    s = setActiveCandidate(s, 1);
    s = setActiveCandidate(s, 0);
    expect(s.activeCandidateIndex).toBe(0);
    const container = s.shell?.getContainer();
    const activeTerm = container!.querySelector('.js-cell-active-entry .js-cell-term')?.textContent;
    expect(activeTerm).toBe('get out');
  });

  it('highlights the active chip (only when > 2 candidates)', () => {
    const winner = makeResult({ term: 'get out' });
    const c1 = makeResult({ term: 'get over' });
    const c2 = makeResult({ term: 'get by' });
    let s = showPopup(state, winner, 170, 100, 150, 200, 'sentence');
    s = appendCandidate(s, c1, 'sentence');
    s = appendCandidate(s, c2, 'sentence');
    s = setActiveCandidate(s, 1);
    const container = s.shell?.getContainer();
    const activeChip = container!.querySelector('.js-cell-chip.btn--primary');
    expect(activeChip?.getAttribute('data-cell-candidate-idx')).toBe('1');
  });

  it('no-ops for out-of-range index', () => {
    const winner = makeResult({ term: 'get out' });
    let s = showPopup(state, winner, 170, 100, 150, 200, 'sentence');
    s = setActiveCandidate(s, 99);
    expect(s.activeCandidateIndex).toBe(0);
  });

  it('no-ops when shell is null', () => {
    const s = setActiveCandidate(state, 1);
    expect(s.activeCandidateIndex).toBe(0);
  });
});
