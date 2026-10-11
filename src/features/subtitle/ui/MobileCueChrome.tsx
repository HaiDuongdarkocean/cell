// MobileCueChrome — shared <600px cue chrome used by Player Mode mobile and
// the normal-mode split-view sheet: cue cards region + floating anchor band
// (manager / filter FAB / generate-native rail) + bottom transport bar + the
// ⋯ more-menu Sheet. Keeps one SSOT so both surfaces stay visually identical.

import { useEffect, useRef, useState } from 'react';
import type { BilingualCue } from '@/entities/media';
import type { PlaybackSpeed } from '@/entities/studyMode/types';
import type { StudyMode } from '@/entities/studyMode';
import type { SubtitlePracticeMode } from '@/features/studyModes';
import type { CueListTokenize } from './CueList';
import { SubtitlePanel } from './SubtitlePanel';
import { Button } from '@/shared/ui/Button';
import { MenuItem, MenuSeparator } from '@/shared/ui/Menu';
import { Sheet } from '@/shared/ui/Sheet';
import { Icon } from '@/shared/icons/Icon';
import { PRESETS } from '@/entities/studyMode/constants';
import { PlaybackSpeedStepper } from '@/features/studyModes';
import { t } from '@/shared/i18n';
import { STORAGE_KEYS } from '@/shared/config/config';
import {
  getStorage,
  onStorageChanged,
  removeOnStorageChangedListener,
} from '@/shared/lib/chrome-apis';
import styles from './PlayerModeOverlay.module.css';

const SHEET_HEIGHT_RATIO = 0.62;
const ORBITAL_POSITION_KEY = 'orbitalBadgePosition';
const ORBITAL_BADGE_DEFAULT_SIZE = 36;
const FAB_GAP_PX = 8;
type StoredOrbitalPosition = { edge?: 'left' | 'right' | 'top' | 'bottom'; y?: number };

export interface MobileCueChromeProps {
  /** Cue region visible. Player Mode can collapse to the rail-only peek;
   *  the normal-mode sheet always passes true (closing unmounts the sheet). */
  cueListOpen: boolean;
  /** PM: toggles the cue region. Omit → the ⋯ menu hides the cue-list row. */
  onToggleCueList?: () => void;
  onExit: () => void;
  /** aria-label + title for the left-edge exit button (PM exit vs panel close). */
  exitLabel: string;
  exitTitle?: string;
  onQuickAdd?: () => void;
  onEditCard?: () => void;
  onToggleOcr?: () => void;
  ocrEnabled?: boolean;
  onGenerateNative?: () => void;
  onToggleManager?: () => void;
  generateNativeEnabled?: boolean;
  onPrev?: () => void;
  onNext?: () => void;
  onRepeat?: () => void;
  repeatActive?: boolean;
  repeatLabel?: string;
  onRewind?: () => void;
  onForward?: () => void;
  onPlayPause?: () => void;
  isPlaying: boolean;
  interactionLocked?: boolean;
  onToggleInteractionLock?: () => void;
  cues?: BilingualCue[];
  currentTimeMs?: number;
  offsetMs?: number;
  onSeek?: (timeMs: number) => void;
  activeModeId?: string;
  customModes?: readonly StudyMode[];
  onStudyModeChange?: (modeId: string) => void;
  practiceMode?: SubtitlePracticeMode;
  onPracticeModeChange?: (mode: SubtitlePracticeMode) => void;
  playbackSpeed?: PlaybackSpeed;
  onPlaybackSpeedChange?: (speed: PlaybackSpeed) => void;
  onPreviousCue?: (cue: BilingualCue) => void;
  onReplayCue?: (cue: BilingualCue) => void;
  onContinueCue?: (cue: BilingualCue) => void;
  tokenize?: CueListTokenize | null;
  panelBlurred?: boolean;
  onSaveCue?: (cue: BilingualCue) => void;
}

