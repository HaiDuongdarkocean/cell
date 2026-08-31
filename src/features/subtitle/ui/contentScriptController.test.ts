import { describe, expect, it, jest, beforeEach, afterEach } from '@jest/globals';
import type { ActiveStudyMode } from '@/features/studyModes/content/studyModeController';
import { MESSAGE_TYPES } from '@/shared/config/messages';
import {
  DEFAULT_SETTINGS,
  DEFAULT_OVERLAY_STYLE_TARGET,
  DEFAULT_OVERLAY_STYLE_NATIVE,
  DEFAULT_SUBTITLE_BLOCK_SETTINGS,
  DEFAULT_NAV_CLUSTER_SETTINGS,
} from '@/shared/config/config';
import { init } from './contentScriptController';
import { ReactSubtitleController } from './reactSubtitleController';
import { findVideoContainer } from '@/features/subtitle/logic/findPlayerContainer';
import { getActiveStudyMode, subscribeToStudyMode } from '@/features/studyModes/content/studyModeController';
import {
  sendMessage,
  onMessage,
  onStorageChanged,
  removeOnMessageListener,
  removeOnStorageChangedListener,
} from '@/shared/lib/chrome-apis';
import { loadSettings, saveSettings } from '@/shared/lib/storage/settingsStore';
import { loadTokenizeSettings, isSubtitleTokenizeEnabledForUrl } from '@/features/tokenize/services/tokenizeSettingsStore';
import { handleShortcutKey, toggleOverlayState, seekVideo, handleAutoLoadSubtitles } from '@/features/subtitle';

jest.mock('./reactSubtitleController');

jest.mock('@/features/subtitle/logic/findPlayerContainer', () => ({
  findVideoContainer: jest.fn(),
}));

jest.mock('@/features/studyModes/content/studyModeController', () => ({
  getActiveStudyMode: jest.fn(),
  subscribeToStudyMode: jest.fn(),
}));

jest.mock('@/shared/lib/chrome-apis', () => ({
  sendMessage: jest.fn().mockResolvedValue(undefined),
  onMessage: jest.fn().mockReturnValue(jest.fn()),
  onStorageChanged: jest.fn().mockReturnValue(jest.fn()),
  removeOnMessageListener: jest.fn(),
  removeOnStorageChangedListener: jest.fn(),
}));

jest.mock('@/shared/lib/storage/settingsStore', () => ({
  loadSettings: jest.fn(),
  saveSettings: jest.fn(),
}));

jest.mock('@/shared/lib/themeTokens', () => ({
  injectThemeTokens: jest.fn(),
}));

jest.mock('@/features/tokenize/services/tokenizeSettingsStore', () => ({
  loadTokenizeSettings: jest.fn(),
  isSubtitleTokenizeEnabledForUrl: jest.fn().mockReturnValue(false),
}));

jest.mock('@/features/translate/logic/translatePrefill', () => ({
  BackgroundPrefillController: jest.fn().mockImplementation(() => ({
    isRunning: false,
    clear: jest.fn(),
    start: jest.fn(),
    pause: jest.fn(),
    resume: jest.fn(),
    cacheSize: 0,
  })),
}));

jest.mock('@/features/subtitle/actions/cardActions', () => ({
  handleCardCreatorAction: jest.fn(),
}));

jest.mock('@/features/subtitle/actions/generateNativeAction', () => ({
  startGenerateNative: jest.fn().mockResolvedValue(null),
}));

jest.mock('@/features/detection/logic/languageDetector', () => ({
  isoCodeToLabel: jest.fn().mockReturnValue('English'),
}));

jest.mock('@/features/subtitle', () => ({
  parseAndDetectFiles: jest.fn().mockResolvedValue([]),
  assignImportRole: jest.fn().mockReturnValue({ target: [], native: [], ignored: [] }),
  createDragHint: jest.fn().mockImplementation(() => document.createElement('div')),
  showToast: jest.fn(),
  createDebouncedToast: jest.fn().mockReturnValue(jest.fn()),
  handleAutoLoadSubtitles: jest.fn().mockResolvedValue(undefined),
  fetchAndParseSubtitle: jest.fn().mockResolvedValue({ success: true, cues: [] }),
  resolveFormat: jest.fn().mockReturnValue('srt'),
  mergeCuesForPanel: jest.fn().mockReturnValue([]),
  handleShortcutKey: jest.fn().mockReturnValue(null),
  isEditableTarget: jest.fn().mockReturnValue(false),
  isEditableEvent: jest.fn().mockReturnValue(false),
  isInsideCellUi: jest.fn().mockReturnValue(false),
  formatSubtitleName: jest.fn().mockReturnValue('Subtitle'),
  seekVideo: jest.fn(),
  playVideo: jest.fn().mockResolvedValue(undefined),
  pauseVideo: jest.fn(),
  createTranslateFunction: jest.fn().mockReturnValue(jest.fn()),
  broadcastCues: jest.fn(),
  loadSettingsOrToast: jest.fn().mockResolvedValue({}),
  navigateCue: jest.fn(),
  toggleOverlayState: jest.fn().mockImplementation((overlayVisible: boolean, targetStyle: unknown, nativeStyle: unknown) => ({
    overlayVisible: !overlayVisible,
    targetStyle: { ...(targetStyle as object), visible: !overlayVisible },
    nativeStyle: { ...(nativeStyle as object), visible: !overlayVisible },
  })),
  parseSubtitle: jest.fn().mockReturnValue({ success: true, cues: [] }),
}));

