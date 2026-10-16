// useCuePanelHostDelegation — when the cue panel ('t' split view) opens inside
// a cross-origin player iframe, render it on the top document instead. The
// child keeps every callback (seek, play, lookup); the host gets serialized
// state and relays actions back. Same pattern as useManagerHostDelegation.

import { useEffect, useMemo, useRef, useState } from 'react';
import type { BilingualCue } from '@/entities/media';
import type { PlaybackSpeed } from '@/entities/studyMode/types';
import type { StudyMode } from '@/entities/studyMode';
import type { SubtitlePracticeMode } from '@/features/studyModes';
import type { ClickModifierState } from '@/entities/dictionary';
import type { KeyboardShortcut } from '@/entities/settings';
import { loadShortcuts } from './contentScriptShared';
import type { CueListTokenize } from './CueList';
import type { IconCatalogKey } from '@/shared/icons';
import {
  cuePanelRemoteCapable,
  sendCuePanelState,
  onCuePanelAction,
} from '@/features/subtitle/logic/iframeCuePanelBridgeChild';
import { claimRelayNonce } from '@/shared/lib/dom/claimSingletonInstall';
import { markTopAnchoredTarget } from '@/shared/lib/dom/topAnchoredTarget';
import type { SerializedCuePanelState } from '@/features/subtitle/logic/iframeCuePanelBridgeTypes';

export interface CuePanelHostDelegationParams {
  splitViewOpen: boolean;
  /** Child-viewport mobile check — remote rendering only escapes the iframe
   *  when the local dock can't fit (mobile/small embed). Desktop keeps the
   *  in-container split view. */
  isMobile: boolean;
  cues: readonly BilingualCue[];
  currentTimeMs: number;
  offsetMs: number;
  isPlaying: boolean;
  repeatActive: boolean;
  repeatIcon?: IconCatalogKey;
  repeatLabel?: string;
  playbackSpeed: PlaybackSpeed;
  practiceMode: SubtitlePracticeMode;
  activeModeId: string | null;
  customModes: readonly StudyMode[];
  tokenize: CueListTokenize | null;
  panelBlurred: boolean;
  ocrEnabled: boolean;
  generateNativeEnabled: boolean;
  interactionLocked: boolean;
  filename?: string;
  onClose: () => void;
  onToggle?: () => void;
  onSeek?: (timeMs: number) => void;
  onPrev?: () => void;
  onNext?: () => void;
  onRepeat?: () => void;
  onRewind?: () => void;
  onForward?: () => void;
  onPlayPause?: () => void;
  onPreviousCue?: (cue: BilingualCue) => void;
  onReplayCue?: (cue: BilingualCue) => void;
  onContinueCue?: (cue: BilingualCue) => void;
  onPracticeModeChange?: (mode: SubtitlePracticeMode) => void;
  onPlaybackSpeedChange?: (speed: PlaybackSpeed) => void;
  onStudyModeChange?: (modeId: string) => void;
  onSaveCue?: (cue: BilingualCue) => void;
  onQuickAdd?: () => void;
  onEditCard?: () => void;
  onToggleOcr?: () => void;
  onGenerateNative?: () => void;
  onToggleManager?: () => void;
  onToggleInteractionLock?: () => void;
}

export interface CuePanelHostDelegation {
  /** True while the panel surface lives on the top document. */
  cuePanelOnHost: boolean;
}

