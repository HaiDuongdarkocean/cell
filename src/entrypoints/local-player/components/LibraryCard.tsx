import type { VideoRecord } from '@/features/local-player/services/mediaLibraryRepository';
import { Icon } from '@/shared/icons/Icon';
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
 * Compute resume percentage as a rounded integer string (e.g. "41%").
 * Returns null when resumePositionMs is 0 or durationMs is 0 (no resume to show).
 */
export function resumePercent(video: VideoRecord): string | null {
  if (video.resumePositionMs <= 0 || video.durationMs <= 0) return null;
  const pct = Math.round((video.resumePositionMs / video.durationMs) * 100);
  return `${pct}%`;
}

interface LibraryCardProps {
  video: VideoRecord;
  onClick: () => void;
}

/**
 * LibraryCard — single video entry in the library list.
 *
 * Shows title, resume % badge (when partially watched), and last-watched
 * relative date. Clickable — calls onClick (wired by LibraryView to
 * onVideoSelect).
 */
export function LibraryCard({ video, onClick }: LibraryCardProps): React.JSX.Element {
  const resume = resumePercent(video);
  const watchedLabel = formatLastWatched(video.lastWatchedAt, new Date());

  return (
    <button
      type="button"
      className={styles.card}
      data-cell-id="library-card"
      onClick={onClick}
    >
      <span className={styles.title} data-cell-id="library-card-title">
        {video.title}
      </span>
      <span className={styles.meta}>
        {resume !== null && (
          <span className={styles.resume} data-cell-id="library-card-resume">
            <Icon name="play" size={12} className={styles.metaIcon} />
            {resume}
          </span>
        )}
        {video.hasSubtitle && (
          <span className={styles.metaItem} data-cell-id="library-card-subtitle" title="Subtitle matched">
            <Icon name="captions" size={12} className={styles.metaIcon} />
            Sub
          </span>
        )}
        <span className={styles.metaItem} data-cell-id="library-card-watched">
          <Icon name="clock" size={12} className={styles.metaIcon} />
          {watchedLabel}
        </span>
      </span>
    </button>
  );
}
