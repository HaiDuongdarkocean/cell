import { describe, expect, it, beforeEach, afterEach } from '@jest/globals';
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
import type { TriggerMode } from '@/entities/dictionary';
import { mergeCuesForPanel } from '@/features/subtitle/logic/subtitleMerge';

jest.mock('./mountSubtitle', () => ({ mountSubtitle: jest.fn() }));
jest.mock('./subtitleCueEngine', () => ({ SubtitleCueEngine: jest.fn() }));
jest.mock('@/shared/lib/storage/settingsStore', () => ({
  loadSettings: jest.fn(),
  saveSettings: jest.fn(),
}));

const mockMountSubtitle = jest.mocked(mountSubtitle);
const mockSubtitleCueEngine = jest.mocked(SubtitleCueEngine) as unknown as jest.Mock;
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
  setHeldCue: jest.Mock;
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
    setVideoAspectRatio: jest.fn(),
    setCollapsed: jest.fn(),
    setYOffsetPercent: jest.fn(),
    setClusterSettings: jest.fn(),
    setBlockSettings: jest.fn(),
    addToast: jest.fn(),
    clearToasts: jest.fn(),
    setCues: jest.fn(),
    setTokenize: jest.fn(),
    setCurrentTimeMs: jest.fn(),
    setPanelBlurred: jest.fn(),
    setRemoveBracketed: jest.fn(),
    togglePlayerMode: jest.fn(),
    toggleSplitView: jest.fn(),
    setOcrEnabled: jest.fn(),
    setPracticeMode: jest.fn(),
    setPlaybackSpeed: jest.fn(),
  };
}

function createFakeEngine(): FakeEngine {
  let targetCues: SrtCue[] = [];
  let nativeCues: SrtCue[] = [];
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
      targetCues = [...cues];
      nativeCues = [];
      targetIndex = -1;
      nativeIndex = -1;
    }),
    loadBilingualCues: jest.fn((target: SrtCue[], native: SrtCue[]) => {
      if (target.length > 0) targetCues = [...target];
      if (native.length > 0) nativeCues = [...native];
      if (target.length === 0 && native.length === 0) {
        targetCues = [];
        nativeCues = [];
      }
      targetIndex = -1;
      nativeIndex = -1;
    }),
    clearCues: jest.fn(() => {
      targetCues = [];
      nativeCues = [];
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
    setHeldCue: jest.fn(),
  };
}