jest.mock('@/stores/cuesStore', () => ({
  useCuesStore: {
    getState: jest.fn().mockReturnValue({
      setLoadStatus: jest.fn(),
      setCues: jest.fn(),
      setActiveIndex: jest.fn(),
    }),
  },
}));

interface MockController {
  applyStudyMode: jest.Mock;
  updateSettings: jest.Mock;
  syncHiddenState: jest.Mock;
  setGenerateNativeEnabled: jest.Mock;
  init: jest.Mock;
  disableTokenize: jest.Mock;
  enableTokenize: jest.Mock;
  enableDictionaryPopup: jest.Mock;
  disableDictionaryPopup: jest.Mock;
  setHasSearchKeys: jest.Mock;
  setSearchApiKeys: jest.Mock;
  setOcrEnabled: jest.Mock;
  updateManagerItems: jest.Mock;
  refreshManagerState: jest.Mock;
  onApiKeysChange: jest.Mock;
  getTargetCues: jest.Mock;
  getNativeCues: jest.Mock;
  getCurrentTargetText: jest.Mock;
  getCurrentNativeText: jest.Mock;
  getActiveIndices: jest.Mock;
  getLineElements: jest.Mock;
  getOffsetMs: jest.Mock;
  loadBilingualCues: jest.Mock;
  loadCues: jest.Mock;
  clearCues: jest.Mock;
  stepBy: jest.Mock;
  reset: jest.Mock;
  togglePlayerMode: jest.Mock;
  toggleSplitView: jest.Mock;
  destroy: jest.Mock;
  isPlayerModeActive: boolean;
  onCuesUpdated?: () => void;
  onManagerSelect?: (role: 'target' | 'native', index: number) => void;
  onImportFiles?: (_role: 'target' | 'native', files: FileList) => void;
  onToggleSidePanel?: () => void;
  onToggleOcr?: () => void;
  onSearchResultSelect?: (result: unknown, role: 'target' | 'native') => void;
}

const MockedReactSubtitleController = jest.mocked(ReactSubtitleController);
const mockFindVideoContainer = jest.mocked(findVideoContainer);
const mockGetActiveStudyMode = jest.mocked(getActiveStudyMode);
const mockSubscribeToStudyMode = jest.mocked(subscribeToStudyMode);
const mockOnMessage = onMessage as unknown as jest.Mock;
const mockOnStorageChanged = onStorageChanged as unknown as jest.Mock;
const mockLoadSettings = jest.mocked(loadSettings);
const mockLoadTokenizeSettings = jest.mocked(loadTokenizeSettings);
const mockIsSubtitleTokenizeEnabledForUrl = jest.mocked(isSubtitleTokenizeEnabledForUrl);
const mockHandleShortcutKey = jest.mocked(handleShortcutKey);
const mockHandleAutoLoadSubtitles = jest.mocked(handleAutoLoadSubtitles);

type OnMessageCallback = (
  msg: unknown,
  _sender: chrome.runtime.MessageSender,
  _sendResponse: (response?: unknown) => void,
) => boolean | Promise<unknown> | void;

type OnStorageChangedCallback = (
  changes: Record<string, chrome.storage.StorageChange>,
  area: string,
) => void;

const fakeStudyMode = {
  id: 'test',
  type: 'custom',
  icon: 'bookOpen',
  title: 'Test',
  description: '',
  steps: [{ subtitle: 'target' as const, pause: 'none' as const, repeat: 1, speed: 1, after: 'continue' as const }],
} as unknown as ActiveStudyMode['activeMode'];

const fakeAdvanced = {
  skipNoDialogue: 'OFF' as const,
  removeBracketed: false,
} as ActiveStudyMode['advanced'];