export function useCuePanelHostDelegation(
  params: CuePanelHostDelegationParams,
): CuePanelHostDelegation {
  const remoteCapable = cuePanelRemoteCapable();
  const cuePanelOnHost = params.splitViewOpen && remoteCapable && params.isMobile;

  // The host relays top-page hotkeys down — it needs the child's real
  // bindings (same store the keyboard handler reads), then announce so the
  // host records the route for that relay.
  const [shortcuts, setShortcuts] = useState<KeyboardShortcut[] | undefined>();
  const latestStateRef = useRef<SerializedCuePanelState | null>(null);
  useEffect(() => {
    if (!remoteCapable) return;
    let alive = true;
    const announce = (bindings?: KeyboardShortcut[]): void => {
      const st = latestStateRef.current;
      if (!st) return;
      // Keep st.open as-is — a forced false arriving late (slow
      // loadShortcuts) would close a panel the user just opened.
      sendCuePanelState({ ...st, shortcuts: bindings });
    };
    void loadShortcuts()
      .then((ss) => {
        if (!alive) return;
        setShortcuts(ss);
        announce(ss);
      })
      .catch(() => announce());
    return () => { alive = false; };
  }, [remoteCapable]);

  // Host → child actions. Listen whenever remote-capable — not just while
  // open — so the host's 't' relay can toggle the panel back ON. Handlers
  // read the latest params through a ref so the 4Hz time-tick re-renders
  // don't churn the listener.
  const paramsRef = useRef(params);
  paramsRef.current = params;
  useEffect(() => {
    if (!remoteCapable) return;
    return onCuePanelAction((action, args) => {
      const p = paramsRef.current;
      const tokenize = p.tokenize;
      // Cross-world claim at act-point: only the world that actually has the
      // callback claims the rid — a stale world without it can't eat the
      // action for the live world.
      const act = (fn: (() => void) | undefined): void => {
        if (!fn) return;
        if (!claimRelayNonce('cue-panel-action', args.rid)) return;
        fn();
      };
      switch (action) {
        case 'close': act(p.onClose); break;
        case 'toggle': act(p.onToggle ?? p.onClose); break;
        // Relayed top-page hotkey — redispatch through the child's real
        // keydown handler so every configured shortcut runs the same path.
        // A dispatched event reaches every stacked world's listener — the
        // event-level dedupe (key+timeStamp) inside the handlers keeps it to
        // exactly one action.
        case 'keydown': {
          const key = args.key as string | undefined;
          if (!key) break;
          window.dispatchEvent(new KeyboardEvent('keydown', {
            key,
            ctrlKey: args.ctrl === true,
            shiftKey: args.shift === true,
            altKey: args.alt === true,
          }));
          break;
        }
        case 'seek': act(() => p.onSeek?.(args.timeMs as number)); break;
        case 'prev': act(p.onPrev); break;
        case 'next': act(p.onNext); break;
        case 'repeat': act(p.onRepeat); break;
        case 'rewind': act(p.onRewind); break;
        case 'forward': act(p.onForward); break;
        case 'playPause': act(p.onPlayPause); break;
        case 'previousCue': act(() => p.onPreviousCue?.(args.cue as BilingualCue)); break;
        case 'replayCue': act(() => p.onReplayCue?.(args.cue as BilingualCue)); break;
        case 'continueCue': act(() => p.onContinueCue?.(args.cue as BilingualCue)); break;
        case 'practiceMode': act(() => p.onPracticeModeChange?.(args.mode as SubtitlePracticeMode)); break;
        case 'playbackSpeed': act(() => p.onPlaybackSpeedChange?.(args.speed as PlaybackSpeed)); break;
        case 'studyMode': act(() => p.onStudyModeChange?.(args.modeId as string)); break;
        case 'saveCue': act(() => p.onSaveCue?.(args.cue as BilingualCue)); break;
        case 'quickAdd': act(p.onQuickAdd); break;
        case 'editCard': act(p.onEditCard); break;
        case 'toggleOcr': act(p.onToggleOcr); break;
        case 'generateNative': act(p.onGenerateNative); break;
        case 'toggleManager': act(p.onToggleManager); break;
        case 'toggleInteractionLock': act(p.onToggleInteractionLock); break;
        case 'tokenHover': act(tokenize?.onTokenHover ? () => tokenize.onTokenHover!(args.term as string | null) : undefined); break;
        case 'tokenCtrlClick': act(tokenize?.onTokenCtrlClick ? () => tokenize.onTokenCtrlClick!(args.term as string) : undefined); break;
        case 'tokenClick': {
          if (!tokenize?.onTokenClick) break;
          if (!claimRelayNonce('cue-panel-action', args.rid)) break;
          // The token element lives on the host document — synthesize a
          // detached stand-in carrying the attributes the lookup path reads,
          // with a rect already in top-frame coordinates.
          const span = document.createElement('span');
          span.className = 'js-Tihoka-token';
          span.setAttribute('data-tihoka-start', String(args.cursorOffset ?? 0));
          const r = args.rect as { x: number; y: number; width: number; height: number } | undefined;
          if (r) {
            span.getBoundingClientRect = () => new DOMRect(r.x, r.y, r.width, r.height);
          }
          markTopAnchoredTarget(span);
          tokenize.onTokenClick(
            args.term as string,
            span,
            (args.contextSentence as string) ?? '',
            (args.event as ClickModifierState) ?? { ctrlKey: false, shiftKey: false, altKey: false },
            args.cursorOffset as number | undefined,
          );
          break;
        }
      }
    });
  }, [remoteCapable]);

  // Bulk-token selection mutates in place (same Set identity) — subscribe so
  // the serialized selectedTerms actually refresh on the host.
  const [selectionVersion, setSelectionVersion] = useState(0);
  useEffect(() => {
    const selection = params.tokenize?.selection;
    if (!selection) return;
    return selection.subscribe(() => setSelectionVersion((v) => v + 1));
  }, [params.tokenize]);

  // Push serialized state on open + every change (time ticks included).
  const state: SerializedCuePanelState = useMemo(() => ({
    open: params.splitViewOpen,
    cues: [...params.cues],
    currentTimeMs: params.currentTimeMs,
    offsetMs: params.offsetMs,
    isPlaying: params.isPlaying,
    repeatActive: params.repeatActive,
    repeatIcon: params.repeatIcon,
    repeatLabel: params.repeatLabel,
    playbackSpeed: params.playbackSpeed,
    practiceMode: params.practiceMode,
    activeModeId: params.activeModeId,
    customModes: params.customModes,
    tokenize: params.tokenize
      ? {
          langCode: params.tokenize.langCode,
          readingDisplay: params.tokenize.readingDisplay,
          glossDisplay: params.tokenize.glossDisplay,
          glossTargetLanguage: params.tokenize.glossTargetLanguage,
          selectedTerms: params.tokenize.selection
            ? [...params.tokenize.selection.getTerms()]
            : [],
        }
      : null,
    panelBlurred: params.panelBlurred,
    ocrEnabled: params.ocrEnabled,
    generateNativeEnabled: params.generateNativeEnabled,
    interactionLocked: params.interactionLocked,
    filename: params.filename,
    pageUrl: location.href,
    pageTitle: document.title,
    shortcuts,
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [
    params.splitViewOpen, params.cues, params.currentTimeMs, params.offsetMs,
    params.isPlaying, params.repeatActive, params.repeatIcon, params.repeatLabel,
    params.playbackSpeed, params.practiceMode, params.activeModeId,
    params.customModes, params.tokenize, params.panelBlurred, params.ocrEnabled,
    params.generateNativeEnabled, params.interactionLocked, params.filename,
    selectionVersion, shortcuts,
  ]);

  // Send on every change while remotely open — and once with open:false so
  // the host unmounts when the child closes the panel. Throttled like the
  // manager bridge (timeupdate ticks ~4Hz; state carries the whole cue list).
  const wasOnHostRef = useRef(false);
  const throttleRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  latestStateRef.current = state;
  useEffect(() => {
    if (!remoteCapable) return;
    if (!cuePanelOnHost && !wasOnHostRef.current) return;
    if (!cuePanelOnHost) {
      // Close is not throttled — the host must drop the surface now. The
      // memoized state still carries open:true when the remote gate flips
      // off (e.g. rotate to desktop) — force open:false either way.
      wasOnHostRef.current = false;
      if (throttleRef.current) { clearTimeout(throttleRef.current); throttleRef.current = null; }
      const st = latestStateRef.current;
      if (st) sendCuePanelState({ ...st, open: false });
      return;
    }
    // Open edge sends synchronously — timers inside hidden/backgrounded
    // iframes are intensively throttled by Chrome (~1/min), so the very
    // first state can't wait on a timer that may never fire.
    if (!wasOnHostRef.current) {
      wasOnHostRef.current = true;
      sendCuePanelState(state);
    }
    // Steady-state updates (4Hz time ticks) still ride the throttle.
    if (throttleRef.current) return;
    throttleRef.current = setTimeout(() => {
      throttleRef.current = null;
      if (latestStateRef.current && wasOnHostRef.current) {
        sendCuePanelState(latestStateRef.current);
      }
    }, 120);
  }, [remoteCapable, cuePanelOnHost, state]);

  return { cuePanelOnHost };
}