describe('ReactSubtitleController', () => {
  let video: HTMLVideoElement;
  let container: HTMLDivElement;
  let controller: ReactSubtitleController;
  let fakeMount: jest.Mocked<MountSubtitleResult>;
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

    fakeMount = createFakeMount() as unknown as jest.Mocked<MountSubtitleResult>;
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

  it('falls back to 16:9 before metadata — never the host-stretched rendered box', () => {
    controller.destroy();
    jest
      .spyOn(video, 'getBoundingClientRect')
      .mockReturnValue({ width: 722, height: 761 } as DOMRect);

    new ReactSubtitleController(video, container);

    const options = mockMountSubtitle.mock.calls.at(-1)![0];
    expect(options.videoAspectRatio).toBeCloseTo(16 / 9);
  });

  it('updates the mount aspect ratio when video metadata loads late', () => {
    Object.defineProperty(video, 'videoWidth', { value: 720, configurable: true });
    Object.defineProperty(video, 'videoHeight', { value: 480, configurable: true });

    video.dispatchEvent(new Event('loadedmetadata'));

    expect(fakeMount.setVideoAspectRatio).toHaveBeenCalledWith(1.5);
  });

  it('re-reads aspect ratio when player mode turns on', () => {
    Object.defineProperty(video, 'videoWidth', { value: 720, configurable: true });
    Object.defineProperty(video, 'videoHeight', { value: 480, configurable: true });

    const options = mockMountSubtitle.mock.calls[0][0];
    options.onTogglePlayerMode?.(true);

    expect(fakeMount.setVideoAspectRatio).toHaveBeenCalledWith(1.5);
  });

  it('re-renders cue tokens after player mode remounts the subtitle block', () => {
    const onCuesUpdated = jest.fn();
    controller.onCuesUpdated = onCuesUpdated;
    const mountOptions = mockMountSubtitle.mock.calls[0][0];

    mountOptions.onTogglePlayerMode?.(true);
    mountOptions.onTogglePlayerMode?.(false);

    expect(onCuesUpdated).toHaveBeenCalledTimes(2);
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

    // The mount cue list is kept in sync via the panel merge (engine cue-set
    // changes always rebuild panelCues so late-arriving native tracks land in
    // the list too). Current time is handled by the video timeupdate listener.
    expect(fakeMount.setCues).toHaveBeenCalledWith(mergeCuesForPanel(cues, []));
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
    Object.defineProperty(video, 'paused', { value: false, configurable: true, writable: true });
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
    const advanced: StudyModeAdvancedSettings = { skipNoDialogue: 'OFF', removeBracketed: true, pauseOnUnknown: 'OFF', unknownLevel: 'advanced', popupOnAutoPause: false, popupCloseOnResume: true };

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

  it('applyStudyMode with normal mode is pass-through — no visibility or speed overrides on cue transitions', () => {
    const twoCues: SrtCue[] = [
      { index: 1, start: 0, end: 5000, text: 'One' },
      { index: 2, start: 5000, end: 10000, text: 'Two' },
    ];
    controller.loadCues(twoCues);
    fakeEngine.getActiveIndices.mockReturnValue({ target: -1, native: -1 });

    const normalMode: StudyMode = {
      id: 'normal',
      type: 'preset',
      icon: 'play',
      title: 'Normal',
      description: '',
      steps: [{ subtitle: 'both', pause: 'none', repeat: 1, speed: 1, after: 'continue' }],
    };
    const advanced: StudyModeAdvancedSettings = { skipNoDialogue: 'OFF', removeBracketed: true, pauseOnUnknown: 'OFF', unknownLevel: 'advanced', popupOnAutoPause: false, popupCloseOnResume: true };

    fakeMount.setStyles.mockClear();
    fakeEngine.updateSettings.mockClear();
    video.playbackRate = 1.25;

    controller.applyStudyMode(normalMode, advanced);

    // Cross a cue boundary — normal mode must not re-enter a step, so no
    // setSubtitle/setSpeed actions reach the mount, engine, or video element.
    fakeEngine.getActiveIndices.mockReturnValue({ target: 0, native: -1 });
    video.currentTime = 0.5;
    video.dispatchEvent(new Event('timeupdate'));
    fakeEngine.getActiveIndices.mockReturnValue({ target: 1, native: -1 });
    video.currentTime = 6;
    video.dispatchEvent(new Event('timeupdate'));

    expect(fakeMount.setStyles).not.toHaveBeenCalled();
    expect(fakeEngine.updateSettings).not.toHaveBeenCalled();
    expect(video.playbackRate).toBe(1.25);
    expect(video.paused).toBe(true);
  });

  it('applyStudyMode syncs the panel practice mode from the preset id', () => {
    const dictationMode: StudyMode = {
      id: 'dictation',
      type: 'preset',
      icon: 'pencil',
      title: 'Dictation',
      description: '',
      steps: [{ subtitle: 'none', pause: 'end', repeat: 2, speed: 0.75, after: 'wait' }],
    };
    const advanced: StudyModeAdvancedSettings = { skipNoDialogue: 'OFF', removeBracketed: false, pauseOnUnknown: 'OFF', unknownLevel: 'advanced', popupOnAutoPause: false, popupCloseOnResume: true };

    controller.applyStudyMode(dictationMode, advanced);
    expect(fakeMount.setPracticeMode).toHaveBeenCalledWith('dictation');

    const normalMode: StudyMode = {
      id: 'normal',
      type: 'preset',
      icon: 'play',
      title: 'Normal',
      description: '',
      steps: [{ subtitle: 'both', pause: 'none', repeat: 1, speed: 1, after: 'continue' }],
    };
    controller.applyStudyMode(normalMode, advanced);
    expect(fakeMount.setPracticeMode).toHaveBeenCalledWith('off');
  });

  it('replay and continue operate on explicit cue identity', () => {
    const twoTargets: SrtCue[] = [
      { index: 1, start: 1000, end: 3000, text: 'One' },
      { index: 2, start: 4000, end: 6000, text: 'Two' },
    ];
    controller.loadBilingualCues(twoTargets, []);
    const playSpy = jest.spyOn(video, 'play').mockImplementation(() => Promise.resolve());

    const options = mockMountSubtitle.mock.calls[0][0] as {
      onReplayCue?: (cue: { index: number; start: number }) => void;
      onContinueCue?: (cue: { index: number; start: number }) => void;
    };

    options.onReplayCue?.({ index: 1, start: 1000 } as never);
    expect(video.currentTime).toBe(1);
    expect(playSpy).toHaveBeenCalled();

    video.currentTime = 0;
    options.onContinueCue?.({ index: 1, start: 1000 } as never);
    expect(video.currentTime).toBe(4);

    video.currentTime = 0;
    playSpy.mockClear();
    options.onContinueCue?.({ index: 2, start: 4000 } as never);
    expect(video.currentTime).toBe(0);
    expect(playSpy).toHaveBeenCalled();
    playSpy.mockRestore();
  });

  it('destroy removes play/pause/timeupdate listeners and unmounts', () => {
    controller.destroy();

    expect(removeEventListenerSpy).toHaveBeenCalledWith('play', expect.any(Function));
    expect(removeEventListenerSpy).toHaveBeenCalledWith('pause', expect.any(Function));
    expect(removeEventListenerSpy).toHaveBeenCalledWith('timeupdate', expect.any(Function));
    expect(removeEventListenerSpy).toHaveBeenCalledWith('loadedmetadata', expect.any(Function));
    expect(removeEventListenerSpy).toHaveBeenCalledWith('resize', expect.any(Function));
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
    controller.onApiKeysChange(jest.fn());

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
      onTokenHover: jest.fn(),
    };

    controller.enableTokenize(tokenizeOptions);
    expect(fakeEngine.enableTokenize).toHaveBeenCalledWith(tokenizeOptions);
    expect(fakeMount.setTokenize).toHaveBeenCalledWith({
      langCode: 'en',
      onTokenClick: tokenizeOptions.onOpenDictionary,
      onTokenHover: tokenizeOptions.onTokenHover,
      onTokenCtrlClick: undefined,
      selection: undefined,
    });

    controller.disableTokenize();
    expect(fakeEngine.disableTokenize).toHaveBeenCalled();
    expect(fakeMount.setTokenize).toHaveBeenLastCalledWith(null);
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

  it('restores playback rate and subtitle visibility when the study mode deactivates', () => {
    controller.loadCues([targetCue]);
    fakeEngine.getActiveIndices.mockReturnValue({ target: 0, native: -1 });
    video.playbackRate = 1.25;

    const studyMode: StudyMode = {
      id: 'shadowing',
      type: 'custom',
      icon: 'bookOpen',
      title: 'Shadowing',
      description: '',
      steps: [{ subtitle: 'none', pause: 'none', repeat: 1, speed: 0.5, after: 'continue' }],
    };
    const normalMode: StudyMode = {
      id: 'normal',
      type: 'preset',
      icon: 'play',
      title: 'Normal',
      description: '',
      steps: [{ subtitle: 'both', pause: 'none', repeat: 1, speed: 1, after: 'continue' }],
    };
    const advanced: StudyModeAdvancedSettings = { skipNoDialogue: 'OFF', removeBracketed: false, pauseOnUnknown: 'OFF', unknownLevel: 'advanced', popupOnAutoPause: false, popupCloseOnResume: true };

    controller.applyStudyMode(studyMode, advanced);
    expect(video.playbackRate).toBe(0.5);
    expect(fakeEngine.getTargetStyle().visible).toBe(false);
    expect(fakeEngine.getNativeStyle().visible).toBe(false);

    controller.applyStudyMode(normalMode, advanced);
    expect(video.playbackRate).toBe(1.25);
    expect(fakeEngine.getTargetStyle().visible).toBe(true);
    expect(fakeEngine.getNativeStyle().visible).toBe(true);
    expect(fakeMount.setPlaybackSpeed).toHaveBeenLastCalledWith(1.25);
  });

  it('manual playback speed survives cue transitions while a study mode is active', () => {
    const cues: SrtCue[] = [
      { index: 1, start: 0, end: 5000, text: 'One' },
      { index: 2, start: 5000, end: 10000, text: 'Two' },
    ];
    controller.loadCues(cues);
    fakeEngine.getActiveIndices.mockReturnValue({ target: 0, native: -1 });
    Object.defineProperty(video, 'paused', { value: false, configurable: true, writable: true });

    const studyMode: StudyMode = {
      id: 'listen',
      type: 'preset',
      icon: 'volumeHigh',
      title: 'Listen',
      description: '',
      steps: [{ subtitle: 'both', pause: 'none', repeat: 1, speed: 1, after: 'continue' }],
    };
    const advanced: StudyModeAdvancedSettings = { skipNoDialogue: 'OFF', removeBracketed: false, pauseOnUnknown: 'OFF', unknownLevel: 'advanced', popupOnAutoPause: false, popupCloseOnResume: true };
    controller.applyStudyMode(studyMode, advanced);
    expect(video.playbackRate).toBe(1);

    const mountOptions = mockMountSubtitle.mock.calls[0][0];
    mountOptions.onPlaybackSpeedChange?.(10);
    expect(video.playbackRate).toBe(10);

    // Finish cue 1's step chain, then cross into cue 2 — the mode re-emits
    // setSpeed(step.speed) on entry but the user's manual speed must win.
    video.currentTime = 5.5;
    video.dispatchEvent(new Event('timeupdate'));
    fakeEngine.getActiveIndices.mockReturnValue({ target: 1, native: -1 });
    video.currentTime = 6;
    video.dispatchEvent(new Event('timeupdate'));

    expect(video.playbackRate).toBe(10);
    expect(fakeMount.setPlaybackSpeed).toHaveBeenLastCalledWith(10);
  });

  it('restores the manual speed instead of the pre-mode baseline when the study mode deactivates', () => {
    controller.loadCues([targetCue]);
    fakeEngine.getActiveIndices.mockReturnValue({ target: 0, native: -1 });
    video.playbackRate = 1.25;

    const studyMode: StudyMode = {
      id: 'shadowing',
      type: 'custom',
      icon: 'bookOpen',
      title: 'Shadowing',
      description: '',
      steps: [{ subtitle: 'none', pause: 'none', repeat: 1, speed: 0.5, after: 'continue' }],
    };
    const normalMode: StudyMode = {
      id: 'normal',
      type: 'preset',
      icon: 'play',
      title: 'Normal',
      description: '',
      steps: [{ subtitle: 'both', pause: 'none', repeat: 1, speed: 1, after: 'continue' }],
    };
    const advanced: StudyModeAdvancedSettings = { skipNoDialogue: 'OFF', removeBracketed: false, pauseOnUnknown: 'OFF', unknownLevel: 'advanced', popupOnAutoPause: false, popupCloseOnResume: true };

    controller.applyStudyMode(studyMode, advanced);
    expect(video.playbackRate).toBe(0.5);

    const mountOptions = mockMountSubtitle.mock.calls[0][0];
    mountOptions.onPlaybackSpeedChange?.(2);

    controller.applyStudyMode(normalMode, advanced);
    expect(video.playbackRate).toBe(2);
    expect(fakeMount.setPlaybackSpeed).toHaveBeenLastCalledWith(2);
  });

  it('silence-skip fast-forward still applies when it exceeds the manual speed', () => {
    const cues: SrtCue[] = [
      { index: 1, start: 0, end: 5000, text: 'One' },
      { index: 2, start: 8000, end: 12000, text: 'Two' },
    ];
    controller.loadCues(cues);
    fakeEngine.getActiveIndices.mockReturnValue({ target: 0, native: -1 });
    Object.defineProperty(video, 'paused', { value: false, configurable: true, writable: true });

    const studyMode: StudyMode = {
      id: 'listen',
      type: 'preset',
      icon: 'volumeHigh',
      title: 'Listen',
      description: '',
      steps: [{ subtitle: 'both', pause: 'none', repeat: 1, speed: 1, after: 'continue' }],
    };
    const advanced: StudyModeAdvancedSettings = { skipNoDialogue: '4X', removeBracketed: false, pauseOnUnknown: 'OFF', unknownLevel: 'advanced', popupOnAutoPause: false, popupCloseOnResume: true };
    controller.applyStudyMode(studyMode, advanced);

    const mountOptions = mockMountSubtitle.mock.calls[0][0];
    mountOptions.onPlaybackSpeedChange?.(2);
    expect(video.playbackRate).toBe(2);

    // Finish cue 1's step chain, then play into the silence gap — the
    // transient skip speed (4x) exceeds the manual speed so it applies.
    video.currentTime = 5.5;
    video.dispatchEvent(new Event('timeupdate'));
    fakeEngine.getActiveIndices.mockReturnValue({ target: -1, native: -1 });
    video.currentTime = 6;
    video.dispatchEvent(new Event('timeupdate'));

    expect(video.playbackRate).toBe(4);
    expect(fakeMount.setPlaybackSpeed).toHaveBeenLastCalledWith(4);
  });

  it('keeps engine visibility when a settings update lands while study mode is active', () => {
    controller.loadCues([targetCue]);
    fakeEngine.getActiveIndices.mockReturnValue({ target: 0, native: -1 });

    const listenMode: StudyMode = {
      id: 'listen',
      type: 'preset',
      icon: 'volumeHigh',
      title: 'Listen',
      description: '',
      steps: [{ subtitle: 'none', pause: 'none', repeat: 1, speed: 1, after: 'continue' }],
    };
    const advanced: StudyModeAdvancedSettings = { skipNoDialogue: 'OFF', removeBracketed: false, pauseOnUnknown: 'OFF', unknownLevel: 'advanced', popupOnAutoPause: false, popupCloseOnResume: true };
    controller.applyStudyMode(listenMode, advanced);
    expect(fakeEngine.getTargetStyle().visible).toBe(false);
    expect(fakeEngine.getNativeStyle().visible).toBe(false);

    // A delayed settings write (persistFieldMapping, panel tab change, etc.)
    // carries visible:true — it must not override the active mode's hidden state.
    controller.updateSettings({
      targetStyle: { ...DEFAULT_OVERLAY_STYLE_TARGET, visible: true },
      nativeStyle: { ...DEFAULT_OVERLAY_STYLE_NATIVE, visible: true },
    });
    expect(fakeEngine.getTargetStyle().visible).toBe(false);
    expect(fakeEngine.getNativeStyle().visible).toBe(false);
  });

  it('does not consume a repeat when a mode is applied while paused at cue end', () => {
    controller.loadCues([targetCue]);
    fakeEngine.getActiveIndices.mockReturnValue({ target: 0, native: -1 });

    const repeatMode: StudyMode = {
      id: 'dictation',
      type: 'preset',
      icon: 'pencil',
      title: 'Dictation',
      description: '',
      steps: [{ subtitle: 'target', pause: 'none', repeat: 2, speed: 1, after: 'continue' }],
    };
    const advanced: StudyModeAdvancedSettings = { skipNoDialogue: 'OFF', removeBracketed: false, pauseOnUnknown: 'OFF', unknownLevel: 'advanced', popupOnAutoPause: false, popupCloseOnResume: true };

    // Video paused at cue end (e.g. user parked it there before switching mode).
    // applyStudyMode syncs while paused — the step-end must not fire, so the
    // first repeat seek is NOT consumed.
    video.currentTime = 5.2;
    controller.applyStudyMode(repeatMode, advanced);
    expect(video.currentTime).toBe(5.2);

    // Resume playing past the end — now the repeat fires exactly once.
    Object.defineProperty(video, 'paused', { value: false, configurable: true, writable: true });
    video.dispatchEvent(new Event('timeupdate'));
    expect(video.currentTime).toBeCloseTo(0.08);
  });

  it('re-bases the study-mode chain on offset change so internal seeks stay internal', () => {
    const cues: SrtCue[] = [
      { index: 1, start: 2000, end: 6000, text: 'One' },
      { index: 2, start: 7000, end: 11000, text: 'Two' },
    ];
    controller.loadCues(cues);
    fakeEngine.getActiveIndices.mockReturnValue({ target: 0, native: -1 });

    const twoStep: StudyMode = {
      id: 'two-step',
      type: 'custom',
      icon: 'layers',
      title: 'TwoStep',
      description: '',
      steps: [
        { subtitle: 'native', pause: 'none', repeat: 1, speed: 1, after: 'continue' },
        { subtitle: 'target', pause: 'none', repeat: 1, speed: 1, after: 'continue' },
      ],
    };
    const advanced: StudyModeAdvancedSettings = { skipNoDialogue: 'OFF', removeBracketed: false, pauseOnUnknown: 'OFF', unknownLevel: 'advanced', popupOnAutoPause: false, popupCloseOnResume: true };
    controller.applyStudyMode(twoStep, advanced);

    controller.setOffsetMs(500);
    fakeEngine.updateSettings.mockClear();

    Object.defineProperty(video, 'paused', { value: false, configurable: true, writable: true });
    video.currentTime = 5.6;
    video.dispatchEvent(new Event('timeupdate'));
    video.dispatchEvent(new Event('seeking'));
    video.dispatchEvent(new Event('timeupdate'));

    const calls = fakeEngine.updateSettings.mock.calls as { targetStyle?: { visible?: boolean }; nativeStyle?: { visible?: boolean } }[][];
    const last = calls[calls.length - 1]?.[0];
    expect(last?.targetStyle?.visible).toBe(true);
    expect(last?.nativeStyle?.visible).toBe(false);
  });

  it('pins the finished cue while an end-pause is active in listen-check', () => {
    controller.loadCues([targetCue]);
    fakeEngine.getActiveIndices.mockReturnValue({ target: 0, native: -1 });

    const listenCheck: StudyMode = {
      id: 'listen-check',
      type: 'preset',
      icon: 'eyeOff',
      title: 'Listen-Check',
      description: '',
      steps: [
        { subtitle: 'none', pause: 'none', repeat: 1, speed: 1, after: 'continue' },
        { subtitle: 'both', pause: 'end', repeat: 1, speed: 1, after: 'wait', seek: false },
      ],
    };
    const advanced: StudyModeAdvancedSettings = { skipNoDialogue: 'OFF', removeBracketed: false, pauseOnUnknown: 'OFF', unknownLevel: 'advanced', popupOnAutoPause: false, popupCloseOnResume: true };
    controller.applyStudyMode(listenCheck, advanced);
    fakeEngine.setHeldCue.mockClear();

    Object.defineProperty(video, 'paused', { value: false, configurable: true, writable: true });
    video.currentTime = 5.2;
    video.dispatchEvent(new Event('timeupdate'));
    expect(fakeEngine.setHeldCue).toHaveBeenCalledWith(0);

    video.dispatchEvent(new Event('play'));
    expect(fakeEngine.setHeldCue).toHaveBeenLastCalledWith(-1);
  });

  it('feeds the held cue start as panel time while paused at its end, raw time otherwise', () => {
    const cues: SrtCue[] = [
      { index: 1, start: 0, end: 5000, text: 'One' },
      { index: 2, start: 5000, end: 10000, text: 'Two' },
    ];
    controller.loadCues(cues);
    fakeEngine.getActiveIndices.mockReturnValue({ target: 0, native: -1 });

    const dictationMode: StudyMode = {
      id: 'dictation',
      type: 'preset',
      icon: 'pencil',
      title: 'Dictation',
      description: '',
      steps: [{ subtitle: 'none', pause: 'end', repeat: 1, speed: 1, after: 'wait' }],
    };
    const advanced: StudyModeAdvancedSettings = { skipNoDialogue: 'OFF', removeBracketed: false, pauseOnUnknown: 'OFF', unknownLevel: 'advanced', popupOnAutoPause: false, popupCloseOnResume: true };
    controller.applyStudyMode(dictationMode, advanced);

    // Cue 0 ends at 5.0; the pausing timeupdate lands inside cue 1's interval.
    // The panel must keep showing cue 0 (the cue under review), not cue 1.
    Object.defineProperty(video, 'paused', { value: false, configurable: true, writable: true });
    video.currentTime = 5.2;
    video.dispatchEvent(new Event('timeupdate'));
    expect(fakeMount.setCurrentTimeMs).toHaveBeenLastCalledWith(0);

    video.dispatchEvent(new Event('play'));
    expect(fakeMount.setCurrentTimeMs).toHaveBeenLastCalledWith(5200);
  });

  it('seek actions convert raw cue time through offset and landing epsilon', () => {
    controller.setOffsetMs(500);
    const cue: SrtCue = { index: 1, start: 2000, end: 5000, text: 'Hello' };
    controller.loadCues([cue]);
    fakeEngine.getActiveIndices.mockReturnValue({ target: 0, native: -1 });

    const repeatMode: StudyMode = {
      id: 'repeat',
      type: 'custom',
      icon: 'slidersHorizontal',
      title: 'Repeat',
      description: '',
      steps: [{ subtitle: 'target', pause: 'none', repeat: 2, speed: 1, after: 'continue' }],
    };
    const advanced: StudyModeAdvancedSettings = { skipNoDialogue: 'OFF', removeBracketed: false, pauseOnUnknown: 'OFF', unknownLevel: 'advanced', popupOnAutoPause: false, popupCloseOnResume: true };
    controller.applyStudyMode(repeatMode, advanced);

    Object.defineProperty(video, 'paused', { value: false, configurable: true, writable: true });
    video.currentTime = 4.6;
    video.dispatchEvent(new Event('timeupdate'));

    expect(video.currentTime).toBeCloseTo((2000 - 500 + 80) / 1000);
  });

  it('blurs the subtitle panel when a non-practice study mode hides subtitles', () => {
    controller.loadCues([targetCue]);
    fakeEngine.getActiveIndices.mockReturnValue({ target: 0, native: -1 });

    const listenMode: StudyMode = {
      id: 'listen',
      type: 'preset',
      icon: 'volumeHigh',
      title: 'Listen',
      description: '',
      steps: [{ subtitle: 'none', pause: 'none', repeat: 1, speed: 1, after: 'continue' }],
    };
    const advanced: StudyModeAdvancedSettings = { skipNoDialogue: 'OFF', removeBracketed: false, pauseOnUnknown: 'OFF', unknownLevel: 'advanced', popupOnAutoPause: false, popupCloseOnResume: true };

    controller.applyStudyMode(listenMode, advanced);

    expect(fakeMount.setPanelBlurred).toHaveBeenLastCalledWith(true);
  });

  it('does not blur the subtitle panel in dictation even when subtitles are hidden', () => {
    controller.loadCues([targetCue]);
    fakeEngine.getActiveIndices.mockReturnValue({ target: 0, native: -1 });

    const dictationMode: StudyMode = {
      id: 'dictation',
      type: 'preset',
      icon: 'pencil',
      title: 'Dictation',
      description: '',
      steps: [{ subtitle: 'none', pause: 'end', repeat: 1, speed: 1, after: 'wait' }],
    };
    const advanced: StudyModeAdvancedSettings = { skipNoDialogue: 'OFF', removeBracketed: false, pauseOnUnknown: 'OFF', unknownLevel: 'advanced', popupOnAutoPause: false, popupCloseOnResume: true };

    controller.applyStudyMode(dictationMode, advanced);

    expect(fakeMount.setPanelBlurred).not.toHaveBeenLastCalledWith(true);
    expect(fakeMount.setPanelBlurred).toHaveBeenLastCalledWith(false);
  });

  it('clears panel blur when switching back to normal mode', () => {
    controller.loadCues([targetCue]);
    fakeEngine.getActiveIndices.mockReturnValue({ target: 0, native: -1 });

    const listenMode: StudyMode = {
      id: 'listen',
      type: 'preset',
      icon: 'volumeHigh',
      title: 'Listen',
      description: '',
      steps: [{ subtitle: 'none', pause: 'none', repeat: 1, speed: 1, after: 'continue' }],
    };
    const normalMode: StudyMode = {
      id: 'normal',
      type: 'preset',
      icon: 'play',
      title: 'Normal',
      description: '',
      steps: [{ subtitle: 'both', pause: 'none', repeat: 1, speed: 1, after: 'continue' }],
    };
    const advanced: StudyModeAdvancedSettings = { skipNoDialogue: 'OFF', removeBracketed: false, pauseOnUnknown: 'OFF', unknownLevel: 'advanced', popupOnAutoPause: false, popupCloseOnResume: true };

    controller.applyStudyMode(listenMode, advanced);
    expect(fakeMount.setPanelBlurred).toHaveBeenLastCalledWith(true);

    controller.applyStudyMode(normalMode, advanced);
    expect(fakeMount.setPanelBlurred).toHaveBeenLastCalledWith(false);
  });

  it('unblurs the panel when a multi-step mode reveals subtitles at the cue end', () => {
    controller.loadCues([targetCue]);
    fakeEngine.getActiveIndices.mockReturnValue({ target: 0, native: -1 });

    const listenCheckMode: StudyMode = {
      id: 'listen-check',
      type: 'preset',
      icon: 'eyeOff',
      title: 'Listen-Check',
      description: '',
      steps: [
        { subtitle: 'none', pause: 'none', repeat: 1, speed: 1, after: 'continue' },
        { subtitle: 'both', pause: 'end', repeat: 1, speed: 1, after: 'wait', seek: false },
      ],
    };
    const advanced: StudyModeAdvancedSettings = { skipNoDialogue: 'OFF', removeBracketed: false, pauseOnUnknown: 'OFF', unknownLevel: 'advanced', popupOnAutoPause: false, popupCloseOnResume: true };

    controller.applyStudyMode(listenCheckMode, advanced);
    expect(fakeMount.setPanelBlurred).toHaveBeenLastCalledWith(true);

    fakeMount.setPanelBlurred.mockClear();

    Object.defineProperty(video, 'paused', { value: false, configurable: true, writable: true });
    video.currentTime = 5;
    video.dispatchEvent(new Event('timeupdate'));

    expect(fakeMount.setPanelBlurred).toHaveBeenLastCalledWith(false);
  });

describe('adaptive band probe', () => {
  const adaptiveMode: StudyMode = {
    id: 'adaptive',
    type: 'preset',
    icon: 'gauge',
    title: 'Adaptive',
    description: '',
    steps: [{ subtitle: 'adaptive', pause: 'none', repeat: 1, speed: 1, after: 'continue' }],
  };
  const adaptiveAdvanced: StudyModeAdvancedSettings = { skipNoDialogue: 'OFF', removeBracketed: false, pauseOnUnknown: 'OFF', unknownLevel: 'advanced', popupOnAutoPause: false, popupCloseOnResume: true };
  const adaptiveCues: SrtCue[] = [
    { index: 1, start: 0, end: 5000, text: 'Easy cue' },
    { index: 2, start: 5000, end: 10000, text: 'Dense cue' },
  ];

  it('resolves subtitle visibility per cue through setBandProbe', () => {
    Object.defineProperty(video, 'paused', { value: false, configurable: true });
    controller.loadCues(adaptiveCues);
    controller.setBandProbe((i) => (i === 0 ? 'easy' : 'dense'));
    fakeEngine.getActiveIndices.mockReturnValue({ target: 0, native: -1 });
    controller.applyStudyMode(adaptiveMode, adaptiveAdvanced);

    // easy → 'none' applied on cue-0 entry inside applyStudyMode's sync.
    expect(fakeMount.setStyles).toHaveBeenLastCalledWith(
      expect.objectContaining({ visible: false }),
      expect.objectContaining({ visible: false }),
    );

    fakeEngine.getActiveIndices.mockReturnValue({ target: 1, native: -1 });
    video.currentTime = 6;
    // First timeupdate ends cue 0's chain; the next enters cue 1.
    video.dispatchEvent(new Event('timeupdate'));
    video.dispatchEvent(new Event('timeupdate'));
    // dense → 'both' → both lines visible.
    expect(fakeMount.setStyles).toHaveBeenLastCalledWith(
      expect.objectContaining({ visible: true }),
      expect.objectContaining({ visible: true }),
    );
  });

  it('falls back to both subtitles when no band probe is wired', () => {
    controller.loadCues(adaptiveCues);
    fakeEngine.getActiveIndices.mockReturnValue({ target: 0, native: -1 });
    controller.applyStudyMode(adaptiveMode, adaptiveAdvanced);

    expect(fakeMount.setStyles).toHaveBeenLastCalledWith(
      expect.objectContaining({ visible: true }),
      expect.objectContaining({ visible: true }),
    );
  });
});

});
