import { useEffect, useRef, useState } from 'react';
import { HStack, Button, Icon } from '@/shared/ui';
import { PRESETS } from '@/entities/studyMode/constants';
import type { StudyMode } from '@/entities/studyMode';
import type { PlaybackSpeed } from '@/entities/studyMode/types';
import { SpeedPill } from './SpeedPill';
import styles from './StudyModeActionBar.module.css';

export interface StudyModeActionBarProps {
  readonly activeModeId: string;
  readonly customModes: readonly StudyMode[];
  readonly playbackSpeed: PlaybackSpeed;
  readonly onModeChange: (modeId: string) => void;
  readonly onSpeedChange: (speed: PlaybackSpeed) => void;
}

export function StudyModeActionBar({
  activeModeId,
  customModes,
  playbackSpeed,
  onModeChange,
  onSpeedChange,
}: StudyModeActionBarProps): React.JSX.Element {
  const modes = [...PRESETS, ...customModes];
  const scrollRef = useRef<HTMLDivElement>(null);
  const [showLeft, setShowLeft] = useState(false);
  const [showRight, setShowRight] = useState(false);

  const updateOverflow = (): void => {
    const el = scrollRef.current;
    if (!el) return;
    setShowLeft(el.scrollLeft > 0);
    setShowRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 1);
  };

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    updateOverflow();
    const observer = new ResizeObserver(updateOverflow);
    observer.observe(el);
    el.addEventListener('scroll', updateOverflow, { passive: true });
    return () => {
      observer.disconnect();
      el.removeEventListener('scroll', updateOverflow);
    };
  }, [modes.length]);

  const scrollBy = (direction: -1 | 1): void => {
    const el = scrollRef.current;
    if (!el) return;
    const amount = direction * (el.clientWidth * 0.75);
    el.scrollBy({ left: amount, behavior: 'smooth' });
  };

  return (
    <HStack align="center" className={styles.actionBar} data-cell-id="study-mode-action-bar" gap="1">
      <SpeedPill speed={playbackSpeed} onChange={onSpeedChange} />
      <div className={styles.scrollWrap}>
        {showLeft && (
          <Button
            size="sm"
            shape="circle"
            variant="overlay"
            ripple={false}
            className={styles.arrowLeft}
            aria-label="Scroll study modes left"
            data-cell-id="study-mode-scroll-left"
            onClick={() => scrollBy(-1)}
          >
            <Icon name="chevronLeft" size="sm" />
          </Button>
        )}
        {showRight && (
          <Button
            size="sm"
            shape="circle"
            variant="overlay"
            ripple={false}
            className={styles.arrowRight}
            aria-label="Scroll study modes right"
            data-cell-id="study-mode-scroll-right"
            onClick={() => scrollBy(1)}
          >
            <Icon name="chevronRight" size="sm" />
          </Button>
        )}
        <div
          ref={scrollRef}
          className={styles.scrollTrack}
          data-cell-id="study-mode-scroll-track"
          role="tablist"
          aria-label="Study modes"
        >
          {modes.map((mode) => (
            <Button
              key={mode.id}
              size="sm"
              shape="circle"
              variant={activeModeId === mode.id ? 'primary' : 'secondary'}
              active={activeModeId === mode.id}
              ripple={false}
              aria-label={mode.title}
              aria-selected={activeModeId === mode.id}
              role="tab"
              className={styles.modeButton}
              data-cell-id={`study-mode-${mode.id}`}
              onClick={() => onModeChange(mode.id)}
            >
              <Icon name={mode.icon} size="md" />
            </Button>
          ))}
        </div>
      </div>
    </HStack>
  );
}