function createMockController(): MockController {
  return {
    applyStudyMode: jest.fn(),
    updateSettings: jest.fn(),
    syncHiddenState: jest.fn(),
    setGenerateNativeEnabled: jest.fn(),
    init: jest.fn(),
    disableTokenize: jest.fn(),
    enableTokenize: jest.fn(),
    enableDictionaryPopup: jest.fn(),
    disableDictionaryPopup: jest.fn(),
    setHasSearchKeys: jest.fn(),
    setSearchApiKeys: jest.fn(),
    setOcrEnabled: jest.fn(),
    updateManagerItems: jest.fn(),
    refreshManagerState: jest.fn(),
    onApiKeysChange: jest.fn(),
    getTargetCues: jest.fn().mockReturnValue([]),
    getNativeCues: jest.fn().mockReturnValue([]),
    getCurrentTargetText: jest.fn().mockReturnValue(''),
    getCurrentNativeText: jest.fn().mockReturnValue(''),
    getActiveIndices: jest.fn().mockReturnValue({ target: -1, native: -1 }),
    getLineElements: jest.fn().mockReturnValue({ target: null, native: null }),
    getOffsetMs: jest.fn().mockReturnValue(0),
    loadBilingualCues: jest.fn(),
    loadCues: jest.fn(),
    clearCues: jest.fn(),
    stepBy: jest.fn(),
    reset: jest.fn(),
    togglePlayerMode: jest.fn(),
    toggleSplitView: jest.fn(),
    destroy: jest.fn(),
    isPlayerModeActive: false,
  };
}

