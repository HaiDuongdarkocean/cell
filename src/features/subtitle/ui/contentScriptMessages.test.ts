import { describe, expect, it, jest, beforeEach, afterEach } from '@jest/globals';
import { MESSAGE_TYPES } from '@/shared/config/messages';
import { createContentScriptMessageHandlers } from './contentScriptMessages';
import { handleAutoLoadSubtitles } from '@/features/subtitle';
import type { ContentScriptContext } from './contentScriptContext';
import type { AutoLoadDeps } from '@/features/subtitle/logic/subtitleAutoLoad';
import type { SrtCue } from '@/entities/media';

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

jest.mock('@/shared/lib/dom/frameOrigin', () => ({
  resolveParentFrameOrigin: jest.fn(() => 'https://parent.example'),
  isResolvableHttpOrigin: jest.requireActual<
    typeof import('@/shared/lib/dom/frameOrigin')
  >('@/shared/lib/dom/frameOrigin').isResolvableHttpOrigin,
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
    document.documentElement.removeAttribute('data-tihoka-debug-autoload-arr');
  });

  afterEach(() => {
    delete (globalThis as Record<string, unknown>).__Tihoka_DEBUG__;
    jest.restoreAllMocks();
  });

  it('posts __Tihoka_AUTOLOAD_HANDLED to the resolved parent origin when debug is on', () => {
    (globalThis as Record<string, unknown>).__Tihoka_DEBUG__ = 'true';
    const postSpy = jest.spyOn(window, 'postMessage').mockImplementation(() => {});
    const { onRuntimeMessage2 } = createContentScriptMessageHandlers(createCtx());

    void onRuntimeMessage2(AUTO_LOAD_MSG, {}, jest.fn());

    const calls = postSpy.mock.calls as unknown as [unknown, string | undefined][];
    const handled = calls.find((c) => (c[0] as { type?: string })?.type === '__Tihoka_AUTOLOAD_HANDLED');
    expect(handled?.[0]).toEqual(
      expect.objectContaining({
        target: 'https://example.com/target.srt',
        native: 'https://example.com/native.srt',
      }),
    );
    expect(handled?.[1]).toBe('https://parent.example');
    expect(calls.every((c) => c[1] !== '*')).toBe(true);
  });

  it('does not post __Tihoka_AUTOLOAD_HANDLED when debug is off', () => {
    const postSpy = jest.spyOn(window, 'postMessage').mockImplementation(() => {});
    const { onRuntimeMessage2 } = createContentScriptMessageHandlers(createCtx());

    void onRuntimeMessage2(AUTO_LOAD_MSG, {}, jest.fn());

    const calls = postSpy.mock.calls as unknown as [unknown, string | undefined][];
    expect(calls.find((c) => (c[0] as { type?: string })?.type === '__Tihoka_AUTOLOAD_HANDLED')).toBeUndefined();
  });

  it('does not write data-tihoka-debug-autoload-arr when __Tihoka_DEBUG__ is off', () => {
    const { onRuntimeMessage2 } = createContentScriptMessageHandlers(createCtx());

    void onRuntimeMessage2(AUTO_LOAD_MSG, {}, jest.fn());

    expect(document.documentElement.getAttribute('data-tihoka-debug-autoload-arr')).toBeNull();
  });

  it('writes data-tihoka-debug-autoload-arr when __Tihoka_DEBUG__ is on', () => {
    (globalThis as Record<string, unknown>).__Tihoka_DEBUG__ = 'true';
    jest.spyOn(window, 'postMessage').mockImplementation(() => {});
    const { onRuntimeMessage2 } = createContentScriptMessageHandlers(createCtx());

    void onRuntimeMessage2(AUTO_LOAD_MSG, {}, jest.fn());

    const attr = document.documentElement.getAttribute('data-tihoka-debug-autoload-arr');
    expect(attr).not.toBeNull();
    expect(JSON.parse(attr!)).toEqual([
      expect.objectContaining({ step: 'msg-received', hasTarget: true, hasNative: true }),
    ]);
  });

  it('applies deps writes when the canonical URL is unchanged after receipt', async () => {
    history.pushState({}, '', '/watch?v=video-a');
    const ctx = createCtx();
    const blockController = ctx.blockController as unknown as { loadBilingualCues: jest.Mock };
    let capturedDeps: AutoLoadDeps | undefined;
    jest.mocked(handleAutoLoadSubtitles).mockImplementation(async (_p, deps) => {
      capturedDeps = deps;
    });
    const { onRuntimeMessage2 } = createContentScriptMessageHandlers(ctx);

    void onRuntimeMessage2(AUTO_LOAD_MSG, {}, jest.fn());
    await new Promise((resolve) => setTimeout(resolve, 0));

    const cues: SrtCue[] = [{ index: 1, start: 0, end: 1000, text: 'a' }];
    capturedDeps!.controller.loadBilingualCues(cues, []);
    expect(blockController.loadBilingualCues).toHaveBeenCalledWith(cues, []);
    history.pushState({}, '', '/');
  });

  it('drops stale deps writes when the canonical URL changed after receipt', async () => {
    history.pushState({}, '', '/watch?v=video-a');
    const ctx = createCtx();
    const blockController = ctx.blockController as unknown as {
      loadBilingualCues: jest.Mock;
      loadCues: jest.Mock;
      clearCues: jest.Mock;
    };
    let capturedDeps: AutoLoadDeps | undefined;
    jest.mocked(handleAutoLoadSubtitles).mockImplementation(async (_p, deps) => {
      capturedDeps = deps;
    });
    const { onRuntimeMessage2 } = createContentScriptMessageHandlers(ctx);

    void onRuntimeMessage2(AUTO_LOAD_MSG, {}, jest.fn());
    await new Promise((resolve) => setTimeout(resolve, 0));

    history.pushState({}, '', '/watch?v=video-b');
    const cues: SrtCue[] = [{ index: 1, start: 0, end: 1000, text: 'a' }];
    capturedDeps!.controller.loadBilingualCues(cues, []);
    capturedDeps!.controller.loadCues(cues);
    capturedDeps!.controller.clearCues();
    capturedDeps!.onPanelRender?.(cues, []);
    capturedDeps!.onLoadStatus?.('target', { state: 'loaded' });
    expect(blockController.loadBilingualCues).not.toHaveBeenCalled();
    expect(blockController.loadCues).not.toHaveBeenCalled();
    expect(blockController.clearCues).not.toHaveBeenCalled();
    expect(ctx.setBilingualCues).not.toHaveBeenCalled();
    history.pushState({}, '', '/');
  });

  it('drops a stale push whose pageUrl belongs to the previous video', async () => {
    history.pushState({}, '', '/watch?v=video-b');
    const ctx = createCtx();
    const handleAutoLoadMock = jest.mocked(handleAutoLoadSubtitles);
    handleAutoLoadMock.mockClear();
    const { onRuntimeMessage2 } = createContentScriptMessageHandlers(ctx);

    void onRuntimeMessage2(
      {
        type: MESSAGE_TYPES.AUTO_LOAD_SUBTITLES,
        payload: {
          ...AUTO_LOAD_MSG.payload,
          pageUrl: 'http://localhost/watch?v=video-a',
        },
      },
      {},
      jest.fn(),
    );
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(handleAutoLoadMock).not.toHaveBeenCalled();
    expect(ctx.getLastAutoLoadKey()).toBeUndefined();
    history.pushState({}, '', '/');
  });

  it('applies a push whose pageUrl matches the current video', async () => {
    history.pushState({}, '', '/watch?v=video-b');
    const ctx = createCtx();
    const handleAutoLoadMock = jest.mocked(handleAutoLoadSubtitles);
    handleAutoLoadMock.mockClear();
    const { onRuntimeMessage2 } = createContentScriptMessageHandlers(ctx);

    void onRuntimeMessage2(
      {
        type: MESSAGE_TYPES.AUTO_LOAD_SUBTITLES,
        payload: {
          ...AUTO_LOAD_MSG.payload,
          pageUrl: 'http://localhost/watch?v=video-b',
        },
      },
      {},
      jest.fn(),
    );
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(handleAutoLoadMock).toHaveBeenCalled();
    history.pushState({}, '', '/');
  });

  it('drops stale deps writes when the auto-load key was cleared by nav', async () => {
    history.pushState({}, '', '/watch?v=video-a');
    const ctx = createCtx();
    const blockController = ctx.blockController as unknown as { loadBilingualCues: jest.Mock };
    let capturedDeps: AutoLoadDeps | undefined;
    jest.mocked(handleAutoLoadSubtitles).mockImplementation(async (_p, deps) => {
      capturedDeps = deps;
    });
    const { onRuntimeMessage2 } = createContentScriptMessageHandlers(ctx);

    void onRuntimeMessage2(AUTO_LOAD_MSG, {}, jest.fn());
    await new Promise((resolve) => setTimeout(resolve, 0));

    ctx.setLastAutoLoadKey(undefined);
    capturedDeps!.controller.loadBilingualCues([{ index: 1, start: 0, end: 1000, text: 'a' }], []);
    expect(blockController.loadBilingualCues).not.toHaveBeenCalled();
    history.pushState({}, '', '/');
  });
});
