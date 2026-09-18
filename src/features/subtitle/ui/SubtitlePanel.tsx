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
import type { ReactNode } from 'react';
import type { BilingualCue } from '@/entities/media';
import type { PlaybackSpeed } from '@/entities/studyMode/types';
import type { StudyMode } from '@/entities/studyMode';
import type { ComprehensionStats } from '@/entities/comprehension';



import { computeStats, ComprehensionBadge, applyCueListTokenStatus, type Token, type CueListTokenMap, type ResolveMeta, type FrequencyBandThresholds } from '@/features/tokenize';
import { onWordStatusChanged, onWordStatusRemoved } from '@/features/dictionary';
import { buildPrimerList } from '@/features/subtitle/logic/primerList';
import { PrimerTab } from './PrimerTab';
import { languageMatches } from '@/shared/config/languageRegistry';
import { CueList, type CueListTokenize } from './CueList';
import { PracticeOptions, SubtitlePracticeSession } from '@/features/studyModes/ui/SubtitlePractice';
import { StudyModeActionBar } from '@/features/studyModes/ui/StudyModeActionBar';
import type { SubtitlePracticeMode } from '@/features/studyModes/lib/subtitlePractice';
import {
  countByMode,
  cueDifficultyMap,
  cueMatchesMode,
  isCueFilterMode,
  type CueFilterMode,
} from '@/features/subtitle/logic/cueDifficulty';
import { CueRecommendFab, cueFilterModeLabel } from './CueRecommendFab';
import { STORAGE_KEYS } from '@/shared/config/config';
import { getStorage, setStorage } from '@/shared/lib/chrome-apis';
import { t } from '@/shared/i18n';
import { ChevronRight } from 'lucide-react';

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
}

type PanelTab = 'subtitles' | 'playlist' | 'words';

const noop = (): void => undefined;