function flushPromises(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

describe('contentScriptController', () => {
  let video: HTMLVideoElement;
  let container: HTMLDivElement;
  let blockController: MockController;
  let onMessageCallbacks: OnMessageCallback[];
  let onStorageChangedCallback: OnStorageChangedCallback | undefined;
  let onStorageChangedRemove: jest.Mock;
  let studyModeCallback: ((state: ActiveStudyMode | null) => void) | undefined;
  let unsubscribeStudyMode: jest.Mock;
  let windowRemoveListener: jest.SpyInstance;
  let documentRemoveListener: jest.SpyInstance;
  let cleanup: (() => void) | undefined;
  let cleanupCalled: boolean;

  beforeEach(() => {
    jest.useRealTimers();
    jest.clearAllMocks();

    onMessageCallbacks = [];
    onStorageChangedCallback = undefined;
    onStorageChangedRemove = jest.fn();
    studyModeCallback = undefined;
    unsubscribeStudyMode = jest.fn();

    document.body.innerHTML = '';
    video = document.createElement('video');
    container = document.createElement('div');
    container.appendChild(video);
    document.body.appendChild(container);

    blockController = createMockController();
    MockedReactSubtitleController.mockImplementation(() => blockController as unknown as ReactSubtitleController);

    mockFindVideoContainer.mockReturnValue(container);
    mockLoadSettings.mockResolvedValue(DEFAULT_SETTINGS);
    jest.mocked(saveSettings).mockResolvedValue(undefined);
    mockLoadTokenizeSettings.mockResolvedValue({
      schemaVersion: 1,
      origins: {},
      urls: {},
      subtitleUrls: {},
    });
    mockIsSubtitleTokenizeEnabledForUrl.mockReturnValue(false);

    mockGetActiveStudyMode.mockReturnValue(null);
    mockSubscribeToStudyMode.mockImplementation((cb) => {
      studyModeCallback = cb as (state: ActiveStudyMode | null) => void;
      return unsubscribeStudyMode as () => void;
    });

    mockOnMessage.mockImplementation((callback: unknown) => {
      onMessageCallbacks.push(callback as OnMessageCallback);
      return undefined;
    });

    mockOnStorageChanged.mockImplementation((callback: unknown) => {
      onStorageChangedCallback = callback as OnStorageChangedCallback;
      return onStorageChangedRemove;
    });

    windowRemoveListener = jest.spyOn(window, 'removeEventListener');
    documentRemoveListener = jest.spyOn(document, 'removeEventListener');

    cleanup = undefined;
    cleanupCalled = false;
  });

  afterEach(() => {
    if (!cleanupCalled && cleanup) {
      cleanup();
      cleanupCalled = true;
    }
    windowRemoveListener.mockRestore();
    documentRemoveListener.mockRestore();
  });

  it('init sets up ReactSubtitleController and applies initial study mode', async () => {
    mockGetActiveStudyMode.mockReturnValue({ activeMode: fakeStudyMode, advanced: fakeAdvanced });

    cleanup = init(video);

    expect(MockedReactSubtitleController).toHaveBeenCalledTimes(1);
    expect(MockedReactSubtitleController).toHaveBeenCalledWith(
      video,
      container,
      expect.objectContaining(DEFAULT_SUBTITLE_BLOCK_SETTINGS),
      expect.objectContaining({ ...DEFAULT_OVERLAY_STYLE_TARGET, visible: false }),
      expect.objectContaining({ ...DEFAULT_OVERLAY_STYLE_NATIVE, visible: false }),
      expect.objectContaining(DEFAULT_NAV_CLUSTER_SETTINGS),
      expect.any(Function),
      expect.any(Function),
    );

    expect(blockController.applyStudyMode).toHaveBeenCalledWith(fakeStudyMode, fakeAdvanced);

    await flushPromises();

    // After settings load, block settings are updated and a request for auto-load is sent.
    expect(blockController.updateSettings).toHaveBeenCalled();
    expect(sendMessage).toHaveBeenCalledWith({
      type: MESSAGE_TYPES.REQUEST_AUTO_LOAD_SUBTITLES,
      payload: { tabId: undefined },
    });

    cleanup!();
    cleanupCalled = true;
  });

  it('init subscribes to study mode changes and reapplies', async () => {
    cleanup = init(video);
    await flushPromises();

    expect(mockSubscribeToStudyMode).toHaveBeenCalledWith(expect.any(Function));
    expect(studyModeCallback).toBeDefined();

    const newStudyMode = {
      ...fakeStudyMode,
      id: 'updated',
      title: 'Updated',
    } as unknown as ActiveStudyMode['activeMode'];

    studyModeCallback!({ activeMode: newStudyMode, advanced: fakeAdvanced });

    expect(blockController.applyStudyMode).toHaveBeenCalledWith(newStudyMode, fakeAdvanced);

    cleanup!();
    cleanupCalled = true;
  });

  it('init registers onMessage and handles APPLY_STUDY_MODE', async () => {
    cleanup = init(video);
    await flushPromises();

    expect(mockOnMessage).toHaveBeenCalled();
    expect(onMessageCallbacks.length).toBeGreaterThanOrEqual(1);

    const onRuntimeMessage = onMessageCallbacks[0];
    onRuntimeMessage(
      {
        type: MESSAGE_TYPES.APPLY_STUDY_MODE,
        payload: { activeMode: fakeStudyMode, advanced: fakeAdvanced },
      },
      {},
      jest.fn(),
    );

    expect(blockController.applyStudyMode).toHaveBeenCalledWith(fakeStudyMode, fakeAdvanced);

    cleanup!();
    cleanupCalled = true;
  });

  it('init registers onStorageChanged and handles settings changes', async () => {
    cleanup = init(video);
    await flushPromises();

    expect(mockOnStorageChanged).toHaveBeenCalled();
    expect(onStorageChangedCallback).toBeDefined();

    blockController.updateSettings.mockClear();

    const changedSettings = {
      ...DEFAULT_SETTINGS,
      subtitleOverlayTargetStyle: { ...DEFAULT_OVERLAY_STYLE_TARGET, fontSize: 42 },
    };

    onStorageChangedCallback!(
      {
        settings: { newValue: changedSettings },
      },
      'local',
    );

    expect(blockController.updateSettings).toHaveBeenCalledWith(
      expect.objectContaining({
        targetStyle: expect.objectContaining({ fontSize: 42, visible: false }),
      }),
    );
    expect(blockController.setHasSearchKeys).toHaveBeenCalledWith(false);
    expect(blockController.setSearchApiKeys).toHaveBeenCalledWith([]);

    cleanup!();
    cleanupCalled = true;
  });

  it('cleanup removes listeners and destroys the controller', async () => {
    cleanup = init(video);
    await flushPromises();

    expect(onMessageCallbacks.length).toBeGreaterThanOrEqual(2);

    cleanup();

    expect(removeOnMessageListener).toHaveBeenCalledWith(onMessageCallbacks[0]);
    expect(removeOnMessageListener).toHaveBeenCalledWith(onMessageCallbacks[1]);
    expect(unsubscribeStudyMode).toHaveBeenCalled();
    expect(blockController.destroy).toHaveBeenCalled();

    expect(windowRemoveListener).toHaveBeenCalledWith('message', expect.any(Function));
    expect(windowRemoveListener).toHaveBeenCalledWith('keydown', expect.any(Function), true);
    expect(windowRemoveListener).toHaveBeenCalledWith('keyup', expect.any(Function), true);
    expect(windowRemoveListener).toHaveBeenCalledWith('yt-navigate-finish', expect.any(Function));
    expect(windowRemoveListener).toHaveBeenCalledWith('popstate', expect.any(Function));
    expect(documentRemoveListener).toHaveBeenCalledWith('visibilitychange', expect.any(Function));
    expect(documentRemoveListener).toHaveBeenCalledWith('__NF_SEEK', expect.any(Function));

    // onStorageChanged listener is removed in cleanup.
    expect(removeOnStorageChangedListener).toHaveBeenCalled();

    cleanupCalled = true;
  });

  it('onMessage AUTO_LOAD_SUBTITLES with no matches clears state', async () => {
    cleanup = init(video);
    await flushPromises();

    const onRuntimeMessage2 = onMessageCallbacks[1];
    onRuntimeMessage2(
      {
        type: MESSAGE_TYPES.AUTO_LOAD_SUBTITLES,
        payload: { tabId: 1, target: null, native: null },
      },
      {},
      jest.fn(),
    );

    await flushPromises();

    expect(blockController.clearCues).toHaveBeenCalled();
    expect(blockController.loadCues).toHaveBeenCalledWith(false);
    expect(blockController.updateManagerItems).toHaveBeenCalledWith('target', [], -1);
    expect(blockController.updateManagerItems).toHaveBeenCalledWith('native', [], -1);

    cleanup!();
    cleanupCalled = true;
  });

  it('onMessage AUTO_LOAD_SUBTITLES with target triggers load callbacks', async () => {
    cleanup = init(video);
    await flushPromises();

    interface AutoLoadControllerLike {
      loadBilingualCues: (t: unknown[], n: unknown[]) => void;
      loadCues: (c: unknown[]) => void;
      clearCues: () => void;
    }

    interface AutoLoadDepsLike {
      controller: AutoLoadControllerLike;
      onPanelRender: (t: unknown[], n: unknown[]) => void;
      onSubtitleMatches: (t: unknown[], n: unknown[]) => void;
    }

    mockHandleAutoLoadSubtitles.mockImplementation((_payload: unknown, deps: AutoLoadDepsLike) => {
      deps.onPanelRender([], []);
      deps.onSubtitleMatches([], []);
      deps.controller.loadBilingualCues([], []);
      return Promise.resolve();
    });

    blockController.updateSettings.mockClear();
    blockController.loadBilingualCues.mockClear();

    const onRuntimeMessage2 = onMessageCallbacks[1];
    onRuntimeMessage2(
      {
        type: MESSAGE_TYPES.AUTO_LOAD_SUBTITLES,
        payload: { tabId: 1, target: { url: 'https://example.com/target.srt', language: 'en', format: 'srt' }, native: null },
      },
      {},
      jest.fn(),
    );

    await flushPromises();

    expect(mockHandleAutoLoadSubtitles).toHaveBeenCalled();
    expect(blockController.loadBilingualCues).toHaveBeenCalled();
    expect(blockController.updateSettings).toHaveBeenCalledWith(
      expect.objectContaining({
        targetStyle: expect.objectContaining({ visible: true }),
        nativeStyle: expect.objectContaining({ visible: true }),
      }),
    );
    expect(blockController.syncHiddenState).toHaveBeenCalled();

    cleanup!();
    cleanupCalled = true;
  });

  it('keydown shortcut toggle-overlay updates block controller', async () => {
    cleanup = init(video);
    await flushPromises();

    mockHandleShortcutKey.mockReturnValue('toggle-overlay' as ReturnType<typeof handleShortcutKey>);

    blockController.updateSettings.mockClear();
    blockController.syncHiddenState.mockClear();

    document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'w', bubbles: true }));

    expect(mockHandleShortcutKey).toHaveBeenCalled();
    expect(toggleOverlayState).toHaveBeenCalled();
    expect(blockController.updateSettings).toHaveBeenCalledWith(
      expect.objectContaining({
        targetStyle: expect.objectContaining({ visible: true }),
        nativeStyle: expect.objectContaining({ visible: true }),
      }),
    );
    expect(blockController.syncHiddenState).toHaveBeenCalled();

    cleanup!();
    cleanupCalled = true;
  });

  it('onMessage SEEK_TO seeks the video with offset', async () => {
    cleanup = init(video);
    await flushPromises();

    const onRuntimeMessage = onMessageCallbacks[0];
    onRuntimeMessage(
      {
        type: MESSAGE_TYPES.SEEK_TO,
        payload: { timeMs: 12345 },
      },
      {},
      jest.fn(),
    );

    expect(seekVideo).toHaveBeenCalledWith(video, 12.345);

    cleanup!();
    cleanupCalled = true;
  });
});
