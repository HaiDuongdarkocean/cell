import type { KeyboardEvent } from 'react';
import styles from './Timeline.module.css';

interface TimelineProps {
  /** Current playback position in seconds. */
  currentTime: number;
  /** Total media duration in seconds. */
  duration: number;
  /** Buffered ahead of currentTime in seconds (0–duration). */
  buffered: number;
  /** Called with the new currentTime (seconds) after a seek. */
  onSeek: (time: number) => void;
  /** Step in seconds for Arrow keys (no Shift). Default 5. */
  step?: number;
  /** Step in seconds for Shift+Arrow keys. Default 10. */
  shiftStep?: number;
  className?: string;
}

const clamp = (value: number, min: number, max: number): number =>
  Math.min(Math.max(value, min), max);

/**
 * Timeline — domain video atom (atom-design-plan §6.A.2).
 *
 * Controlled seek bar: caller owns `currentTime` and updates it via `onSeek`.
 * Renders a progress track with buffered overlay and a draggable thumb.
 *
 * Accessibility: `role="slider"`, `aria-valuenow`/`aria-valuemin`/`aria-valuemax`,
 * `aria-label="Seek"`. Keyboard: ArrowLeft/ArrowRight seek ±5s,
 * Shift+ArrowLeft/ArrowRight seek ±10s. Click/drag on the track seeks to the
 * proportional position.
 */
export function Timeline({
  currentTime,
  duration,
  buffered,
  onSeek,
  step = 5,
  shiftStep = 10,
  className,
}: TimelineProps): React.JSX.Element {
  const safeDuration = duration > 0 ? duration : 0;
  const pct = safeDuration > 0 ? clamp((currentTime / safeDuration) * 100, 0, 100) : 0;
  const bufferedPct = safeDuration > 0 ? clamp((buffered / safeDuration) * 100, 0, 100) : 0;

  const seekTo = (time: number): void => {
    onSeek(clamp(time, 0, safeDuration));
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>): void => {
    const isShift = e.shiftKey;
    const delta = isShift ? shiftStep : step;

    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      seekTo(currentTime - delta);
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      seekTo(currentTime + delta);
    } else if (e.key === 'Home') {
      e.preventDefault();
      seekTo(0);
    } else if (e.key === 'End') {
      e.preventDefault();
      seekTo(safeDuration);
    }
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>): void => {
    if (safeDuration <= 0) return;
    const el = e.currentTarget;
    el.setPointerCapture(e.pointerId);

    const seekFromEvent = (clientX: number): void => {
      const rect = el.getBoundingClientRect();
      const ratio = clamp((clientX - rect.left) / rect.width, 0, 1);
      seekTo(ratio * safeDuration);
    };

    seekFromEvent(e.clientX);

    const handleMove = (ev: PointerEvent): void => seekFromEvent(ev.clientX);
    const handleUp = (ev: PointerEvent): void => {
      seekFromEvent(ev.clientX);
      el.removeEventListener('pointermove', handleMove);
      el.removeEventListener('pointerup', handleUp);
    };

    el.addEventListener('pointermove', handleMove);
    el.addEventListener('pointerup', handleUp);
  };

  const cls = [styles.timeline, className ?? ''].filter(Boolean).join(' ');

  return (
    <div
      className={cls}
      role="slider"
      aria-label="Seek"
      aria-valuenow={Math.round(currentTime)}
      aria-valuemin={0}
      aria-valuemax={Math.round(safeDuration)}
      tabIndex={0}
      onKeyDown={handleKeyDown}
      onPointerDown={handlePointerDown}
    >
      <div className={styles.track}>
        <div className={styles.buffered} style={{ width: `${bufferedPct}%` }} />
        <div className={styles.progress} style={{ width: `${pct}%` }} />
        <div className={styles.thumb} style={{ left: `${pct}%` }} />
      </div>
    </div>
  );
}
