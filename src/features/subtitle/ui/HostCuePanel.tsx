// HostCuePanel — top-document render of the 't' cue panel for a player living
// in a cross-origin iframe. Desktop: right-docked resizable panel (same as the
// in-page split view minus the shell narrowing — the shell is unreachable).
// Mobile host viewport: bottom sheet via the shared <Sheet> atom.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { BilingualCue } from '@/entities/media';
import { SubtitlePanel } from './SubtitlePanel';
import { MobileCueChrome } from './MobileCueChrome';
import { Sheet } from '@/shared/ui/Sheet';
import { useIsMobile } from '@/shared/ui/useIsMobile';
import { BREAKPOINTS } from '@/shared/lib/tokens';
import { pushEscapeLayer } from '@/shared/ui/escapeLayerStack';
import { t } from '@/shared/i18n';
import { STORAGE_KEYS } from '@/shared/config/config';
import type { CueListTokenize, CueListTokenSelection } from './CueList';
import type {
  CuePanelAction,
  SerializedCuePanelState,
} from '@/features/subtitle/logic/iframeCuePanelBridgeTypes';

const DOCK_MIN_WIDTH = 280;
const DOCK_DEFAULT_WIDTH = 420;
const HANDLE_HIT_PX = 12;
const SHEET_HEIGHT_RATIO = 0.62;

type Post = (action: CuePanelAction, args?: Record<string, unknown>) => void;

function rebuildTokenize(
  ser: SerializedCuePanelState['tokenize'],
  post: Post,
): CueListTokenize | null {
  if (!ser) return null;
  const terms = new Set(ser.selectedTerms ?? []);
  const listeners = new Set<(terms: ReadonlySet<string>) => void>();
  const selection: CueListTokenSelection = {
    getTerms: () => terms,
    subscribe: (cb) => { listeners.add(cb); return () => listeners.delete(cb); },
  };
  return {
    langCode: ser.langCode,
    readingDisplay: ser.readingDisplay,
    glossDisplay: ser.glossDisplay,
    glossTargetLanguage: ser.glossTargetLanguage,
    selection,
    onTokenClick: (term, element, contextSentence, event, cursorOffset) => {
      const r = element.getBoundingClientRect();
      post('tokenClick', {
        term, contextSentence, cursorOffset,
        event: { ctrlKey: event.ctrlKey, shiftKey: event.shiftKey, altKey: event.altKey },
        rect: { x: r.x, y: r.y, width: r.width, height: r.height },
      });
    },
    onTokenHover: (term) => post('tokenHover', { term }),
    onTokenCtrlClick: (term) => post('tokenCtrlClick', { term }),
  };
}

