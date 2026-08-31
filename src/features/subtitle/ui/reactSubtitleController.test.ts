import { describe, expect, it, jest, beforeEach, afterEach } from '@jest/globals';
import { ReactSubtitleController } from './reactSubtitleController';
import { mountSubtitle, type MountSubtitleResult } from './mountSubtitle';
import { SubtitleCueEngine, type SubtitleCueEngineUpdate } from './subtitleCueEngine';
import { loadSettings, saveSettings } from '@/shared/lib/storage/settingsStore';
import {
  DEFAULT_SETTINGS,
  DEFAULT_OVERLAY_STYLE_TARGET,
  DEFAULT_OVERLAY_STYLE_NATIVE,
  DEFAULT_SUBTITLE_BLOCK_SETTINGS,
  DEFAULT_NAV_CLUSTER_SETTINGS,
} from '@/shared/config/config';
import type { SrtCue } from '@/entities/media';
import type { StudyMode, StudyModeAdvancedSettings } from '@/entities/studyMode';
import type { SubtitleBlockSettings, SubtitleApiKey } from '@/entities/settings';
import type { SubtitleCueEngineTokenizeOptions } from './subtitleCueEngine';
import type { TriggerMode } from '@/features/dictionaryPopup/types';
import { mergeCuesForPanel } from '@/features/subtitle/logic/subtitleMerge';

jest.mock('./mountSubtitle', () => ({ mountSubtitle: jest.fn() }));
jest.mock('./subtitleCueEngine', () => ({ SubtitleCueEngine: jest.fn() }));
jest.mock('@/shared/lib/storage/settingsStore', () => ({
  loadSettings: jest.fn(),
  saveSettings: jest.fn(),
}));

const mockMountSubtitle = jest.mocked(mountSubtitle);
const mockSubtitleCueEngine = jest.mocked(SubtitleCueEngine);
const mockLoadSettings = jest.mocked(loadSettings);
const mockSaveSettings = jest.mocked(saveSettings);

interface FakeEngine {
  onTimeUpdate: jest.Mock;
  handlePrev: jest.Mock;
  handleNext: jest.Mock;
  handleRewind: jest.Mock;
  handleForward: jest.Mock;
  handlePlayPause: jest.Mock;
  handleNoSubRepeatClick: jest.Mock;
  repeatOnce: jest.Mock;
  getTargetStyle: jest.Mock;
  getNativeStyle: jest.Mock;
  getBlockSettings: jest.Mock;
  getClusterSettings: jest.Mock;
  getTargetCues: jest.Mock;
  getNativeCues: jest.Mock;
  getCurrentTargetText: jest.Mock;
  getCurrentNativeText: jest.Mock;
  getActiveIndices: jest.Mock;
  loadCues: jest.Mock;
  loadBilingualCues: jest.Mock;
  clearCues: jest.Mock;
  updateSettings: jest.Mock;
  updateBlockSettings: jest.Mock;
  setGenerateNativeEnabled: jest.Mock;
  hasSubtitles: jest.Mock;
  enableTokenize: jest.Mock;
  disableTokenize: jest.Mock;
  isTokenizeEnabled: jest.Mock;
  enableDictionaryPopup: jest.Mock;
  disableDictionaryPopup: jest.Mock;
  setDictionaryPopupTriggerMode: jest.Mock;
  isDictionaryPopupEnabled: jest.Mock;
}

function createFakeMount(): MountSubtitleResult {
  const host = document.createElement('div');
  return {
    unmount: jest.fn(),
    host,
    setStyles: jest.fn(),
    setIsPlaying: jest.fn(),
    setRepeatActive: jest.fn(),
    setRepeatIcon: jest.fn(),
    setManager: jest.fn(),
    setOffset: jest.fn(),
    setManagerOpen: jest.fn(),
    setOffsetOpen: jest.fn(),
    setHintOpen: jest.fn(),
    setGenerateNativeEnabled: jest.fn(),
    setCollapsed: jest.fn(),
    setYOffsetPercent: jest.fn(),
    setClusterSettings: jest.fn(),
    setBlockSettings: jest.fn(),
    addToast: jest.fn(),
    clearToasts: jest.fn(),
    setCues: jest.fn(),
    setCurrentTimeMs: jest.fn(),
    setRemoveBracketed: jest.fn(),
    togglePlayerMode: jest.fn(),
    toggleSplitView: jest.fn(),
    setOcrEnabled: jest.fn(),
  };
}

