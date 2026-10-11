// SubtitlePanel — SSOT wrapper for CueList used by both Player Mode and Split View.
// Provides the flex-column + overflow:hidden container that lets CueList's .list
// (flex:1, min-height:0) become the sole scroll container.
//
// Usage:
//   Player Mode: <SubtitlePanel cues={...} currentTimeMs={...} offsetMs={...} onSeek={...} />
//   Split View:  <SubtitlePanel cues={...} currentTimeMs={...} offsetMs={...} onSeek={...} onClose={...} />
//   Split View + Playlist (local-player):
//     <SubtitlePanel ... playlistContent={<LibraryView .../>} onOpenFile={...} onOpenFolder={...} />

import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { ReactNode } from 'react';
import type { BilingualCue } from '@/entities/media';
import type { PlaybackSpeed } from '@/entities/studyMode/types';
import type { StudyMode } from '@/entities/studyMode';
import type { ComprehensionStats } from '@/entities/comprehension';



import { computeStats, ComprehensionBadge, applyCueListTokenStatus, type Token, type CueListTokenMap, type ResolveMeta } from '@/features/tokenize';
import { onWordStatusChanged, onWordStatusRemoved } from '@/features/dictionary';
import { languageMatches } from '@/shared/config/languageRegistry';
import { CueList, type CueListTokenize } from './CueList';
import { PracticeOptions, SubtitlePracticeSession } from '@/features/studyModes';
import type { SubtitlePracticeMode } from '@/features/studyModes';
import {
  countByMode,
  cueDifficultyMap,
  cueMatchesMode,
  isCueFilterMode,
  type CueFilterMode,
} from '@/features/subtitle/logic/cueDifficulty';
import { CueRecommendFab, cueFilterModeLabel } from './CueRecommendFab';
import { applyCleanupRules, resolveCleanupRules } from '@/entities/studyMode';
import { markCueSeekIntent } from '@/shared/lib/cueSeekIntent';
import { loadStudyModeState, useStudyModeStore } from '@/features/studyModes';
import { PRESETS } from '@/entities/studyMode/constants';
import { PLAYBACK_SPEEDS } from '@/entities/studyMode/types';
import { Menu, MenuItem, MenuSeparator } from '@/shared/ui/Menu';
import { StepperSection, StepperValue } from '@/shared/ui/StepperSection';
import { Icon } from '@/shared/icons/Icon';
import { STORAGE_KEYS } from '@/shared/config/config';
import { getStorage, setStorage } from '@/shared/lib/chrome-apis';
import { t } from '@/shared/i18n';
import { ChevronRight } from 'lucide-react';
import { ICON_SIZE_PX } from '@/shared/icons';

import { Button, EmptyState, Tabs } from '@/shared/ui';
import styles from './SubtitlePanel.module.css';

export interface SubtitlePanelProps {
  cues: BilingualCue[];
  currentTimeMs: number;
  /** ADR-019 sync: offset from content script. Highlight cue at
   *  effective = currentTimeMs + offsetMs to match the overlay. */
  offsetMs?: number;
  /** Seek video to timeMs when user clicks a cue. */
  onSeek: (timeMs: number) => void;
  /** Optional close button (Split View). Player Mode handles close via 't'. */
  onClose?: () => void;
  /** Optional Playlist tab content (local-player only). When provided, the
   *  panel renders Tabs (Subtitles | Playlist) instead of just CueList.
   *  The playlist content (LibraryView) owns its own footer with add-file /
   *  add-folder buttons — SubtitlePanel no longer renders them. */
  playlistContent?: ReactNode;
  /** Video filename shown in the panel header (local-player only). */
  filename?: string;
  /** v2 action bar: active study mode id. */
  activeModeId?: string;
  /** v2 action bar: user-created study modes. */
  customModes?: readonly StudyMode[];
  /** v2 action bar: called when the user selects a study mode. */
  onStudyModeChange?: (modeId: string) => void;
  practiceMode?: SubtitlePracticeMode;
  onPracticeModeChange?: (mode: SubtitlePracticeMode) => void;
  isPlaying?: boolean;
  playbackSpeed?: PlaybackSpeed;
  onPlaybackSpeedChange?: (speed: PlaybackSpeed) => void;
  onPlayPause?: () => void;
  onPreviousCue?: (cue: BilingualCue) => void;
  onReplayCue?: (cue: BilingualCue) => void;
  onContinueCue?: (cue: BilingualCue) => void;
  /** Whether to show the native translation under cues. Defaults to true. */
  translationEnabled?: boolean;
  /** Tokenize cue target text into clickable word tokens. */
  tokenize?: CueListTokenize | null;
  panelBlurred?: boolean;
  /** Player Mode mobile (<600px): card-style cues, chrome hidden (header +
   *  study bar/practice options move into the overlay's ⋯ menu). */
  pmMobile?: boolean;
  /** Cue display mode from PLAYER_MODE_CUE_DISPLAY — PM mobile only. */
  cueDisplayMode?: 'list' | 'active';
  /** Session override for cueDisplayMode='active' — render the full list. */
  showAllCues?: boolean;
  /** Actions rendered inside the current cue card (PM mobile). */
  cardActions?: ReactNode;
  /** PM mobile: portal target for the cue-filter fab (lives in the overlay's
   *  anchor rail so it stays put while the panel re-renders). */
  fabPortalTarget?: HTMLElement | null;
  /** One-action sentence capture into the mining queue — adds a save button to
   *  every cue row (spec mining-queue). */
  onSaveCue?: (cue: BilingualCue) => void;
}

