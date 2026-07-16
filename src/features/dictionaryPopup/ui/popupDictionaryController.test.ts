// popupDictionaryController tests — spec §4.6.3 P0: full flow wiring.

import { describe, expect, it, beforeEach } from '@jest/globals';
import {
  createPopupDictionaryState,
  showPopup,
  hidePopup,
  destroyPopup,
  cycleStatus,
  toggleDefinition,
  toggleTab,
  getInitialPopupSize,
} from './popupDictionaryController';
import type { LookupResult, WordStatus } from '../types';
import type { DictionaryPopupSettings, CardCreatorSettings } from '@/entities/settings/types';

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