function createFakeEngine(): FakeEngine {
  const targetCues: SrtCue[] = [];
  const nativeCues: SrtCue[] = [];
  let targetIndex = -1;
  let nativeIndex = -1;
  let targetStyle = { ...DEFAULT_OVERLAY_STYLE_TARGET };
  let nativeStyle = { ...DEFAULT_OVERLAY_STYLE_NATIVE };
  let blockSettings = { ...DEFAULT_SUBTITLE_BLOCK_SETTINGS };
  let clusterSettings = { ...DEFAULT_NAV_CLUSTER_SETTINGS };

  return {
    onTimeUpdate: jest.fn(),
    handlePrev: jest.fn(),
    handleNext: jest.fn(),
    handleRewind: jest.fn(),
    handleForward: jest.fn(),
    handlePlayPause: jest.fn(),
    handleNoSubRepeatClick: jest.fn(() => ({
      icon: 'repeat' as const,
      label: 'Repeat current sentence',
      active: false,
    })),
    repeatOnce: jest.fn(),
    getTargetStyle: jest.fn(() => targetStyle),
    getNativeStyle: jest.fn(() => nativeStyle),
    getBlockSettings: jest.fn(() => blockSettings),
    getClusterSettings: jest.fn(() => clusterSettings),
    getTargetCues: jest.fn(() => targetCues),
    getNativeCues: jest.fn(() => nativeCues),
    getCurrentTargetText: jest.fn(() => targetCues[targetIndex]?.text ?? ''),
    getCurrentNativeText: jest.fn(() => nativeCues[nativeIndex]?.text ?? ''),
    getActiveIndices: jest.fn(() => ({ target: targetIndex, native: nativeIndex })),
    loadCues: jest.fn((cues: SrtCue[]) => {
      targetCues.length = 0;
      targetCues.push(...cues);
      nativeCues.length = 0;
      targetIndex = -1;
      nativeIndex = -1;
    }),
    loadBilingualCues: jest.fn((target: SrtCue[], native: SrtCue[]) => {
      targetCues.length = 0;
      targetCues.push(...target);
      nativeCues.length = 0;
      nativeCues.push(...native);
      targetIndex = -1;
      nativeIndex = -1;
    }),
    clearCues: jest.fn(() => {
      targetCues.length = 0;
      nativeCues.length = 0;
      targetIndex = -1;
      nativeIndex = -1;
    }),
    updateSettings: jest.fn((update: SubtitleCueEngineUpdate) => {
      if (update.targetStyle) targetStyle = update.targetStyle;
      if (update.nativeStyle) nativeStyle = update.nativeStyle;
      if (update.blockSettings) blockSettings = { ...blockSettings, ...update.blockSettings };
      if (update.clusterSettings) clusterSettings = { ...clusterSettings, ...update.clusterSettings };
    }),
    updateBlockSettings: jest.fn((partial: Partial<SubtitleBlockSettings>) => {
      blockSettings = { ...blockSettings, ...partial };
    }),
    setGenerateNativeEnabled: jest.fn(),
    hasSubtitles: jest.fn(() => targetCues.length > 0 || nativeCues.length > 0),
    enableTokenize: jest.fn(),
    disableTokenize: jest.fn(),
    isTokenizeEnabled: jest.fn(() => false),
    enableDictionaryPopup: jest.fn(),
    disableDictionaryPopup: jest.fn(),
    setDictionaryPopupTriggerMode: jest.fn(),
    isDictionaryPopupEnabled: jest.fn(() => false),
  };
}