type PanelTab = 'subtitles' | 'playlist';

const noop = (): void => undefined;

interface LastGoodResolution {
  readonly cueSetKey: string;
  readonly tokenMap: CueListTokenMap;
}

function SubtitlePanelImpl({
  cues,
  currentTimeMs,
  offsetMs = 0,
  onSeek,
  onClose,
  playlistContent,
  filename,
  activeModeId,
  customModes = [],
  onStudyModeChange,
  practiceMode = 'off',
  onPracticeModeChange,
  isPlaying = false,
  playbackSpeed = 1,
  onPlaybackSpeedChange,
  onPlayPause,
  onReplayCue,
  onContinueCue,
  translationEnabled = true,
  tokenize,
  panelBlurred = false,
  pmMobile = false,
  cueDisplayMode = 'list',
  showAllCues = false,
  cardActions,
  fabPortalTarget,
  onSaveCue,
}: SubtitlePanelProps): React.JSX.Element {
  const hasPlaylist = playlistContent !== undefined;
  const cleanupRulesSetting = useStudyModeStore((s) => s.advanced.cleanupRules);
  const cueLeadInMs = useStudyModeStore((s) => s.advanced.cueLeadInMs);
  useEffect(() => {
    if (!useStudyModeStore.getState().isLoaded) void loadStudyModeState();
  }, []);
  const displayCues = useMemo(() => {
    const rules = resolveCleanupRules(cleanupRulesSetting);
    return cues.map((c) =>
      c.rawTargetText !== undefined
        ? { ...c, targetText: applyCleanupRules(c.rawTargetText, rules) }
        : c,
    );
  }, [cues, cleanupRulesSetting]);
  const visibleCues = useMemo(
    () => displayCues.filter((c) => c.targetText.trim().length > 0 || c.nativeText.trim().length > 0),
    [displayCues],
  );
  const practiceCues = useMemo(
    () => visibleCues.filter((c) => c.targetText.trim().length > 0),
    [visibleCues],
  );
  // Default to 'playlist' when no cues (e.g. local player just opened, no video
  // loaded yet) so the user can pick a video to resume. Otherwise 'subtitles'.
  const [activeTab, setActiveTab] = useState<PanelTab>(
    visibleCues.length > 0 || !hasPlaylist ? 'subtitles' : 'playlist',
  );
  const [mediaStats, setMediaStats] = useState<ComprehensionStats | null>(null);

  const scoreSuppressed = Boolean(tokenize?.langCode && languageMatches('zh', tokenize.langCode));

  const [filterMode, setFilterMode] = useState<CueFilterMode>('all');
  const [lastGood, setLastGood] = useState<LastGoodResolution | null>(null);
  const [studyMenuOpen, setStudyMenuOpen] = useState(false);
  const moreBtnRef = useRef<HTMLButtonElement>(null);

  const cueSetKey = useMemo(() => {
    if (!tokenize || visibleCues.length === 0) return null;
    const first = visibleCues[0];
    const last = visibleCues[visibleCues.length - 1];
    return `${visibleCues.length}:${first.start}:${last.end}:${tokenize.langCode}`;
  }, [visibleCues, tokenize]);

  useEffect(() => {
    let cancelled = false;
    getStorage<Record<string, unknown>>(STORAGE_KEYS.CUE_FILTER_MODE)
      .then((data) => {
        const stored = data[STORAGE_KEYS.CUE_FILTER_MODE];
        if (!cancelled && isCueFilterMode(stored)) setFilterMode(stored);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  const handleFilterModeChange = useCallback((mode: CueFilterMode): void => {
    setFilterMode(mode);
    void setStorage({ [STORAGE_KEYS.CUE_FILTER_MODE]: mode }).catch(() => undefined);
  }, []);

  const handleTokensResolved = useCallback((map: CueListTokenMap, meta: ResolveMeta): void => {
    if (scoreSuppressed || map.size === 0) {
      setMediaStats(null);
    } else {
      const tokens: Token[] = [];
      for (const list of map.values()) tokens.push(...list);
      setMediaStats(computeStats(tokens, 'media'));
    }
    if (meta.resolved && !meta.failed && cueSetKey !== null) {
      setLastGood({
        cueSetKey,
        tokenMap: map,
      });
    }
  }, [scoreSuppressed, cueSetKey]);

  const difficulties = useMemo(() => {
    if (!lastGood || lastGood.cueSetKey !== cueSetKey) return null;
    return cueDifficultyMap(lastGood.tokenMap);
  }, [lastGood, cueSetKey]);

  const cueCounts = useMemo(
    () => (difficulties ? countByMode(difficulties) : null),
    [difficulties],
  );

  const cueFilterAvailable =
    Boolean(tokenize) &&
    !scoreSuppressed &&
    practiceMode === 'off' &&
    !panelBlurred &&
    cueSetKey !== null &&
    !(pmMobile && cueDisplayMode === 'active' && !showAllCues);

  const cueFilterEnabled =
    cueFilterAvailable &&
    difficulties !== null &&
    difficulties.size > 0 &&
    cueCounts !== null;

  const cueFilterFabVisible =
    cueFilterAvailable && (difficulties === null || difficulties.size > 0);

  const cueFilter = useMemo(() => {
    if (!cueFilterEnabled || filterMode === 'all' || !difficulties) return undefined;
    return (cueIndex: number): boolean => {
      const d = difficulties.get(cueIndex);
      return d === undefined ? true : cueMatchesMode(d, filterMode);
    };
  }, [cueFilterEnabled, filterMode, difficulties]);

  const chipLive = Boolean(tokenize) && visibleCues.length > 0 && practiceMode === 'off' && !scoreSuppressed;
  useEffect(() => {
    if (!chipLive) setMediaStats(null);
  }, [chipLive]);

  useEffect(() => {
    const lang = tokenize?.langCode;
    if (!lang) return;
    const apply = (term: string, status: Token['status']): void => {
      setLastGood((prev) =>
        prev === null
          ? prev
          : { ...prev, tokenMap: applyCueListTokenStatus(prev.tokenMap, term, status ?? 'unknown') },
      );
    };
    const offChanged = onWordStatusChanged((detail) => {
      if (detail.langCode === lang) apply(detail.term, detail.status);
    });
    const offRemoved = onWordStatusRemoved((detail) => {
      if (detail.langCode === lang) apply(detail.term, 'unknown');
    });
    return () => {
      offChanged();
      offRemoved();
    };
  }, [tokenize]);

  const showTabs = hasPlaylist;

  const studyModes = useMemo(() => [...PRESETS, ...customModes], [customModes]);
  const resolvedModeId = activeModeId ?? (practiceMode === 'off' ? 'normal' : practiceMode);
  const speedIndex = Math.max(PLAYBACK_SPEEDS.indexOf(playbackSpeed), 0);
  const stepPlaybackSpeed = (delta: number): void => {
    const next = PLAYBACK_SPEEDS[speedIndex + delta];
    if (!onPlaybackSpeedChange || next === undefined) return;
    onPlaybackSpeedChange(next);
  };

  const prevCueCountRef = useRef(visibleCues.length);
  useEffect(() => {
    const hadNone = prevCueCountRef.current === 0;
    prevCueCountRef.current = visibleCues.length;
    if (hadNone && visibleCues.length > 0 && activeTab === 'playlist') {
      setActiveTab('subtitles');
    }
  }, [visibleCues.length, activeTab]);

  const emitCueSeek = (target: BilingualCue): void => {
    markCueSeekIntent(target.index);
    const shifted = { ...target, start: Math.max(0, target.start - (cueLeadInMs ?? 0)) };
    if (onReplayCue) {
      onReplayCue(shifted);
      return;
    }
    onSeek(shifted.start);
  };

  const handlePreviousCue = (cue: BilingualCue): void => {
    const i = practiceCues.findIndex((c) => c.index === cue.index && c.start === cue.start);
    const prev = i > 0 ? practiceCues[i - 1] : undefined;
    if (prev) emitCueSeek(prev);
  };

  const handleReplayCue = (cue: BilingualCue): void => {
    emitCueSeek(cue);
  };

  const handleContinueCue = (cue: BilingualCue): void => {
    const i = practiceCues.findIndex((c) => c.index === cue.index && c.start === cue.start);
    const next = i >= 0 ? practiceCues[i + 1] : undefined;
    if (next) {
      emitCueSeek(next);
      return;
    }
    onContinueCue?.(cue);
  };

  // Empty cue list → EmptyState instead of a blank area (same copy as the
  // side panel). flex:1 fills cueListWrap so content centers vertically.
  const subtitleContent = visibleCues.length > 0 ? (
    practiceMode === 'off' ? (
      <CueList
        cues={visibleCues}
        currentTimeMs={currentTimeMs}
        offsetMs={offsetMs}
        onSeek={onSeek}
        showNative={translationEnabled}
        tokenize={tokenize}
        onTokensResolved={tokenize ? handleTokensResolved : undefined}
        cueFilter={cueFilter}
        filterEpoch={filterMode}
        mobile={pmMobile}
        displayMode={cueDisplayMode}
        showAllCues={showAllCues}
        cardActions={cardActions}
        onSaveCue={onSaveCue}
      />
    ) : (
      <SubtitlePracticeSession
        mode={practiceMode}
        cues={practiceCues}
        currentTimeMs={currentTimeMs}
        offsetMs={offsetMs}
        translationEnabled={translationEnabled}
        isPlaying={isPlaying}
        onSeek={onSeek}
        onPrevious={handlePreviousCue}
        onReplay={handleReplayCue}
        onContinue={handleContinueCue}
        onPlayPause={onPlayPause ?? noop}
        CueListComponent={CueList}
      />
    )
  ) : (
    <EmptyState title={t('panel.empty.title')} size="compact" style={{ flex: 1 }} />
  );

  const showCueFilterStrip =
    cueFilterEnabled && cueCounts !== null && difficulties !== null && filterMode !== 'all';

  const cueFilterStrip = showCueFilterStrip ? (
    <div
      className={styles.cueFilterStrip}
      role="status"
      aria-live="polite"
      data-cell-id="cue-filter-strip"
    >
      <span className={styles.cueFilterStripLabel}>
        {t('cueFilter.indicator.active', [
          cueFilterModeLabel(filterMode),
          cueCounts[filterMode],
          difficulties.size,
        ])}
      </span>
      <button
        type="button"
        className={styles.cueFilterStripReset}
        onClick={() => handleFilterModeChange('all')}
        data-cell-id="cue-filter-reset"
      >
        {t('cueFilter.indicator.showAll')}
      </button>
    </div>
  ) : null;

  const cueFilterOverlay =
    showCueFilterStrip && cueCounts[filterMode] === 0 ? (
      <div className={styles.cueFilterEmpty} data-cell-id="cue-filter-empty">
        <EmptyState
          size="compact"
          title={t('cueFilter.emptyTitle')}
          action={
            <Button
              variant="secondary"
              size="sm"
              onClick={() => handleFilterModeChange('all')}
              data-cell-id="cue-filter-empty-reset"
            >
              {t('cueFilter.emptyAction')}
            </Button>
          }
        />
      </div>
    ) : null;

  const cueFilterFab =
    cueFilterFabVisible ? (
      pmMobile && fabPortalTarget ? (
        createPortal(
          <CueRecommendFab
            mode={filterMode}
            counts={cueCounts}
            onModeChange={handleFilterModeChange}
            variant="neutralSubtle"
            size="md"
            menuContainer={fabPortalTarget.closest('[data-cell-id="player-mode-overlay"]')}
          />,
          fabPortalTarget,
        )
      ) : (
        <CueRecommendFab
          mode={filterMode}
          counts={cueCounts}
          onModeChange={handleFilterModeChange}
          variant="neutralSubtle"
          size="md"
        />
      )
    ) : null;

  return (
    <div
      className={styles.panel}
      data-cell-id="subtitle-panel"
      data-cell-pm-mobile={pmMobile ? 'true' : 'false'}
      data-practice-mode={practiceMode}
      data-has-close={onClose ? 'true' : 'false'}
    >
      {!pmMobile && (
      <div className={styles.header} data-cell-id="subtitle-panel-header">
        {onClose && (
          <Button shape="circle" variant="transparent"
            aria-label={t('subtitle.panel.collapse')}
            title={t('subtitle.panel.collapseTitle')}
            data-cell-id="subtitle-panel-close"
            size="sm"
            onClick={onClose}
          >
            <ChevronRight size={ICON_SIZE_PX} aria-hidden="true" />
          </Button>
        )}
        <span className={styles.title}>{filename ?? t('subtitle.panel.title')}</span>
        {mediaStats && <ComprehensionBadge stats={mediaStats} />}
        {onStudyModeChange && (
          <Button
            ref={moreBtnRef}
            shape="circle"
            variant="transparent"
            size="sm"
            aria-label={t('studyModes.actionBar.aria')}
            aria-haspopup="menu"
            aria-expanded={studyMenuOpen}
            data-cell-id="subtitle-panel-more-btn"
            onClick={() => setStudyMenuOpen((v) => !v)}
          >
            <Icon name="ellipsis" />
          </Button>
        )}
      </div>
      )}
      {!pmMobile && onStudyModeChange ? (
        <Menu
          open={studyMenuOpen}
          onClose={() => setStudyMenuOpen(false)}
          triggerRef={moreBtnRef}
          ariaLabel={t('studyModes.actionBar.aria')}
          align="right"
          data-cell-id="study-mode-action-bar"
        >
          {studyModes.map((mode) => (
            <MenuItem
              key={mode.id}
              radio
              icon={<Icon name={mode.icon} />}
              selected={resolvedModeId === mode.id}
              data-cell-id={`study-mode-${mode.id}`}
              onSelect={() => {
                onStudyModeChange(mode.id);
                setStudyMenuOpen(false);
              }}
            >
              {mode.titleKey ? t(mode.titleKey) : mode.title}
            </MenuItem>
          ))}
          <MenuSeparator />
          <StepperSection
            label={t('studyModes.speed.aria')}
            dataCellId="speed-stepper"
            decreaseLabel={<Icon name="minus" />}
            increaseLabel={<Icon name="plus" />}
            decreaseAriaLabel={t('studyModes.speed.decrease', [String(playbackSpeed)])}
            increaseAriaLabel={t('studyModes.speed.increase', [String(playbackSpeed)])}
            decreaseDisabled={speedIndex <= 0}
            increaseDisabled={speedIndex >= PLAYBACK_SPEEDS.length - 1}
            decreaseDataCellId="speed-dec"
            increaseDataCellId="speed-inc"
            onDecrease={() => stepPlaybackSpeed(-1)}
            onIncrease={() => stepPlaybackSpeed(1)}
          >
            <StepperValue dataCellId="speed-value">{`${playbackSpeed}×`}</StepperValue>
          </StepperSection>
        </Menu>
      ) : !pmMobile && onPracticeModeChange ? (
        <PracticeOptions
          mode={practiceMode}
          playbackSpeed={playbackSpeed}
          onModeChange={onPracticeModeChange}
          onPlaybackSpeedChange={onPlaybackSpeedChange ?? noop}
        />
      ) : null}

      {showTabs ? (
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as PanelTab)}>
          <Tabs.List className={styles.tabList}>
            <Tabs.Trigger value="subtitles" data-cell-id="subtitle-panel-tab-subtitles">
              {t('subtitle.panel.title')}
            </Tabs.Trigger>
            {hasPlaylist && (
              <Tabs.Trigger value="playlist" data-cell-id="subtitle-panel-tab-playlist">
                {t('subtitle.panel.playlist')}
              </Tabs.Trigger>
            )}
          </Tabs.List>

          <Tabs.Content value="subtitles" className={styles.tabContent}>
            <div
              className={styles.cueListWrap}
              data-panel-blurred={panelBlurred ? 'true' : 'false'}
              data-cue-filter={cueFilterFabVisible ? 'true' : 'false'}
            >
              {cueFilterStrip}
              {subtitleContent}
              {cueFilterOverlay}
              {cueFilterFab}
              {panelBlurred && visibleCues.length > 0 && (
                <div
                  className={styles.blurOverlay}
                  data-cell-id="subtitle-panel-blur-overlay"
                  aria-hidden="true"
                />
              )}
            </div>
          </Tabs.Content>

          {hasPlaylist && (
            <Tabs.Content value="playlist" className={styles.tabContent}>
              {playlistContent}
            </Tabs.Content>
          )}
        </Tabs>
      ) : (
        <div
          className={styles.cueListWrap}
          data-panel-blurred={panelBlurred ? 'true' : 'false'}
          data-cue-filter={cueFilterFabVisible ? 'true' : 'false'}
        >
          {cueFilterStrip}
          {subtitleContent}
          {cueFilterOverlay}
          {cueFilterFab}
          {panelBlurred && visibleCues.length > 0 && (
            <div
              className={styles.blurOverlay}
              data-cell-id="subtitle-panel-blur-overlay"
              aria-hidden="true"
            />
          )}
        </div>
      )}
    </div>
  );
}

export const SubtitlePanel = memo(SubtitlePanelImpl);
