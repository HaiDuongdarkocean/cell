/**
 * useSubtitleEngine — binds SubtitleCueEngine to the local player's <video>.
 *
 * Creates a SubtitleCueEngine instance when the video element is available,
 * attaches its onTimeUpdate to the video's timeupdate event, and exposes
 * NavCluster actions (prev/next/repeat/rewind/forward/play-pause), AB-loop
 * state, and subtitle offset control.
 *
 * The engine dispatches `cell:cues:updated` events on `document` → the global
 * `cuesStore` listener syncs cues + active indices → `SubtitleBlock` re-renders.
 * No direct coupling between this hook and SubtitleBlock.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { SubtitleCueEngine, type NavClusterIconName } from '@/features/subtitle/ui/subtitleCueEngine';
import { useCuesStore } from '@/stores/cuesStore';
import type { SrtCue } from '@/entities/media';
import type { OverlayStyleConfig } from '@/entities/subtitle';
import type { SubtitleBlockSettings, NavClusterSettings } from '@/entities/settings';
import {
  DEFAULT_OVERLAY_STYLE_TARGET,
  DEFAULT_OVERLAY_STYLE_NATIVE,
  DEFAULT_SUBTITLE_BLOCK_SETTINGS,
  DEFAULT_NAV_CLUSTER_SETTINGS,
} from '@/shared/config/config';

export interface SubtitleEngineState {
  /** Whether subtitles are loaded (target or native cues exist). */
  hasSubtitles: boolean;
  /** AB-loop repeat icon state for NavCluster (ICON_CATALOG key). */
  repeatIcon: string;
  /** AB-loop repeat label for NavCluster aria-label. */
  repeatLabel: string;
  /** AB-loop repeat active state. */
  repeatActive: boolean;
  /** Current subtitle offset in ms. */
  offsetMs: number;
}

/** Map engine NavClusterIconName → ICON_CATALOG key for NavCluster component. */
const REPEAT_ICON_MAP: Record<NavClusterIconName, string> = {
  prev: 'navPrev',
  next: 'navNext',
  repeat: 'navRepeat',
  repeatA: 'navRepeatA',
  repeatB: 'navRepeatB',
  repeatCancel: 'navRepeatCancel',
  rewind: 'navRewind',
  forward: 'navForward',
  play: 'play',
  pause: 'pause',
};

export interface SubtitleEngineControls extends SubtitleEngineState {
  /** Load target + native cues into the engine. */
  loadCues: (targetCues: SrtCue[], nativeCues: SrtCue[]) => void;
  /** Clear all cues. */
  clearCues: () => void;
  /** NavCluster: go to previous sentence. */
  prev: () => void;
  /** NavCluster: go to next sentence. */
  next: () => void;
  /** NavCluster: toggle AB-loop / repeat current sentence. */
  repeat: () => void;
  /** NavCluster: seek backward 5s. */
  rewind: () => void;
  /** NavCluster: seek forward 10s. */
  forward: () => void;
  /** NavCluster: toggle play/pause. */
  playPause: () => void;
  /** Set subtitle offset in ms. */
  setOffset: (ms: number) => void;
  /** Current target overlay style. */
  targetStyle: OverlayStyleConfig;
  /** Current native overlay style. */
  nativeStyle: OverlayStyleConfig;
  /** Current subtitle block settings. */
  blockSettings: SubtitleBlockSettings;
  /** Current nav cluster settings. */
  clusterSettings: NavClusterSettings;
  /** Update target/native overlay style (re-renders SubtitleBlock). */
  updateStyle: (role: 'target' | 'native', partial: Partial<OverlayStyleConfig>) => void;
  /** Update block settings (re-renders SubtitleBlock). */
  updateBlockSettings: (partial: Partial<SubtitleBlockSettings>) => void;
  /** Update nav cluster settings. */
  updateClusterSettings: (partial: Partial<NavClusterSettings>) => void;
  /** Get target cues (for download). */
  getTargetCues: () => readonly SrtCue[];
  /** Get native cues (for download). */
  getNativeCues: () => readonly SrtCue[];
}

