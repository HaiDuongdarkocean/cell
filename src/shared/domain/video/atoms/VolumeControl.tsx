import type { KeyboardEvent } from 'react';
import { Icon } from '@/shared/icons/Icon';
import styles from './VolumeControl.module.css';

interface VolumeControlProps {
  /** Volume level 0–1. */
  volume: number;
  /** Muted state (controlled). */
  muted: boolean;
  /** Called with new volume (0–1) when user drags the slider. */
  onVolumeChange: (volume: number) => void;
  /** Called when user clicks the mute toggle. */
  onMuteToggle: () => void;
  className?: string;
}

const clamp01 = (v: number): number => Math.min(Math.max(v, 0), 1);

/** Pick volume icon based on effective volume (0 when muted). */
function volumeIconName(effective: number): 'volumeHigh' | 'volumeLow' | 'volumeMute' {
  if (effective <= 0) return 'volumeMute';
  if (effective < 0.5) return 'volumeLow';
  return 'volumeHigh';
}

/**
 * VolumeControl — domain video atom (atom-design-plan §6.A.4).
 *
 * Composite atom: mute toggle button + horizontal volume slider.
 * Caller owns `volume` and `muted` state.
 *
 * Accessibility: the slider region has `role="slider"` with
 * `aria-valuenow`/`aria-valuemin`/`aria-valuemax`/`aria-label`. The mute button
 * has a dynamic `aria-label` ("Mute"/"Unmute") and `aria-pressed`. Keyboard:
 * ArrowLeft/ArrowDown −0.1, ArrowRight/ArrowUp +0.1 on the slider.
 */
export function VolumeControl({
  volume,
  muted,
  onVolumeChange,
  onMuteToggle,
  className,
}: VolumeControlProps): React.JSX.Element {
  const effective = muted ? 0 : volume;
  const pct = clamp01(effective) * 100;
  const iconName = volumeIconName(effective);
  const muteLabel = muted ? 'Unmute' : 'Mute';

  const setVolume = (v: number): void => {
    onVolumeChange(clamp01(v));
  };

  const handleSliderKeyDown = (e: KeyboardEvent<HTMLDivElement>): void => {
    if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
      e.preventDefault();
      setVolume(volume - 0.1);
    } else if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
      e.preventDefault();
      setVolume(volume + 0.1);
    } else if (e.key === 'Home') {
      e.preventDefault();
      setVolume(0);
    } else if (e.key === 'End') {
      e.preventDefault();
      setVolume(1);
    }
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>): void => {
    const el = e.currentTarget;
    el.setPointerCapture(e.pointerId);

    const seekFromEvent = (clientX: number): void => {
      const rect = el.getBoundingClientRect();
      const ratio = clamp01((clientX - rect.left) / rect.width);
      onVolumeChange(ratio);
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

  const cls = [styles.container, className ?? ''].filter(Boolean).join(' ');

  return (
    <div className={cls}>
      <button
        type="button"
        className={styles.muteBtn}
        aria-label={muteLabel}
        aria-pressed={muted}
        onClick={onMuteToggle}
      >
        <Icon name={iconName} size={24} className={styles.icon} />
      </button>
      <div
        className={styles.slider}
        role="slider"
        aria-label="Volume"
        aria-valuenow={Math.round(effective * 100)}
        aria-valuemin={0}
        aria-valuemax={100}
        tabIndex={0}
        onKeyDown={handleSliderKeyDown}
        onPointerDown={handlePointerDown}
      >
        <div className={styles.track}>
          <div className={styles.fill} style={{ width: `${pct}%` }} />
          <div className={styles.thumb} style={{ left: `${pct}%` }} />
        </div>
      </div>
    </div>
  );
}
