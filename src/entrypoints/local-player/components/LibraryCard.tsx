import { useState, useMemo } from 'react';
import type { VideoRecord } from '@/features/local-player/services/mediaLibraryRepository';
import type { SubtitleMatch } from '@/features/local-player/logic/subtitleMatch';
import { Icon } from '@/shared/icons/Icon';
import { Button } from '@/shared/ui';
import styles from './LibraryCard.module.css';

/**
 * Format a lastWatchedAt ISO string into a relative label.
 *
 * Compares calendar days (UTC midnight) so "Today"/"Yesterday" are stable
 * regardless of the user's local timezone offset. Returns "Not watched" for
 * null. For dates older than yesterday, returns "N days ago" (N = day diff).
 *
 * Pure function — takes `now` explicitly so it is deterministic in tests.
 */
export function formatLastWatched(
  lastWatchedAt: string | null,
  now: Date,
): string {
  if (lastWatchedAt === null) return 'Not watched';
  const watched = new Date(lastWatchedAt);
  const dayMs = 86_400_000;
  const watchedDay = Date.UTC(
    watched.getUTCFullYear(),
    watched.getUTCMonth(),
    watched.getUTCDate(),
  );
  const nowDay = Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate(),
  );
  const diffDays = Math.round((nowDay - watchedDay) / dayMs);
  if (diffDays <= 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  return `${diffDays} days ago`;
}

/**
 * Compute resume percentage as a rounded integer (0–100).
 * Returns 0 when resumePositionMs is 0 or durationMs is 0.
 */
export function resumePercentValue(video: VideoRecord): number {
  if (video.resumePositionMs <= 0 || video.durationMs <= 0) return 0;
  return Math.round((video.resumePositionMs / video.durationMs) * 100);
}

// ─── Progress ring constants ────────────────────────────────────────────────
const RING_R = 18.25;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_R;

/** Format a SubtitleMatch into a display label: "filename" truncated. */
function subtitleLabel(match: SubtitleMatch): string {
  const basename = match.filename.split('/').pop() ?? match.filename;
  return basename;
}

/** Format language code + tags into a compact suffix: "en" or "en · forced". */
function subtitleLangLabel(match: SubtitleMatch): string {
  const parts: string[] = [];
  if (match.languageCode) parts.push(match.languageCode);
  for (const tag of match.tags) parts.push(tag);
  return parts.join(' · ');
}

interface LibraryCardProps {
  video: VideoRecord;
  isActive: boolean;
  subtitleMatches: readonly SubtitleMatch[];
  selectedTarget: string | null;
  selectedNative: string | null;
  onVideoSelect: (videoId: string) => void;
  onSelectTrack: (match: SubtitleMatch) => void;
  onVideoDelete: (videoId: string) => void;
}

/**
 * LibraryCard — single video entry in the library playlist.
 *
 * Shows a circular progress ring with resume %, title, last-watched label,
 * and an expand button that toggles an accordion containing Target + Native
 * subtitle dropdowns.
 */
