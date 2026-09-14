import { useEffect, useRef, useState } from 'react';
import { Button, Icon, Popover } from '@/shared/ui';
import { PLAYBACK_SPEEDS, type PlaybackSpeed } from '@/entities/studyMode/types';
import styles from './SpeedPill.module.css';

export interface SpeedPillProps {
  readonly speed: PlaybackSpeed;
  readonly onChange: (speed: PlaybackSpeed) => void;
}

const SPEEDS: readonly PlaybackSpeed[] = [...PLAYBACK_SPEEDS];

function formatSpeed(speed: PlaybackSpeed): string {
  return `${String(speed)}x`;
}

function speedOptionId(speed: PlaybackSpeed): string {
  return `speed-option-${speed}`;
}

export function SpeedPill({ speed, onChange }: SpeedPillProps): React.JSX.Element {
  const [isOpen, setIsOpen] = useState(false);
  const valueRef = useRef<HTMLButtonElement>(null);

  const decrease = (): void => {
    const index = SPEEDS.indexOf(speed);
    const next = index > 0 ? SPEEDS[index - 1] : SPEEDS[0];
    if (next !== speed) onChange(next);
  };

  const increase = (): void => {
    const index = SPEEDS.indexOf(speed);
    const next = index < SPEEDS.length - 1 ? SPEEDS[index + 1] : SPEEDS[SPEEDS.length - 1];
    if (next !== speed) onChange(next);
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

  const SpeedList = (): React.JSX.Element => (
    <>
      {SPEEDS.map((s) => (
        <Button
          key={s}
          id={speedOptionId(s)}
          size="sm"
          variant={s === speed ? 'primary' : 'secondary'}
          shape="pill"
          ripple={false}
          role="option"
          aria-selected={s === speed}
          className={styles.speedOption}
          data-cell-id={speedOptionId(s)}
          onClick={() => selectSpeed(s)}
        >
          {formatSpeed(s)}
        </Button>
      ))}
    </>
  );

  const value = (
    <Button
      ref={valueRef}
      size="sm"
      variant="transparent"
      shape="pill"
      ripple={false}
      className={styles.value}
      aria-label={`Current playback speed is ${formatSpeed(speed)}. Open speed list.`}
      data-cell-id="speed-value"
      onClick={() => setIsOpen((v) => !v)}
    >
      {formatSpeed(speed)}
    </Button>
  );

  return (
    <div className={styles.pill} data-cell-id="speed-pill">
      <Button
        size="sm"
        variant="secondary"
        shape="circle"
        ripple={false}
        className={styles.stepButton}
        aria-label={`Decrease playback speed from ${formatSpeed(speed)}`}
        data-cell-id="speed-decrease"
        onClick={decrease}
      >
        <Icon name="minus" size="sm" />
      </Button>
      {value}
      <Button
        size="sm"
        variant="secondary"
        shape="circle"
        ripple={false}
        className={styles.stepButton}
        aria-label={`Increase playback speed from ${formatSpeed(speed)}`}
        data-cell-id="speed-increase"
        onClick={increase}
      >
        <Icon name="plus" size="sm" />
      </Button>
      <Popover
        open={isOpen}
        triggerRef={valueRef}
        role="listbox"
        aria-label="Playback speed"
        aria-activedescendant={speedOptionId(speed)}
        className={styles.popover}
      >
        <SpeedList />
      </Popover>
    </div>
  );
}