export function MobileCueChrome({
  cueListOpen,
  onToggleCueList,
  onExit,
  exitLabel,
  exitTitle,
  onQuickAdd,
  onEditCard,
  onToggleOcr,
  ocrEnabled,
  onGenerateNative,
  onToggleManager,
  generateNativeEnabled,
  onPrev,
  onNext,
  onRepeat,
  repeatActive,
  repeatLabel,
  onRewind,
  onForward,
  onPlayPause,
  isPlaying,
  interactionLocked,
  onToggleInteractionLock,
  cues,
  currentTimeMs,
  offsetMs,
  onSeek,
  activeModeId,
  customModes,
  onStudyModeChange,
  practiceMode,
  onPracticeModeChange,
  playbackSpeed,
  onPlaybackSpeedChange,
  onPreviousCue,
  onReplayCue,
  onContinueCue,
  tokenize,
  panelBlurred,
  onSaveCue,
}: MobileCueChromeProps): React.JSX.Element {
  const [cueDisplayMode, setCueDisplayMode] = useState<'list' | 'active'>('list');
  const [showAllCues, setShowAllCues] = useState(false);
  const [moreMenuOpen, setMoreMenuOpen] = useState(false);
  const [fabSlot, setFabSlot] = useState<HTMLDivElement | null>(null);
  const bottomBarRef = useRef<HTMLElement>(null);
  const anchorRowRef = useRef<HTMLDivElement>(null);

  // Cue display mode (list | active) persisted in storage and live-updated
  // via chrome.storage.onChanged (scoped to this key). Shared between PM
  // mobile and the normal-mode sheet — one reading preference per user.
  useEffect(() => {
    let cancelled = false;
    const key = STORAGE_KEYS.PLAYER_MODE_CUE_DISPLAY;
    getStorage<Record<string, unknown>>(key)
      .then((data) => {
        const v = data[key];
        if (!cancelled && (v === 'list' || v === 'active')) setCueDisplayMode(v);
      })
      .catch(() => undefined);
    const onChanged = (
      changes: Record<string, chrome.storage.StorageChange>,
      area: string,
    ): void => {
      if (area !== 'local') return;
      const v = changes[key]?.newValue;
      if (v === 'list' || v === 'active') setCueDisplayMode(v);
    };
    onStorageChanged(onChanged);
    return () => {
      cancelled = true;
      removeOnStorageChangedListener(onChanged);
    };
  }, []);

  // Session override reset: switching display mode drops "show all cues" so
  // 'active' returns to 1 card.
  useEffect(() => {
    setShowAllCues(false);
  }, [cueDisplayMode]);

  // Flag + anchor offset on <html> — the comprehension pill's :host-context
  // rule re-docks it centered above the bottom bar. Pure CSS mechanism:
  // remount-safe and self-restoring when the attribute is removed.
  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute('data-cell-player-mode-mobile', 'true');
    const bar = bottomBarRef.current?.offsetHeight ?? 0;
    const row = anchorRowRef.current?.offsetHeight ?? 0;
    root.style.setProperty('--pm-anchor-bottom', `${Math.round(bar + row / 2)}px`);
    return () => {
      root.removeAttribute('data-cell-player-mode-mobile');
      root.style.removeProperty('--pm-anchor-bottom');
    };
  }, [cueListOpen, cues]);

  // REQ-8: when the orbital badge is snapped to the right edge and its
  // vertical span overlaps the rail, lift the fab above the badge — keeps
  // the rail's right edge flush with the bottom bar (AC-18).
  const [orbitalLiftPx, setOrbitalLiftPx] = useState(0);
  useEffect(() => {
    let cancelled = false;
    const sync = (): void => {
      Promise.all([
        getStorage<Record<string, StoredOrbitalPosition | undefined>>(ORBITAL_POSITION_KEY),
        getStorage<Record<string, { dictionaryPopup?: { badgePointerTrigger?: { size?: number } } }>>(
          STORAGE_KEYS.SETTINGS,
        ),
      ])
        .then(([posData, settingsData]) => {
          if (cancelled) return;
          const pos = posData[ORBITAL_POSITION_KEY];
          const edge = pos?.edge ?? 'right';
          if (edge !== 'right') {
            setOrbitalLiftPx(0);
            return;
          }
          const sizeValue = settingsData[STORAGE_KEYS.SETTINGS]?.dictionaryPopup?.badgePointerTrigger?.size;
          const size = typeof sizeValue === 'number' ? sizeValue : ORBITAL_BADGE_DEFAULT_SIZE;
          const badgeCy = typeof pos?.y === 'number' ? pos.y : window.innerHeight / 2;
          const badgeTop = badgeCy - size / 2;
          const badgeBottom = badgeCy + size / 2;
          const railRect = anchorRowRef.current
            ?.querySelector<HTMLElement>('[data-cell-id="player-mode-actions"]')
            ?.getBoundingClientRect();
          const railTop = railRect?.top ?? 0;
          const fabZoneTop = railTop - (railRect?.height ?? 0) - FAB_GAP_PX;
          const overlapsFab = badgeBottom > fabZoneTop && badgeTop < railTop;
          setOrbitalLiftPx(railTop > 0 && overlapsFab ? railTop - badgeTop : 0);
        })
        .catch(() => undefined);
    };
    sync();
    const onChanged = (
      changes: Record<string, chrome.storage.StorageChange>,
      area: string,
    ): void => {
      if (area !== 'local') return;
      if (ORBITAL_POSITION_KEY in changes || STORAGE_KEYS.SETTINGS in changes) sync();
    };
    onStorageChanged(onChanged);
    return () => {
      cancelled = true;
      removeOnStorageChangedListener(onChanged);
    };
  }, []);

  const hasCues = (cues ?? []).length > 0;
  const closeMoreMenu = (): void => setMoreMenuOpen(false);

  const pmCardActions =
    onQuickAdd || onEditCard ? (
      <>
        {onQuickAdd && (
          <Button
            variant="primarySubtle"
            size="xs"
            elevation="low"
            aria-label={t('subtitle.toolbar.quickAdd')}
            title={t('subtitle.toolbar.quickAddTitle')}
            data-cell-id="quick-add-btn"
            onClick={onQuickAdd}
          >
            <Icon name="zap" />
          </Button>
        )}
        {onEditCard && (
          <Button
            variant="errorSubtle"
            size="xs"
            elevation="low"
            aria-label={t('subtitle.toolbar.editCard')}
            title={t('subtitle.toolbar.editCardTitle')}
            data-cell-id="edit-card-btn"
            onClick={onEditCard}
          >
            <Icon name="pencil" />
          </Button>
        )}
      </>
    ) : undefined;

  const studyModes = [...PRESETS, ...(customModes ?? [])];

  return (
    <div
      className={styles.mobileCueChrome}
      data-practice-active={practiceMode && practiceMode !== 'off' ? 'true' : 'false'}
      style={orbitalLiftPx > 0 ? ({ '--pm-orbital-lift': `${orbitalLiftPx}px` } as React.CSSProperties) : undefined}
    >
      <div
        className={`${styles.pmCueWrap} ${!cueListOpen || !onSeek ? styles.pmCueWrapCollapsed : ''}`}
        data-cell-split-view="panel"
      >
        {cueListOpen && onSeek && (
          <div className={styles.pmCueRegion} data-cell-id="pm-cue-region">
            <SubtitlePanel
              cues={cues ?? []}
              currentTimeMs={currentTimeMs ?? 0}
              offsetMs={offsetMs}
              onSeek={onSeek}
              activeModeId={activeModeId}
              customModes={customModes}
              onStudyModeChange={onStudyModeChange}
              practiceMode={practiceMode}
              onPracticeModeChange={onPracticeModeChange}
              isPlaying={isPlaying}
              playbackSpeed={playbackSpeed}
              onPlaybackSpeedChange={onPlaybackSpeedChange}
              onPlayPause={onPlayPause}
              onPreviousCue={onPreviousCue}
              onReplayCue={onReplayCue}
              onContinueCue={onContinueCue}
              tokenize={tokenize}
              panelBlurred={panelBlurred}
              pmMobile
              cueDisplayMode={cueDisplayMode}
              showAllCues={showAllCues}
              cardActions={pmCardActions}
              fabPortalTarget={fabSlot}
              onSaveCue={onSaveCue}
            />
          </div>
        )}
        <div className={styles.anchorBand} data-cell-id="pm-anchor-band">
          <div className={styles.anchorRow} ref={anchorRowRef} data-cell-id="pm-anchor-row">
            {onToggleManager && (
              <Button
                variant="neutralSubtle"
                size="md"
                aria-label={t('subtitle.toolbar.openManager')}
                title={t('subtitle.toolbar.openManager')}
                data-cell-id="manager-toggle-btn"
                onClick={onToggleManager}
              >
                <Icon name="captions" />
              </Button>
            )}
            <div className={styles.pmRail} data-cell-id="player-mode-actions">
              <div ref={setFabSlot} data-cell-id="pm-fab-slot" />
              {onGenerateNative && (
                <Button
                  variant="neutralSubtle"
                  size="md"
                  elevation="low"
                  aria-label={t('subtitle.toolbar.generateNative')}
                  title={t('subtitle.toolbar.generateNativeTitle')}
                  data-cell-id="generate-native-btn"
                  onClick={onGenerateNative}
                  disabled={!generateNativeEnabled}
                >
                  <Icon name="generateNative" />
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>

      <nav
        className={styles.bottomBar}
        ref={bottomBarRef}
        data-cell-id="pm-bottom-bar"
        aria-label={t('subtitle.playerMode.menuLabel')}
      >
        <div className={styles.barEdge}>
          <Button
            variant="ghost"
            size="md"
            aria-label={exitLabel}
            title={exitTitle ?? exitLabel}
            data-cell-id="player-mode-exit-btn"
            onClick={onExit}
          >
            <Icon name="x" />
          </Button>
        </div>
        <div className={styles.transport} data-cell-id="nav-cluster">
          {hasCues
            ? onPrev && (
                <Button
                  variant="primarySubtle"
                  size="md"
                  aria-label={t('settings.shortcuts.action.prevCue')}
                  data-cell-id="nav-prev"
                  onClick={onPrev}
                >
                  <Icon name="chevronLeft" />
                </Button>
              )
            : onRewind && (
                <Button
                  variant="primarySubtle"
                  size="md"
                  aria-label={t('subtitle.nav.rewind')}
                  data-cell-id="nav-rewind"
                  onClick={onRewind}
                >
                  <Icon name="navRewind" />
                </Button>
              )}
          {onRepeat && (
            <Button
              variant="primarySubtle"
              size="md"
              aria-label={repeatActive ? t('subtitle.nav.repeatCancel') : repeatLabel ?? t('player.nav.repeat')}
              data-cell-id="nav-repeat"
              active={repeatActive}
              onClick={onRepeat}
            >
              <Icon name="rotateCcw" />
            </Button>
          )}
          {onPlayPause && (
            <Button
              variant="primarySubtle"
              size="md"
              aria-label={isPlaying ? t('subtitle.nav.pause') : t('subtitle.nav.play')}
              data-cell-id="nav-play"
              onClick={onPlayPause}
            >
              <Icon name={isPlaying ? 'pause' : 'play'} />
            </Button>
          )}
          {hasCues
            ? onNext && (
                <Button
                  variant="primarySubtle"
                  size="md"
                  aria-label={t('settings.shortcuts.action.nextCue')}
                  data-cell-id="nav-next"
                  onClick={onNext}
                >
                  <Icon name="chevronRight" />
                </Button>
              )
            : onForward && (
                <Button
                  variant="primarySubtle"
                  size="md"
                  aria-label={t('subtitle.nav.forward')}
                  data-cell-id="nav-forward"
                  onClick={onForward}
                >
                  <Icon name="navForward" />
                </Button>
              )}
        </div>
        <div className={styles.barEdge}>
          <Button
            variant="ghost"
            size="md"
            aria-label={t('subtitle.playerMode.more')}
            aria-haspopup="dialog"
            aria-expanded={moreMenuOpen}
            data-cell-id="pm-more-btn"
            onClick={() => setMoreMenuOpen((v) => !v)}
          >
            <Icon name="ellipsis" />
          </Button>
        </div>
      </nav>

      <Sheet
        open={moreMenuOpen}
        onClose={closeMoreMenu}
        aria-label={t('subtitle.playerMode.menuLabel')}
        initialHeight={Math.round(window.innerHeight * SHEET_HEIGHT_RATIO)}
        data-cell-id="pm-more-menu"
        footer={
          <PlaybackSpeedStepper
            value={playbackSpeed ?? 1}
            onChange={onPlaybackSpeedChange ?? (() => undefined)}
            idPrefix="pm-speed"
          />
        }
      >
        <div className={styles.pmSheetList} role="menu" aria-label={t('subtitle.playerMode.menuLabel')}>
          {onToggleCueList && (
            <MenuItem
              icon={<Icon name="sidePanel" />}
              data-cell-id="panel-toggle-btn"
              onSelect={() => { onToggleCueList(); closeMoreMenu(); }}
            >
              {cueListOpen ? t('subtitle.playerMode.hideCueList') : t('subtitle.playerMode.showCueList')}
            </MenuItem>
          )}
          {onToggleOcr && (
            <MenuItem
              icon={<Icon name="scanText" />}
              selected={ocrEnabled}
              data-cell-id="ocr-toggle-btn"
              onSelect={() => { onToggleOcr(); closeMoreMenu(); }}
            >
              {ocrEnabled ? t('subtitle.toolbar.disableOcr') : t('subtitle.toolbar.enableOcr')}
            </MenuItem>
          )}
          {onToggleInteractionLock && (
            <MenuItem
              icon={<Icon name={interactionLocked ? 'lock' : 'lockOpen'} />}
              selected={interactionLocked}
              data-cell-id="interaction-lock-btn"
              onSelect={() => { onToggleInteractionLock(); closeMoreMenu(); }}
            >
              {interactionLocked ? t('subtitle.toolbar.unlockInteraction') : t('subtitle.toolbar.lockInteraction')}
            </MenuItem>
          )}
          {cueDisplayMode === 'active' && !showAllCues && (
            <MenuItem
              icon={<Icon name="captions" />}
              data-cell-id="pm-show-all-cues"
              onSelect={() => { setShowAllCues(true); closeMoreMenu(); }}
            >
              {t('subtitle.playerMode.showAllCues')}
            </MenuItem>
          )}
          {onStudyModeChange && studyModes.length > 0 && (
            <>
              <MenuSeparator />
              {studyModes.map((mode) => (
                <MenuItem
                  key={mode.id}
                  radio
                  icon={<Icon name={mode.icon} />}
                  selected={activeModeId === mode.id || (!activeModeId && mode.id === 'normal')}
                  data-cell-id={`study-mode-${mode.id}`}
                  onSelect={() => onStudyModeChange(mode.id)}
                >
                  {mode.titleKey ? t(mode.titleKey) : mode.title}
                </MenuItem>
              ))}
            </>
          )}
        </div>
      </Sheet>
    </div>
  );
}