interface LastGoodResolution {
  readonly cueSetKey: string;
  readonly tokenMap: CueListTokenMap;
  readonly rankByTerm: ReadonlyMap<string, number | null>;
  readonly thresholds: FrequencyBandThresholds;
  readonly freqUnfiltered: boolean;
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
  onPreviousCue,
  onReplayCue,
  onContinueCue,
  translationEnabled = true,
  tokenize,
  panelBlurred = false,
}: SubtitlePanelProps): React.JSX.Element {
  const hasPlaylist = playlistContent !== undefined;
  const showTabs = hasPlaylist || Boolean(tokenize);
  const visibleCues = useMemo(
    () => cues.filter((c) => c.targetText.trim().length > 0 || c.nativeText.trim().length > 0),
    [cues],
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
        rankByTerm: meta.rankByTerm,
        thresholds: meta.thresholds,
        freqUnfiltered: meta.freqUnfiltered,
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

  const cueFilterEnabled =
    Boolean(tokenize) &&
    !scoreSuppressed &&
    practiceMode === 'off' &&
    !panelBlurred &&
    difficulties !== null &&
    difficulties.size > 0 &&
    cueCounts !== null;

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

  const primerAvailable =
    Boolean(tokenize) &&
    !scoreSuppressed &&
    !panelBlurred &&
    practiceMode === 'off' &&
    lastGood !== null &&
    lastGood.cueSetKey === cueSetKey;

  const primerRows = useMemo(
    () =>
      primerAvailable && lastGood !== null
        ? buildPrimerList(lastGood.tokenMap, lastGood.rankByTerm, visibleCues)
        : null,
    [primerAvailable, lastGood, visibleCues],
  );

  useEffect(() => {
    if (activeTab === 'words' && !primerAvailable) setActiveTab('subtitles');
  }, [activeTab, primerAvailable]);

  const prevCueCountRef = useRef(visibleCues.length);
  useEffect(() => {
    const hadNone = prevCueCountRef.current === 0;
    prevCueCountRef.current = visibleCues.length;
    if (hadNone && visibleCues.length > 0 && activeTab === 'playlist') {
      setActiveTab('subtitles');
    }
  }, [visibleCues.length, activeTab]);

  const handlePreviousCue = (cue: BilingualCue): void => {
    if (onPreviousCue) {
      onPreviousCue(cue);
      return;
    }
    const i = visibleCues.findIndex((c) => c.index === cue.index && c.start === cue.start);
    if (i > 0) onSeek(visibleCues[i - 1].start);
  };

  const handleReplayCue = (cue: BilingualCue): void => {
    if (onReplayCue) {
      onReplayCue(cue);
      return;
    }
    onSeek(cue.start);
  };

  const handleContinueCue = (cue: BilingualCue): void => {
    if (onContinueCue) {
      onContinueCue(cue);
      return;
    }
    const i = visibleCues.findIndex((c) => c.index === cue.index && c.start === cue.start);
    const next = i >= 0 ? visibleCues[i + 1] : undefined;
    if (next) onSeek(next.start);
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
        cueDifficulty={cueFilterEnabled ? difficulties ?? undefined : undefined}
      />
    ) : (
      <SubtitlePracticeSession
        mode={practiceMode}
        cues={visibleCues}
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
    <EmptyState title="No subtitles loaded" size="compact" style={{ flex: 1 }} />
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
    cueFilterEnabled && cueCounts !== null ? (
      <CueRecommendFab
        mode={filterMode}
        counts={cueCounts}
        onModeChange={handleFilterModeChange}
      />
    ) : null;

  return (
    <div
      className={styles.panel}
      data-cell-id="subtitle-panel"
      data-practice-mode={practiceMode}
      data-has-close={onClose ? 'true' : 'false'}
    >
      <div className={styles.header} data-cell-id="subtitle-panel-header">
        {onClose && (
          <Button shape="circle" variant="transparent"
            aria-label="Collapse subtitle list"
            title="Collapse (T)"
            data-cell-id="subtitle-panel-close"
            size="sm"
            onClick={onClose}
          >
            <ChevronRight aria-hidden="true" />
          </Button>
        )}
        <span className={styles.title}>{filename ?? 'Subtitles'}</span>
        {mediaStats && <ComprehensionBadge stats={mediaStats} />}
      </div>
      {onStudyModeChange ? (
        <StudyModeActionBar
          activeModeId={activeModeId ?? (practiceMode === 'off' ? 'normal' : practiceMode)}
          customModes={customModes}
          playbackSpeed={playbackSpeed}
          onModeChange={onStudyModeChange}
          onSpeedChange={onPlaybackSpeedChange ?? noop}
        />
      ) : onPracticeModeChange ? (
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
              Subtitles
            </Tabs.Trigger>
            {hasPlaylist && (
              <Tabs.Trigger value="playlist" data-cell-id="subtitle-panel-tab-playlist">
                Playlist
              </Tabs.Trigger>
            )}
            {primerAvailable && primerRows !== null && (
              <Tabs.Trigger value="words" data-cell-id="subtitle-panel-tab-words">
                {t('primer.tab')} · {primerRows.length}
              </Tabs.Trigger>
            )}
          </Tabs.List>

          <Tabs.Content value="subtitles" className={styles.tabContent}>
            <div
              className={styles.cueListWrap}
              data-panel-blurred={panelBlurred ? 'true' : 'false'}
              data-cue-filter={cueFilterEnabled ? 'true' : 'false'}
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

          {primerAvailable && primerRows !== null && tokenize && (
            <Tabs.Content value="words" className={styles.tabContent}>
              <PrimerTab
                rows={primerRows}
                onTokenClick={tokenize.onTokenClick}
                onSeek={onSeek}
              />
            </Tabs.Content>
          )}
        </Tabs>
      ) : (
        <div
          className={styles.cueListWrap}
          data-panel-blurred={panelBlurred ? 'true' : 'false'}
          data-cue-filter={cueFilterEnabled ? 'true' : 'false'}
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
