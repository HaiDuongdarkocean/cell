import { useEffect, useRef, useState } from 'react';
import { t } from '@/shared/i18n';
import { Button, Icon, ListItem, Popover, pushEscapeLayer } from '@/shared/ui';
import { PLAYBACK_SPEEDS, type PlaybackSpeed } from '@/entities/studyMode/types';
import styles from './SpeedPill.module.css';

export interface SpeedPillProps {
  readonly speed: PlaybackSpeed;
  readonly onChange: (speed: PlaybackSpeed) => void;
}

const SPEEDS: readonly PlaybackSpeed[] = [...PLAYBACK_SPEEDS];
const MENU_MAX_HEIGHT = 292;

function formatSpeed(speed: PlaybackSpeed): string {
  return `${String(speed)}x`;
}

function speedOptionId(speed: PlaybackSpeed): string {
  return `speed-option-${speed}`;
}

export function SpeedPill({ speed, onChange }: SpeedPillProps): React.JSX.Element {
  const [isOpen, setIsOpen] = useState(false);
  const valueRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

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
    const doc = valueRef.current?.ownerDocument ?? document;
    const win = doc.defaultView ?? window;
    const rootNode = valueRef.current?.getRootNode();
    const scope: Document | ShadowRoot = rootNode instanceof ShadowRoot ? rootNode : doc;
    const onPointerDown = (e: Event): void => {
      const path = e.composedPath();
      if (!path.includes(valueRef.current as Node) && !path.includes(menuRef.current as Node)) {
        setIsOpen(false);
      }
    };
    const onScroll = (): void => setIsOpen(false);
    const popEscape = pushEscapeLayer((e) => {
      e.preventDefault();
      setIsOpen(false);
      valueRef.current?.focus();
    }, doc);
    doc.addEventListener('mousedown', onPointerDown);
    win.addEventListener('scroll', onScroll, true);
    // scroll is non-composed — it never crosses the shadow boundary.
    if (scope !== doc) scope.addEventListener('scroll', onScroll, true);
    return () => {
      popEscape();
      doc.removeEventListener('mousedown', onPointerDown);
      win.removeEventListener('scroll', onScroll, true);
      if (scope !== doc) scope.removeEventListener('scroll', onScroll, true);
    };
  }, [isOpen]);

  const SpeedList = (): React.JSX.Element => (
    <div className={styles.speedList} data-cell-id="speed-list" data-no-lookup role="presentation">
      {SPEEDS.map((s) => (
        <ListItem
          key={s}
          id={speedOptionId(s)}
          role="option"
          aria-selected={s === speed}
          active={s === speed}
          className={styles.speedItem}
          data-cell-id={speedOptionId(s)}
          trailing={s === speed ? <Icon name="check" size="sm" /> : undefined}
          onClick={() => selectSpeed(s)}
        >
          {formatSpeed(s)}
        </ListItem>
      ))}
    </div>
  );

  const value = (
    <Button
      ref={valueRef}
      size="sm"
      variant="transparent"
      shape="pill"
      ripple={false}
      className={styles.value}
      aria-label={t('studyModes.speed.current', [formatSpeed(speed)])}
      data-cell-id="speed-value"
      onClick={() => setIsOpen((v) => !v)}
    >
      {formatSpeed(speed)}
    </Button>
  );

  return (
    <div className={styles.pill} data-cell-id="speed-pill" data-no-lookup>
      <Button
        size="sm"
        variant="secondary"
        shape="circle"
        ripple={false}
        className={styles.stepButton}
        aria-label={t('studyModes.speed.decrease', [formatSpeed(speed)])}
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
        aria-label={t('studyModes.speed.increase', [formatSpeed(speed)])}
        data-cell-id="speed-increase"
        onClick={increase}
      >
        <Icon name="plus" size="sm" />
      </Button>
      <Popover
        open={isOpen}
        triggerRef={valueRef}
        contentRef={menuRef}
        role="listbox"
        aria-label={t('studyModes.speed.aria')}
        aria-activedescendant={speedOptionId(speed)}
        className={styles.popover}
        menuMaxHeight={MENU_MAX_HEIGHT}
      >
        <SpeedList />
      </Popover>
    </div>
  );
}
