import { describe, expect, it, jest, beforeEach, afterEach } from '@jest/globals';
import { MESSAGE_TYPES } from '@/shared/config/messages';
import { createContentScriptMessageHandlers } from './contentScriptMessages';
import type { ContentScriptContext } from './contentScriptContext';

jest.mock('@/shared/lib/storage/settingsStore', () => ({
  loadSettings: jest.fn(async () => ({})),
}));

jest.mock('../cuesStore', () => ({
  useCuesStore: {
    getState: jest.fn(() => ({ setLoadStatus: jest.fn() })),
  },
}));

jest.mock('@/features/translate/logic/translatePrefill', () => ({
  BackgroundPrefillController: jest.fn(),
}));

jest.mock('@/features/detection/logic/languageDetector', () => ({
  isoCodeToLabel: jest.fn(() => 'English'),
}));

jest.mock('@/features/subtitle', () => ({
  seekVideo: jest.fn(),
  resumeIfPaused: jest.fn(),
  navigateCue: jest.fn(),
  handleAutoLoadSubtitles: jest.fn(async () => {}),
  mergeCuesForPanel: jest.fn(() => []),
  showToast: jest.fn(),
  createTranslateFunction: jest.fn(() => jest.fn()),
  broadcastCues: jest.fn(),
}));

function createCtx(): ContentScriptContext {
  let lastAutoLoadUrl: string | undefined;
  let lastAutoLoadKey: string | undefined;
  return {
    video: document.createElement('video'),
    container: document.createElement('div'),
    blockController: {
      clearCues: jest.fn(),
      loadCues: jest.fn(),
      loadBilingualCues: jest.fn(),
    },
    syncController: {
      latestTargetCues: [],
      activeNativeSource: 'auto',
    },
    sharedWebTextCtrl: undefined,
    debouncedToast: jest.fn(),
    getOffsetController: () => null,
    getShortcuts: () => [],
    isSidePanelOpen: () => false,
    setSidePanelOpen: jest.fn(),
    getEffectiveMs: () => 0,
    getBilingualCues: () => [],
    setBilingualCues: jest.fn(),
    getTranslatePrefill: () => null,
    setTranslatePrefill: jest.fn(),
    getLastAutoLoadUrl: () => lastAutoLoadUrl,
    setLastAutoLoadUrl: (url: string | undefined) => { lastAutoLoadUrl = url; },
    getLastAutoLoadKey: () => lastAutoLoadKey,
    setLastAutoLoadKey: (key: string | undefined) => { lastAutoLoadKey = key; },
    showOverlay: jest.fn(),
    toggleOverlay: jest.fn(),
    togglePlay: jest.fn(),
    refreshPanel: jest.fn(),
    syncSidePanelFromBlock: jest.fn(),
    clearTranslatedNativeState: jest.fn(),
    updateGenerateNativeEnabled: jest.fn(),
    handleCardCreatorAction: jest.fn(async () => {}),
    handleGenerateNative: jest.fn(async () => {}),
    handleSubtitleStatusKey: () => false,
    syncSubtitleTokenize: jest.fn(async () => {}),
  } as unknown as ContentScriptContext;
}

const AUTO_LOAD_MSG = {
  type: MESSAGE_TYPES.AUTO_LOAD_SUBTITLES,
  payload: {
    tabId: 1,
    target: { url: 'https://example.com/target.srt', language: 'en', format: 'srt' },
    native: { url: 'https://example.com/native.srt', language: 'vi', format: 'srt' },
  },
};

describe('createContentScriptMessageHandlers AUTO_LOAD_SUBTITLES', () => {
  beforeEach(() => {
    document.documentElement.removeAttribute('data-cell-debug-autoload-arr');
  });

  afterEach(() => {
    delete (globalThis as Record<string, unknown>).__CELL_DEBUG__;
    jest.restoreAllMocks();
  });

  it('posts __CELL_AUTOLOAD_HANDLED to the parent at window.location.origin', () => {
    const postSpy = jest.spyOn(window, 'postMessage').mockImplementation(() => {});
    const { onRuntimeMessage2 } = createContentScriptMessageHandlers(createCtx());

    void onRuntimeMessage2(AUTO_LOAD_MSG, {}, jest.fn());

    const calls = postSpy.mock.calls as unknown as [unknown, string | undefined][];
    const handled = calls.find((c) => (c[0] as { type?: string })?.type === '__CELL_AUTOLOAD_HANDLED');
    expect(handled?.[0]).toEqual(
      expect.objectContaining({
        target: 'https://example.com/target.srt',
        native: 'https://example.com/native.srt',
      }),
    );
    expect(handled?.[1]).toBe(window.location.origin);
    expect(calls.every((c) => c[1] !== '*')).toBe(true);
  });

  it('does not write data-cell-debug-autoload-arr when __CELL_DEBUG__ is off', () => {
    const { onRuntimeMessage2 } = createContentScriptMessageHandlers(createCtx());

    void onRuntimeMessage2(AUTO_LOAD_MSG, {}, jest.fn());

    expect(document.documentElement.getAttribute('data-cell-debug-autoload-arr')).toBeNull();
  });

  it('writes data-cell-debug-autoload-arr when __CELL_DEBUG__ is on', () => {
    (globalThis as Record<string, unknown>).__CELL_DEBUG__ = 'true';
    jest.spyOn(window, 'postMessage').mockImplementation(() => {});
    const { onRuntimeMessage2 } = createContentScriptMessageHandlers(createCtx());

    void onRuntimeMessage2(AUTO_LOAD_MSG, {}, jest.fn());

    const attr = document.documentElement.getAttribute('data-cell-debug-autoload-arr');
    expect(attr).not.toBeNull();
    expect(JSON.parse(attr!)).toEqual([
      expect.objectContaining({ step: 'msg-received', hasTarget: true, hasNative: true }),
    ]);
  });
});