export function HostCuePanel({
  state,
  post,
}: {
  state: SerializedCuePanelState;
  post: Post;
}): React.JSX.Element {
  const isMobile = useIsMobile(BREAKPOINTS.medium);
  const [dockWidth, setDockWidth] = useState(DOCK_DEFAULT_WIDTH);
  const dragRef = useRef<{ startX: number; startWidth: number } | null>(null);

  const close = useCallback(() => post('close'), [post]);

  // Escape closes the remote panel — forwarded back so the child toggles off.
  useEffect(() => pushEscapeLayer(() => close()), [close]);

  // Each state push carries a fresh serialized tokenize — the rebuilt adapter
  // gets a fresh selection Set, so no in-place sync is needed.
  const tokenize = useMemo(() => rebuildTokenize(state.tokenize, post), [state.tokenize, post]);

  const onHandlePointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    dragRef.current = { startX: e.clientX, startWidth: dockWidth };
    e.currentTarget.setPointerCapture(e.pointerId);
    const move = (ev: PointerEvent): void => {
      const d = dragRef.current;
      if (!d) return;
      const w = Math.min(window.innerWidth - 48, Math.max(DOCK_MIN_WIDTH, d.startWidth + (d.startX - ev.clientX)));
      setDockWidth(w);
    };
    const up = (): void => {
      dragRef.current = null;
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  }, [dockWidth]);

  const shared = {
    cues: state.cues as BilingualCue[],
    currentTimeMs: state.currentTimeMs,
    offsetMs: state.offsetMs,
    onSeek: (timeMs: number) => post('seek', { timeMs }),
    activeModeId: state.activeModeId ?? undefined,
    customModes: state.customModes,
    onStudyModeChange: (modeId: string) => post('studyMode', { modeId }),
    practiceMode: state.practiceMode,
    onPracticeModeChange: (mode: NonNullable<SerializedCuePanelState['practiceMode']>) => post('practiceMode', { mode }),
    isPlaying: state.isPlaying,
    playbackSpeed: state.playbackSpeed,
    onPlaybackSpeedChange: (speed: typeof state.playbackSpeed) => post('playbackSpeed', { speed }),
    onPlayPause: () => post('playPause'),
    onPreviousCue: (cue: BilingualCue) => post('previousCue', { cue }),
    onReplayCue: (cue: BilingualCue) => post('replayCue', { cue }),
    onContinueCue: (cue: BilingualCue) => post('continueCue', { cue }),
    tokenize,
    panelBlurred: state.panelBlurred,
    onSaveCue: (cue: BilingualCue) => post('saveCue', { cue }),
  };

  if (isMobile) {
    return (
      <Sheet
        open
        onClose={close}
        aria-label={t('subtitle.toolbar.openList')}
        initialHeight={Math.round(window.innerHeight * SHEET_HEIGHT_RATIO)}
        persistKey={STORAGE_KEYS.CUE_PANEL_SHEET_HEIGHT_VH}
        data-tihoka-id="host-cue-sheet"
      >
        {/* .mobileCueChrome is flex:1 — it needs a flex-column parent with a
            real height, which the Sheet body alone doesn't provide. */}
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
        <MobileCueChrome
          cueListOpen
          onExit={close}
          exitLabel={t('subtitle.toolbar.closeList')}
          onQuickAdd={() => post('quickAdd')}
          onEditCard={() => post('editCard')}
          onToggleOcr={() => post('toggleOcr')}
          ocrEnabled={state.ocrEnabled}
          onGenerateNative={() => post('generateNative')}
          onToggleManager={() => post('toggleManager')}
          generateNativeEnabled={state.generateNativeEnabled}
          onPrev={() => post('prev')}
          onNext={() => post('next')}
          onRepeat={() => post('repeat')}
          repeatActive={state.repeatActive}
          repeatLabel={state.repeatLabel}
          repeatIcon={state.repeatIcon}
          onRewind={() => post('rewind')}
          onForward={() => post('forward')}
          onPlayPause={() => post('playPause')}
          isPlaying={state.isPlaying}
          interactionLocked={state.interactionLocked}
          onToggleInteractionLock={() => post('toggleInteractionLock')}
          cues={shared.cues}
          currentTimeMs={shared.currentTimeMs}
          offsetMs={shared.offsetMs}
          onSeek={shared.onSeek}
          activeModeId={shared.activeModeId}
          customModes={shared.customModes}
          onStudyModeChange={shared.onStudyModeChange}
          practiceMode={shared.practiceMode}
          onPracticeModeChange={shared.onPracticeModeChange}
          playbackSpeed={shared.playbackSpeed}
          onPlaybackSpeedChange={shared.onPlaybackSpeedChange}
          onPreviousCue={shared.onPreviousCue}
          onReplayCue={shared.onReplayCue}
          onContinueCue={shared.onContinueCue}
          tokenize={shared.tokenize}
          panelBlurred={shared.panelBlurred}
          onSaveCue={shared.onSaveCue}
        />
        </div>
      </Sheet>
    );
  }

  return (
    <div
      data-tihoka-split-view="host-panel"
      style={{
        position: 'fixed',
        top: 0,
        right: 0,
        bottom: 0,
        width: dockWidth,
        display: 'flex',
        flexDirection: 'column',
        background: 'color-mix(in srgb, var(--color-surface) 85%, transparent)',
        backdropFilter: 'blur(var(--blur-lg))',
        WebkitBackdropFilter: 'blur(var(--blur-lg))',
        borderLeft: '1px solid var(--color-border-subtle)',
        zIndex: 'var(--z-overlay-video, 10000)',
      }}
    >
      <div
        role="separator"
        aria-orientation="vertical"
        aria-label={t('subtitle.playerMode.resizeList')}
        onPointerDown={onHandlePointerDown}
        style={{
          position: 'absolute',
          top: 0,
          bottom: 0,
          left: -HANDLE_HIT_PX / 2,
          width: HANDLE_HIT_PX,
          cursor: 'col-resize',
          touchAction: 'pan-y',
          zIndex: 2,
        }}
      />
      <SubtitlePanel
        {...shared}
        onClose={close}
        filename={state.filename}
      />
    </div>
  );
}
