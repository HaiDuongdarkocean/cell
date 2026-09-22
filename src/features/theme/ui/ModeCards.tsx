// ModeCards — 3-card radio selector cho Light/Dark/System (ADR-022 D3, spec F4).
//
// a11y: role="radiogroup", mỗi card role="radio", keyboard arrow nav.

import type { KeyboardEvent } from 'react';
import { t, type MessageKey } from '@/shared/i18n';
import { Card, Icon } from '@/shared/ui';
import type { ICON_CATALOG } from '@/shared/icons';
import type { ThemeMode } from '@/entities/theme';
import styles from './ModeCards.module.css';

interface ModeCardsProps {
  /** Currently selected mode. */
  value: ThemeMode;
  /** Called when user selects a mode. */
  onChange: (mode: ThemeMode) => void;
}

const MODES: ReadonlyArray<{ mode: ThemeMode; icon: keyof typeof ICON_CATALOG; label: MessageKey }> = [
  { mode: 'light', icon: 'sun', label: 'theme.mode.light' },
  { mode: 'dark', icon: 'moon', label: 'theme.mode.dark' },
  { mode: 'system', icon: 'settings', label: 'theme.mode.system' },
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
    <div className={styles.cards} role="radiogroup" aria-label={t('theme.mode.aria')} data-cell-id="mode-cards">
      {MODES.map((m) => {
        const selected = m.mode === value;
        return (
          <Card
            key={m.mode}
            variant={selected ? 'selected' : 'interactive'}
            className={styles.card}
            role="radio"
            aria-checked={selected}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(m.mode)}
            onKeyDown={handleKeyDown}
            data-cell-id={`mode-card-${m.mode}`}
          >
            <span className={styles.icon} aria-hidden="true"><Icon name={m.icon} /></span>
            <span className={styles.label}>{t(m.label)}</span>
          </Card>
        );
      })}
    </div>
  );
}
