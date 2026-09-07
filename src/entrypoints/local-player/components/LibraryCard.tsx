import { useState, useMemo } from 'react';
import type { VideoRecord } from '@/features/local-player/services/mediaLibraryRepository';
import type { SubtitleMatch } from '@/features/local-player/logic/subtitleMatch';
import { Icon } from '@/shared/ui/Icon';
import { Button, Select } from '@/shared/ui';
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

  const pct = resumePercentValue(video);
  const watchedLabel = formatLastWatched(video.lastWatchedAt, new Date());
  const dashOffset = RING_CIRCUMFERENCE * (1 - pct / 100);

  const subtitleOptions = useMemo(
    () =>
      subtitleMatches.map((m) => {
        const lang = subtitleLangLabel(m);
        return { value: m.filename, label: lang ? `${subtitleLabel(m)} · ${lang}` : subtitleLabel(m) };
      }),
    [subtitleMatches],
  );

  const handleExpandClick = (e: React.MouseEvent): void => {
    e.stopPropagation();
    setExpanded((prev) => !prev);
  };

  const handleDeleteClick = (e: React.MouseEvent): void => {
    e.stopPropagation();
    onVideoDelete(video.id);
  };

  const handleRowClick = (): void => {
    onVideoSelect(video.id);
  };

  const handleSelectTrack = (filename: string): void => {
    const match = subtitleMatches.find((m) => m.filename === filename);
    if (match) onSelectTrack(match);
  };

  return (
    <div
      className={[styles.item, isActive ? styles.active : '', expanded ? styles.expanded : '']
        .filter(Boolean)
        .join(' ')}
      role="listitem"
    >
      <div className={styles.row} onClick={handleRowClick} role="button" tabIndex={0}
        aria-pressed={isActive}
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

        <Button shape="circle"
          variant="destructive"
          size="sm"
          aria-label="Delete video"
          onClick={handleDeleteClick}
          data-cell-id="library-card-delete"
          className={styles.deleteBtn}
        >
          <Icon name="trash" size="xs" />
        </Button>
        <Button shape="circle"
          variant="ghost"
          size="sm"
          aria-expanded={expanded}
          aria-label="Show subtitles"
          onClick={handleExpandClick}
          data-cell-id="library-card-expand"
          className={styles.expandBtn}
        >
          <Icon name="chevronDown" size="xs" />
        </Button>
      </div>

      {expanded && (
        <div className={styles.subs} data-cell-id="library-card-subs">
          <div className={styles.subField}>
            <span className={styles.subLabel}>
              <Icon name="captions" size="xs" />
              Target
            </span>
            <Select
              size="sm"
              options={subtitleOptions}
              value={selectedTarget ?? undefined}
              placeholder="No matching subtitle"
              onChange={handleSelectTrack}
              aria-label="Target subtitle"
              data-cell-id="library-card-subtitle-target"
            />
          </div>

          <div className={styles.subField}>
            <span className={styles.subLabel}>
              <Icon name="captions" size="xs" />
              Native
            </span>
            <Select
              size="sm"
              options={subtitleOptions}
              value={selectedNative ?? undefined}
              placeholder="No matching subtitle"
              onChange={handleSelectTrack}
              aria-label="Native subtitle"
              data-cell-id="library-card-subtitle-native"
            />
          </div>
        </div>
      )}
    </div>
  );
}
