import { useEffect, useRef, useState } from 'react';
import { Icon } from '@/shared/icons/Icon';
import styles from './PlaybackSpeedControl.module.css';

interface PlaybackSpeedControlProps {
  /** Current playback speed (controlled). */
  currentSpeed: number;
  /** Called with the new speed when the user picks one from the dropdown. */
  onSpeedChange: (speed: number) => void;
  /** Disable the control (greyed out, no interaction). */
  disabled?: boolean;
  className?: string;
}

/** YouTube-style speed ladder. */
const SPEEDS = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2] as const;

/** Format a speed value as a compact label, e.g. 1 → "1x", 1.5 → "1.5x". */
function speedLabel(speed: number): string {
  return `${speed}x`;
}

/**
 * PlaybackSpeedControl — domain video atom (atom-design-plan §6.A.5).
 *
 * Controlled dropdown: caller owns `currentSpeed` and updates it via
 * `onSpeedChange`. Button shows the current speed (e.g. "1x", "1.5x") with a
 * gauge icon; clicking opens a YouTube-style speed menu.
 *
 * Accessibility: button has `aria-haspopup="menu"` + `aria-expanded`. The menu
 * uses `role="menu"` with `menuitemradio` items, the active speed marked
 * `aria-checked`. Escape closes; click-outside closes.
 */
export function PlaybackSpeedControl({
  currentSpeed,
  onSpeedChange,
  disabled = false,
  className,
}: PlaybackSpeedControlProps): React.JSX.Element {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close on click outside.
  useEffect(() => {
    if (!open) return;
    const handlePointerDown = (e: MouseEvent): void => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, [open]);

  const toggle = (): void => {
    if (disabled) return;
    setOpen((prev) => !prev);
  };

  const handlePick = (speed: number): void => {
    onSpeedChange(speed);
    setOpen(false);
  };

  const handleMenuKeyDown = (e: React.KeyboardEvent<HTMLUListElement>): void => {
    if (e.key === 'Escape') {
      e.preventDefault();
      setOpen(false);
    }
  };

  const cls = [styles.container, className ?? ''].filter(Boolean).join(' ');
  const label = speedLabel(currentSpeed);

  return (
    <div className={cls} ref={containerRef}>
      <button
        type="button"
        className={styles.button}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Playback speed ${label}`}
        disabled={disabled}
        onClick={toggle}
      >
        <Icon name="gauge" className={styles.icon} />
        <span className={styles.label}>{label}</span>
      </button>
      {open && (
        <ul className={styles.menu} role="menu" onKeyDown={handleMenuKeyDown}>
          {SPEEDS.map((speed) => {
            const itemLabel = speedLabel(speed);
            const isActive = speed === currentSpeed;
            return (
              <li key={speed} role="none">
                <button
                  type="button"
                  role="menuitemradio"
                  aria-checked={isActive}
                  className={isActive ? styles.itemActive : styles.item}
                  onClick={() => handlePick(speed)}
                >
                  {itemLabel}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
