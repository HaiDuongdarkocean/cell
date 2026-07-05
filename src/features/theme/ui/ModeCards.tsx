// ModeCards — 3-card radio selector cho Light/Dark/System (ADR-022 D3, spec F4).
//
// a11y: role="radiogroup", mỗi card role="radio", keyboard arrow nav.

import type { KeyboardEvent } from 'react';
import type { ThemeMode } from '@/entities/theme';
import styles from './ModeCards.module.css';

interface ModeCardsProps {
  /** Currently selected mode. */
  value: ThemeMode;
  /** Called when user selects a mode. */
  onChange: (mode: ThemeMode) => void;
}

const MODES: ReadonlyArray<{ mode: ThemeMode; icon: string; label: string }> = [
  { mode: 'light', icon: '☀️', label: 'Light' },
  { mode: 'dark', icon: '🌙', label: 'Dark' },
  { mode: 'system', icon: '🖥️', label: 'System' },
];

export function ModeCards({ value, onChange }: ModeCardsProps): React.JSX.Element {
  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>): void => {
    const idx = MODES.findIndex((m) => m.mode === value);
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      e.preventDefault();
      onChange(MODES[(idx + 1) % MODES.length].mode);
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      e.preventDefault();
      onChange(MODES[(idx - 1 + MODES.length) % MODES.length].mode);
    }
  };

  return (
    <div className={styles.cards} role="radiogroup" aria-label="Theme mode" data-testid="mode-cards">
      {MODES.map((m) => {
        const selected = m.mode === value;
        return (
          <div
            key={m.mode}
            className={`${styles.card} ${selected ? styles.selected : ''}`}
            role="radio"
            aria-checked={selected}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(m.mode)}
            onKeyDown={handleKeyDown}
            data-testid={`mode-card-${m.mode}`}
          >
            <span className={styles.icon} aria-hidden="true">{m.icon}</span>
            <span className={styles.label}>{m.label}</span>
          </div>
        );
      })}
    </div>
  );
}