describe('ReactSubtitleController', () => {
  let video: HTMLVideoElement;
  let container: HTMLDivElement;
  let controller: ReactSubtitleController;
  let fakeMount: MountSubtitleResult;
  let fakeEngine: FakeEngine;
  let addEventListenerSpy: jest.SpyInstance;
  let removeEventListenerSpy: jest.SpyInstance;

  beforeEach(async () => {
    jest.clearAllMocks();
    jest.useFakeTimers();

    // jsdom only implements hash changes for window.location. Use a hash URL so
    // resolveOffsetKey still sees a valid origin (http://localhost).
    window.location.href = 'http://localhost/#https://example.com/video';

    document.body.innerHTML = '';
    video = document.createElement('video');
    container = document.createElement('div');
    document.body.appendChild(container);

    addEventListenerSpy = jest.spyOn(video, 'addEventListener');
    removeEventListenerSpy = jest.spyOn(video, 'removeEventListener');

    mockLoadSettings.mockResolvedValue(DEFAULT_SETTINGS);
    mockSaveSettings.mockResolvedValue(undefined);

    fakeMount = createFakeMount();
    fakeEngine = createFakeEngine();
    mockMountSubtitle.mockReturnValue(fakeMount);
    mockSubtitleCueEngine.mockImplementation(() => fakeEngine as unknown as SubtitleCueEngine);

    controller = new ReactSubtitleController(video, container);
    // Flush the loadSettings() microtask from loadPersistedOffset.
    await Promise.resolve();
  });

  afterEach(() => {
    controller?.destroy();
    jest.useRealTimers();
  });

  const targetCue: SrtCue = { index: 1, start: 0, end: 5000, text: 'Hello' };
  const nativeCue: SrtCue = { index: 1, start: 0, end: 5000, text: 'Xin chào' };
  const targetCues: SrtCue[] = [targetCue];
  const nativeCues: SrtCue[] = [nativeCue];

  it('constructor mounts subtitle with correct initial state', () => {
    expect(mockMountSubtitle).toHaveBeenCalledWith(
      expect.objectContaining({
        container,
        isPlaying: !video.paused,
        cues: [],
        currentTimeMs: 0,
      }),
    );

    expect(mockSubtitleCueEngine).toHaveBeenCalledWith(
      video,
      expect.objectContaining({ ...DEFAULT_SUBTITLE_BLOCK_SETTINGS }),
      expect.objectContaining({ ...DEFAULT_OVERLAY_STYLE_TARGET }),
      expect.objectContaining({ ...DEFAULT_OVERLAY_STYLE_NATIVE }),
      expect.objectContaining({ ...DEFAULT_NAV_CLUSTER_SETTINGS }),
      expect.any(Function),
      expect.any(Object),
    );

    expect(addEventListenerSpy).toHaveBeenCalledWith('play', expect.any(Function));
    expect(addEventListenerSpy).toHaveBeenCalledWith('pause', expect.any(Function));
    expect(addEventListenerSpy).toHaveBeenCalledWith('timeupdate', expect.any(Function));
  });

  it('timeupdate listener forwards to the cue engine and updates currentTimeMs', () => {
    fakeEngine.onTimeUpdate.mockClear();
    fakeMount.setCurrentTimeMs.mockClear();

    video.currentTime = 12.34;
    video.dispatchEvent(new Event('timeupdate'));

    expect(fakeEngine.onTimeUpdate).toHaveBeenCalled();
    expect(fakeMount.setCurrentTimeMs).toHaveBeenCalledWith(12.34 * 1000);
  });

  it('loadCues forwards cues to the cue engine and syncs playback state', () => {
    const cues: SrtCue[] = [{ index: 1, start: 0, end: 2000, text: 'Hi' }];
    controller.loadCues(cues);

    expect(fakeEngine.loadCues).toHaveBeenCalledWith(cues);
    expect(fakeEngine.onTimeUpdate).toHaveBeenCalled();
    expect(fakeMount.setIsPlaying).toHaveBeenCalledWith(!video.paused);
    expect(controller.getTargetCues()).toEqual(cues);

    // Characterization: loadCues does NOT update the mount cue list or current
    // time directly. Those are handled by loadBilingualCues and the video
    // timeupdate listener respectively.
    expect(fakeMount.setCues).not.toHaveBeenCalled();
    expect(fakeMount.setCurrentTimeMs).not.toHaveBeenCalled();
  });

  it('loadCues boolean overload is a no-op', () => {
    controller.loadCues(false);
    expect(fakeEngine.loadCues).not.toHaveBeenCalled();
  });

  it('setIsPlaying toggles the mount isPlaying state (does not call the engine)', () => {
    const controllerWithPrivateSetIsPlaying = controller as unknown as {
      setIsPlaying: (playing: boolean) => void;
    };

    controllerWithPrivateSetIsPlaying.setIsPlaying(true);
    expect(fakeMount.setIsPlaying).toHaveBeenCalledWith(true);

    controllerWithPrivateSetIsPlaying.setIsPlaying(false);
    expect(fakeMount.setIsPlaying).toHaveBeenLastCalledWith(false);

    // Characterization: setIsPlaying is a local/mount-only helper; the cue
    // engine is driven through the mount onPlayPause callback, not here.
    expect(fakeEngine.handlePlayPause).not.toHaveBeenCalled();
  });

  it('video play and pause events update the mount isPlaying state', () => {
    video.dispatchEvent(new Event('play'));
    expect(fakeMount.setIsPlaying).toHaveBeenCalledWith(true);

    fakeMount.setIsPlaying.mockClear();

    video.dispatchEvent(new Event('pause'));
    expect(fakeMount.setIsPlaying).toHaveBeenCalledWith(false);
  });

  it('loadBilingualCues forwards bilingual cues and round-trips through getTargetCues', () => {
    controller.loadBilingualCues(targetCues, nativeCues);

    expect(fakeEngine.loadBilingualCues).toHaveBeenCalledWith(targetCues, nativeCues);
    expect(fakeMount.setCues).toHaveBeenCalledWith(mergeCuesForPanel(targetCues, nativeCues));
    expect(controller.getTargetCues()).toEqual(targetCues);
    expect(controller.getTargetCues()).toBe(fakeEngine.getTargetCues());
  });

  it('setOffsetMs updates mount offset and engine, then persists after debounce', async () => {
    controller.setOffsetMs(1234);

    expect(fakeMount.setOffset).toHaveBeenCalledWith(
      expect.objectContaining({
        targetMs: 1234,
        nativeMs: 1234,
        onTargetChange: expect.any(Function),
        onNativeChange: expect.any(Function),
      }),
    );
    expect(fakeEngine.onTimeUpdate).toHaveBeenCalled();
    expect(fakeMount.setManager).toHaveBeenCalled();

    jest.advanceTimersByTime(400);
    await Promise.resolve(); // flush loadSettings().then microtask in persistOffset

    expect(mockLoadSettings).toHaveBeenCalledTimes(2); // constructor + persistOffset read-modify-write
    expect(mockSaveSettings).toHaveBeenCalledWith(
      expect.objectContaining({
        subtitleOffset: expect.objectContaining({ 'http://localhost': 1234 }),
      }),
    );
  });

  it('applyStudyMode wires the study mode state machine and updates the mount', () => {
    controller.loadCues([targetCue]);
    fakeEngine.getActiveIndices.mockReturnValue({ target: 0, native: -1 });

    const studyMode: StudyMode = {
      id: 'test',
      type: 'custom',
      icon: 'bookOpen',
      title: 'Test',
      description: '',
      steps: [{ subtitle: 'target', pause: 'none', repeat: 1, speed: 1.5, after: 'continue' }],
    };
    const advanced: StudyModeAdvancedSettings = { skipNoDialogue: 'OFF', removeBracketed: true };

    controller.applyStudyMode(studyMode, advanced);

    expect(fakeMount.setRemoveBracketed).toHaveBeenCalledWith(true);
    expect(fakeEngine.getTargetCues).toHaveBeenCalled();
    expect(fakeEngine.getActiveIndices).toHaveBeenCalled();
    expect(fakeEngine.updateSettings).toHaveBeenCalled();
    expect(fakeMount.setStyles).toHaveBeenCalledWith(
      expect.objectContaining({ visible: true }),
      expect.objectContaining({ visible: false }),
    );
    expect(fakeMount.setManager).toHaveBeenCalled();
    expect(video.playbackRate).toBe(1.5);
  });

  it('destroy removes play/pause/timeupdate listeners and unmounts', () => {
    controller.destroy();

    expect(removeEventListenerSpy).toHaveBeenCalledWith('play', expect.any(Function));
    expect(removeEventListenerSpy).toHaveBeenCalledWith('pause', expect.any(Function));
    expect(removeEventListenerSpy).toHaveBeenCalledWith('timeupdate', expect.any(Function));
    expect(fakeMount.unmount).toHaveBeenCalled();
  });

  it('clearCues clears engine cues and resets the mount cue list', () => {
    controller.loadCues([targetCue]);
    fakeMount.setCues.mockClear();
    fakeEngine.clearCues.mockClear();

    controller.clearCues();

    expect(fakeEngine.clearCues).toHaveBeenCalled();
    expect(fakeMount.setCues).toHaveBeenCalledWith([]);
  });

  it('reset and stepBy adjust offset through setOffsetMs', () => {
    controller.setOffsetMs(100);
    fakeMount.setOffset.mockClear();

    controller.stepBy(50);
    expect(fakeMount.setOffset).toHaveBeenLastCalledWith(
      expect.objectContaining({ targetMs: 150, nativeMs: 150 }),
    );

    controller.reset();
    expect(fakeMount.setOffset).toHaveBeenLastCalledWith(
      expect.objectContaining({ targetMs: 0, nativeMs: 0 }),
    );
  });

  it('exposes engine cue and offset state', () => {
    controller.loadBilingualCues(targetCues, nativeCues);
    fakeEngine.getCurrentTargetText.mockReturnValue('Hello');
    fakeEngine.getCurrentNativeText.mockReturnValue('Xin chào');
    fakeEngine.getActiveIndices.mockReturnValue({ target: 0, native: 0 });

    expect(controller.getNativeCues()).toEqual(nativeCues);
    expect(controller.getCurrentTargetText()).toBe('Hello');
    expect(controller.getCurrentNativeText()).toBe('Xin chào');
    expect(controller.getActiveIndices()).toEqual({ target: 0, native: 0 });
    expect(controller.getOffsetMs()).toBe(0);
  });

  it('getHost and getLineElements expose the mount host and query shadow root', () => {
    expect(controller.getHost()).toBe(fakeMount.host);
    // Characterization: with no shadow root, line element queries return null.
    expect(controller.getLineElements()).toEqual({ target: null, native: null });
  });

  it('updateSettings forwards to the cue engine and refreshes styles', () => {
    const update: SubtitleCueEngineUpdate = { blockSettings: { yOffsetPercent: 80 } };
    controller.updateSettings(update);

    expect(fakeEngine.updateSettings).toHaveBeenCalledWith(update);
    expect(fakeMount.setStyles).toHaveBeenCalled();
    expect(fakeMount.setClusterSettings).toHaveBeenCalled();
    expect(fakeMount.setBlockSettings).toHaveBeenCalled();
  });

  it('refreshManagerState and syncHiddenState update the manager panel', () => {
    controller.refreshManagerState();
    expect(fakeMount.setManager).toHaveBeenCalled();

    fakeMount.setManager.mockClear();
    controller.syncHiddenState();
    expect(fakeMount.setManager).toHaveBeenCalled();
  });

  it('manager panel methods delegate to the mount', () => {
    const apiKey: SubtitleApiKey = {
      id: 'test',
      provider: 'subdl',
      key: 'secret',
      status: 'unverified',
      addedAt: 0,
    };

    controller.updateManagerItems('target', [], 0);
    controller.openManager();
    controller.closeManager();
    controller.setHasSearchKeys(true);
    controller.setSearchApiKeys([apiKey]);
    controller.onApiKeysChange([apiKey]);

    expect(fakeMount.setManager).toHaveBeenCalled();
    expect(fakeMount.setManagerOpen).toHaveBeenCalledWith(true);
    expect(fakeMount.setManagerOpen).toHaveBeenCalledWith(false);
  });

  it('setOcrEnabled, togglePlayerMode and toggleSplitView delegate to the mount', () => {
    controller.setOcrEnabled(true);
    expect(fakeMount.setOcrEnabled).toHaveBeenCalledWith(true);

    controller.togglePlayerMode();
    expect(fakeMount.togglePlayerMode).toHaveBeenCalled();

    controller.toggleSplitView();
    expect(fakeMount.toggleSplitView).toHaveBeenCalled();
  });

  it('tokenize and dictionary popup methods delegate to the cue engine', () => {
    const tokenizeOptions: SubtitleCueEngineTokenizeOptions = {
      langCode: 'en',
      onOpenDictionary: jest.fn(),
    };

    controller.enableTokenize(tokenizeOptions);
    expect(fakeEngine.enableTokenize).toHaveBeenCalledWith(tokenizeOptions);

    controller.disableTokenize();
    expect(fakeEngine.disableTokenize).toHaveBeenCalled();
    expect(controller.isTokenizeEnabled()).toBe(false);

    const onLookup = jest.fn();
    const onCancel = jest.fn();
    const onClear = jest.fn();
    controller.enableDictionaryPopup('click' as TriggerMode, onLookup, onCancel, onClear);
    expect(fakeEngine.enableDictionaryPopup).toHaveBeenCalledWith(
      expect.objectContaining({ triggerMode: 'click', onLookup, onCancel, onClear }),
    );

    controller.setDictionaryPopupTriggerMode('hover' as TriggerMode);
    expect(fakeEngine.setDictionaryPopupTriggerMode).toHaveBeenCalledWith('hover');

    expect(controller.isDictionaryPopupEnabled()).toBe(false);

    controller.disableDictionaryPopup();
    expect(fakeEngine.disableDictionaryPopup).toHaveBeenCalled();
  });

  it('setGenerateNativeEnabled delegates to the cue engine', () => {
    controller.setGenerateNativeEnabled(false);
    expect(fakeEngine.setGenerateNativeEnabled).toHaveBeenCalledWith(false);
  });

  it('init, setOffsetProvider and attachOverflowButtons are no-ops', () => {
    // Characterization: these public methods exist for API compatibility.
    expect(() => {
      controller.init();
      controller.setOffsetProvider(() => 42);
      controller.attachOverflowButtons({ panelToggle: document.createElement('button') });
    }).not.toThrow();
  });
});