export function LibraryCard({
  video,
  isActive,
  subtitleMatches,
  selectedTarget,
  selectedNative,
  onVideoSelect,
  onSelectTrack,
  onVideoDelete,
}: LibraryCardProps): React.JSX.Element {
  const [expanded, setExpanded] = useState(false);
  const [openDropdown, setOpenDropdown] = useState<'target' | 'native' | null>(null);

  const pct = resumePercentValue(video);
  const watchedLabel = formatLastWatched(video.lastWatchedAt, new Date());
  const dashOffset = RING_CIRCUMFERENCE * (1 - pct / 100);

  const targetMatch = useMemo(
    () => subtitleMatches.find((m) => m.filename === selectedTarget) ?? null,
    [subtitleMatches, selectedTarget],
  );
  const nativeMatch = useMemo(
    () => subtitleMatches.find((m) => m.filename === selectedNative) ?? null,
    [subtitleMatches, selectedNative],
  );

  const handleExpandClick = (e: React.MouseEvent): void => {
    e.stopPropagation();
    setExpanded((prev) => !prev);
    setOpenDropdown(null);
  };

  const handleDeleteClick = (e: React.MouseEvent): void => {
    e.stopPropagation();
    onVideoDelete(video.id);
  };

  const handleRowClick = (): void => {
    onVideoSelect(video.id);
  };

  const handleOptionClick = (match: SubtitleMatch, e: React.MouseEvent): void => {
    e.stopPropagation();
    onSelectTrack(match);
    setOpenDropdown(null);
  };

  const toggleDropdown = (which: 'target' | 'native', e: React.MouseEvent): void => {
    e.stopPropagation();
    setOpenDropdown((prev) => (prev === which ? null : which));
  };

  return (
    <div
      className={[styles.item, isActive ? styles.active : '', expanded ? styles.expanded : '']
        .filter(Boolean)
        .join(' ')}
    >
      <div className={styles.row} onClick={handleRowClick} role="button" tabIndex={0}
        data-cell-id="library-card"
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleRowClick(); } }}
      >
        <span className={styles.leading} data-cell-id="library-card-resume" data-pct={pct}>
          <svg className={styles.ring} viewBox="0 0 40 40">
            <circle className={styles.ringTrack} cx="20" cy="20" r={RING_R} />
            <circle
              className={styles.ringProgress}
              cx="20"
              cy="20"
              r={RING_R}
              strokeDasharray={RING_CIRCUMFERENCE}
              strokeDashoffset={dashOffset}
            />
          </svg>
          <span className={styles.pct}>{pct}%</span>
        </span>

        <span className={styles.body}>
          <span className={styles.name} data-cell-id="library-card-title">
            {video.title}
          </span>
          <span className={styles.meta}>
            <span className={styles.metaItem} data-cell-id="library-card-watched">
              {watchedLabel}
            </span>
          </span>
        </span>

        <Button shape="circle" material="solid"
          variant="destructive"
          size="sm"
          aria-label="Delete video"
          onClick={handleDeleteClick}
          data-cell-id="library-card-delete"
          className={styles.deleteBtn}
        >
          <Icon name="trash" size={16} />
        </Button>
        <Button shape="circle" material="solid"
          variant="ghost"
          size="sm"
          aria-expanded={expanded}
          aria-label="Show subtitles"
          onClick={handleExpandClick}
          data-cell-id="library-card-expand"
          className={styles.expandBtn}
        >
          <Icon name="chevronDown" size={16} />
        </Button>
      </div>

      {expanded && (
        <div className={styles.subs} data-cell-id="library-card-subs">
          <div className={styles.subField}>
            <span className={styles.subLabel}>
              <Icon name="captions" size={12} />
              Target
            </span>
            <div className={styles.inlineSelect}>
              <button
                type="button"
                className={styles.selectTrigger}
                aria-expanded={openDropdown === 'target'}
                onClick={(e) => toggleDropdown('target', e)}
                data-cell-id="library-card-subtitle-target"
              >
                <span className={styles.selectValue}>
                  {targetMatch ? subtitleLabel(targetMatch) : (
                    <span className={styles.placeholder}>No matching subtitle</span>
                  )}
                </span>
                <Icon name="chevronDown" size={14} className={styles.selectChev} />
              </button>
              {openDropdown === 'target' && (
                <div className={styles.selectMenu} role="listbox">
                  {subtitleMatches.length === 0 ? (
                    <div className={styles.selectEmpty}>No subtitles matched this video.</div>
                  ) : (
                    subtitleMatches.map((m) => (
                      <button
                        key={m.filename}
                        type="button"
                        className={[
                          styles.selectOption,
                          m.filename === selectedTarget ? styles.selectOptionSelected : '',
                        ].filter(Boolean).join(' ')}
                        role="option"
                        aria-selected={m.filename === selectedTarget}
                        onClick={(e) => handleOptionClick(m, e)}
                        data-cell-id="library-card-subtitle"
                      >
                        <span className={styles.optionName}>{subtitleLabel(m)}</span>
                        <span className={styles.optionLang}>{subtitleLangLabel(m)}</span>
                        {m.filename === selectedTarget && <Icon name="check" size={14} className={styles.optionCheck} />}
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>
          </div>

          <div className={styles.subField}>
            <span className={styles.subLabel}>
              <Icon name="captions" size={12} />
              Native
            </span>
            <div className={styles.inlineSelect}>
              <button
                type="button"
                className={styles.selectTrigger}
                aria-expanded={openDropdown === 'native'}
                onClick={(e) => toggleDropdown('native', e)}
                data-cell-id="library-card-subtitle-native"
              >
                <span className={styles.selectValue}>
                  {nativeMatch ? subtitleLabel(nativeMatch) : (
                    <span className={styles.placeholder}>No matching subtitle</span>
                  )}
                </span>
                <Icon name="chevronDown" size={14} className={styles.selectChev} />
              </button>
              {openDropdown === 'native' && (
                <div className={styles.selectMenu} role="listbox">
                  {subtitleMatches.length === 0 ? (
                    <div className={styles.selectEmpty}>No subtitles matched this video.</div>
                  ) : (
                    subtitleMatches.map((m) => (
                      <button
                        key={m.filename}
                        type="button"
                        className={[
                          styles.selectOption,
                          m.filename === selectedNative ? styles.selectOptionSelected : '',
                        ].filter(Boolean).join(' ')}
                        role="option"
                        aria-selected={m.filename === selectedNative}
                        onClick={(e) => handleOptionClick(m, e)}
                        data-cell-id="library-card-subtitle"
                      >
                        <span className={styles.optionName}>{subtitleLabel(m)}</span>
                        <span className={styles.optionLang}>{subtitleLangLabel(m)}</span>
                        {m.filename === selectedNative && <Icon name="check" size={14} className={styles.optionCheck} />}
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
