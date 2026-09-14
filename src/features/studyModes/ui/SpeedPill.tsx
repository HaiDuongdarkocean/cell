import { useEffect, useRef, useState } from 'react';
import { Button, Icon, Portal } from '@/shared/ui';
import type { PlaybackSpeed } from '@/entities/studyMode/types';
import styles from './SpeedPill.module.css';

export interface SpeedPillProps {
  readonly speed: PlaybackSpeed;
  readonly onChange: (speed: PlaybackSpeed) => void;
  readonly compact?: boolean;
}

const SPEEDS: readonly PlaybackSpeed[] = [0.5, 0.75, 1, 1.25, 1.5];

function nextSpeed(current: PlaybackSpeed, direction: 1 | -1): PlaybackSpeed {
  const index = SPEEDS.indexOf(current);
  const next = index + direction;
  if (next < 0) return SPEEDS[0];
  if (next >= SPEEDS.length) return SPEEDS[SPEEDS.length - 1];
  return SPEEDS[next];
}

export function SpeedPill({ speed, onChange, compact = false }: SpeedPillProps): React.JSX.Element {
  const [isOpen, setIsOpen] = useState(false);
  const valueRef = useRef<HTMLButtonElement>(null);
  const [position, setPosition] = useState<{ left: number; top: number } | null>(null);

  const openList = (): void => {
    const rect = valueRef.current?.getBoundingClientRect();
    if (rect) {
      setPosition({
        left: rect.left + window.scrollX,
        top: rect.bottom + window.scrollY,
      });
    }
    setIsOpen(true);
  };

  const selectSpeed = (next: PlaybackSpeed): void => {
    setIsOpen(false);
    if (next !== speed) onChange(next);
  };

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') setIsOpen(false);
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [isOpen]);

  if (compact) {
    return (
      <>
        <Button
          ref={valueRef}
          size="sm"
          variant="secondary"
          shape="circle"
          ripple={false}
          className={styles.speedCircle}
          aria-label={`Playback speed is ${speed}x. Open speed list.`}
          data-cell-id="speed-value-circle"
          onClick={openList}
        >
          {speed}x
        </Button>
        {isOpen && position && (
          <Portal>
            <div
              className={styles.popover}
              style={{ left: position.left, top: position.top }}
              role="listbox"
              aria-label="Playback speed"
            >
              {SPEEDS.map((s) => (
                <Button
                  key={s}
                  size="sm"
                  variant={s === speed ? 'primary' : 'secondary'}
                  shape="pill"
                  ripple={false}
                  role="option"
                  aria-selected={s === speed}
                  className={styles.speedOption}
                  data-cell-id={`speed-option-${s}`}
                  onClick={() => selectSpeed(s)}
                >
                  {s}x
                </Button>
              ))}
            </div>
          </Portal>
        )}
      </>
    );
  }

  return (
    <div className={styles.pill} data-cell-id="speed-pill">
      <Button
        size="sm"
        variant="secondary"
        shape="circle"
        ripple={false}
        className={styles.stepButton}
        aria-label={`Decrease playback speed from ${speed}x`}
        data-cell-id="speed-decrease"
        onClick={() => onChange(nextSpeed(speed, -1))}
      >
        <Icon name="minus" size="sm" />
      </Button>
      <Button
        ref={valueRef}
        size="sm"
        variant="transparent"
        shape="pill"
        ripple={false}
        className={styles.value}
        aria-label={`Current playback speed is ${speed}x. Open speed list.`}
        data-cell-id="speed-value"
        onClick={openList}
      >
        {speed}x
      </Button>
      <Button
        size="sm"
        variant="secondary"
        shape="circle"
        ripple={false}
        className={styles.stepButton}
        aria-label={`Increase playback speed from ${speed}x`}
        data-cell-id="speed-increase"
        onClick={() => onChange(nextSpeed(speed, 1))}
      >
        <Icon name="plus" size="sm" />
      </Button>
      {isOpen && position && (
        <Portal>
          <div
            className={styles.popover}
            style={{ left: position.left, top: position.top }}
            role="listbox"
            aria-label="Playback speed"
          >
            {SPEEDS.map((s) => (
              <Button
                key={s}
                size="sm"
                variant={s === speed ? 'primary' : 'secondary'}
                shape="pill"
                ripple={false}
                role="option"
                aria-selected={s === speed}
                className={styles.speedOption}
                data-cell-id={`speed-option-${s}`}
                onClick={() => selectSpeed(s)}
              >
                {s}x
              </Button>
            ))}
          </div>
        </Portal>
      )}
    </div>
  );
}