export function useSubtitleEngine(
  videoRef: React.RefObject<HTMLVideoElement | null>,
  videoFile: File | null,
): SubtitleEngineControls {
  const engineRef = useRef<SubtitleCueEngine | null>(null);
  const [hasSubtitles, setHasSubtitles] = useState(false);
  const [repeatIcon, setRepeatIcon] = useState<string>(REPEAT_ICON_MAP.repeat);
  const [repeatLabel, setRepeatLabel] = useState('Repeat current sentence');
  const [repeatActive, setRepeatActive] = useState(false);
  const [offsetMs, setOffsetMs] = useState(0);
  const offsetRef = useRef(0);
  const [targetStyle, setTargetStyle] = useState<OverlayStyleConfig>(DEFAULT_OVERLAY_STYLE_TARGET);
  const [nativeStyle, setNativeStyle] = useState<OverlayStyleConfig>(DEFAULT_OVERLAY_STYLE_NATIVE);
  const [blockSettings, setBlockSettings] = useState<SubtitleBlockSettings>(DEFAULT_SUBTITLE_BLOCK_SETTINGS);
  const [clusterSettings, setClusterSettings] = useState<NavClusterSettings>(DEFAULT_NAV_CLUSTER_SETTINGS);

  // Create engine when video element mounts (re-create on videoFile change
  // because the <video> element is conditionally rendered — same pattern as
  // useLocalVideo).
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const engine = new SubtitleCueEngine(
      video,
      blockSettings,
      targetStyle,
      nativeStyle,
      clusterSettings,
      () => offsetRef.current,
    );
    engineRef.current = engine;

    video.addEventListener('timeupdate', engine.onTimeUpdate);

    return (): void => {
      video.removeEventListener('timeupdate', engine.onTimeUpdate);
      engine.clearCues();
      engineRef.current = null;
      useCuesStore.getState().setCues([], []);
      useCuesStore.getState().setActiveIndex(-1, -1);
      setHasSubtitles(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [videoRef, videoFile]);

  const loadCues = useCallback((targetCues: SrtCue[], nativeCues: SrtCue[]): void => {
    const engine = engineRef.current;
    if (!engine) return;
    if (nativeCues.length > 0) {
      engine.loadBilingualCues(targetCues, nativeCues);
    } else {
      engine.loadCues(targetCues);
    }
    setHasSubtitles(engine.hasSubtitles());
  }, []);

  const clearCues = useCallback((): void => {
    engineRef.current?.clearCues();
    setHasSubtitles(false);
  }, []);

  const prev = useCallback((): void => engineRef.current?.handlePrev(), []);
  const next = useCallback((): void => engineRef.current?.handleNext(), []);
  const rewind = useCallback((): void => engineRef.current?.handleRewind(), []);
  const forward = useCallback((): void => engineRef.current?.handleForward(), []);
  const playPause = useCallback((): void => { engineRef.current?.handlePlayPause(); }, []);

  const repeat = useCallback((): void => {
    const engine = engineRef.current;
    if (!engine) return;
    const state = engine.handleNoSubRepeatClick();
    setRepeatIcon(REPEAT_ICON_MAP[state.icon]);
    setRepeatLabel(state.label);
    setRepeatActive(state.active);
  }, []);

  const setOffset = useCallback((ms: number): void => {
    offsetRef.current = ms;
    setOffsetMs(ms);
  }, []);

  const updateStyle = useCallback((role: 'target' | 'native', partial: Partial<OverlayStyleConfig>): void => {
    const engine = engineRef.current;
    if (!engine) return;
    if (role === 'target') {
      const next = { ...engine.getTargetStyle(), ...partial };
      engine.updateSettings({ targetStyle: next });
      setTargetStyle(next);
    } else {
      const next = { ...engine.getNativeStyle(), ...partial };
      engine.updateSettings({ nativeStyle: next });
      setNativeStyle(next);
    }
  }, []);

  const updateBlockSettings = useCallback((partial: Partial<SubtitleBlockSettings>): void => {
    const engine = engineRef.current;
    if (!engine) return;
    engine.updateBlockSettings(partial);
    setBlockSettings(engine.getBlockSettings());
  }, []);

  const updateClusterSettings = useCallback((partial: Partial<NavClusterSettings>): void => {
    const engine = engineRef.current;
    if (!engine) return;
    engine.updateSettings({ clusterSettings: partial });
    setClusterSettings(engine.getClusterSettings());
  }, []);

  const getTargetCues = useCallback((): readonly SrtCue[] => engineRef.current?.getTargetCues() ?? [], []);
  const getNativeCues = useCallback((): readonly SrtCue[] => engineRef.current?.getNativeCues() ?? [], []);

  return {
    hasSubtitles,
    repeatIcon,
    repeatLabel,
    repeatActive,
    offsetMs,
    targetStyle,
    nativeStyle,
    blockSettings,
    clusterSettings,
    updateStyle,
    updateBlockSettings,
    updateClusterSettings,
    getTargetCues,
    getNativeCues,
    loadCues,
    clearCues,
    prev,
    next,
    repeat,
    rewind,
    forward,
    playPause,
    setOffset,
  };
}
