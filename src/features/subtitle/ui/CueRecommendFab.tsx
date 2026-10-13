import { useCallback, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';
import { Button } from '@/shared/ui/Button';
import { Menu, MenuItem } from '@/shared/ui/Menu';
import { Icon } from '@/shared/icons/Icon';
import { t, type MessageKey } from '@/shared/i18n';
import {
  CUE_FILTER_MODES,
  type CueFilterMode,
} from '@/features/subtitle/logic/cueDifficulty';
import styles from './CueRecommendFab.module.css';

const MODE_LABEL_KEY: Record<CueFilterMode, MessageKey> = {
  all: 'cueFilter.mode.all',
  i1: 'cueFilter.mode.i1',
  hasUnknown: 'cueFilter.mode.hasUnknown',
  allKnown: 'cueFilter.mode.allKnown',
  tracking: 'cueFilter.mode.tracking',
};

export function cueFilterModeLabel(mode: CueFilterMode): string {
  return t(MODE_LABEL_KEY[mode]);
}

export interface CueRecommendFabProps {
  readonly mode: CueFilterMode;
  readonly counts: Readonly<Record<CueFilterMode, number>> | null;
  readonly onModeChange: (mode: CueFilterMode) => void;
  /** Button variant — default keeps the surface (secondary/primary) pairing. */
  readonly variant?: 'secondary' | 'neutralSubtle';
  /** Button size — default lg FAB. PM mobile rail uses md. */
  readonly size?: 'md' | 'lg';
  /** Portal target for the filter menu — needed when the fab is portaled into
   *  a high z-index surface (PM mobile rail) so the menu stays on top. */
  readonly menuContainer?: Element | null;
}

export function CueRecommendFab({
  mode,
  counts,
  onModeChange,
  variant,
  size = 'lg',
  menuContainer,
}: CueRecommendFabProps): React.JSX.Element {
  const [isOpen, setIsOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const i1Count = counts?.i1 ?? 0;
  const badgeText = counts === null ? '…' : i1Count > 99 ? '99+' : String(i1Count);

  const closeMenu = useCallback((restoreFocus = false): void => {
    setIsOpen(false);
    if (restoreFocus) triggerRef.current?.focus();
  }, []);

  const selectMode = useCallback(
    (next: CueFilterMode): void => {
      onModeChange(next);
      closeMenu(true);
    },
    [onModeChange, closeMenu],
  );

  const handleTriggerKeyDown = (e: KeyboardEvent<HTMLButtonElement>): void => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === ' ' || e.key === 'Enter') {
      e.preventDefault();
      if (!isOpen) setIsOpen(true);
    }
  };

  return (
    <div className={styles.fab} data-tihoka-id="cue-filter">
      <Button
        ref={triggerRef}
        variant={variant ?? (mode === 'all' ? 'secondary' : 'primary')}
        size={size}
        shape="circle"
        elevation="high"
        aria-label={
          counts === null
            ? t('cueFilter.fabAriaLabelPending')
            : t('cueFilter.fabAriaLabel', [i1Count])
        }
        aria-haspopup="menu"
        aria-expanded={isOpen}
        title={t('cueFilter.fabTooltip')}
        onClick={() => (isOpen ? closeMenu() : setIsOpen(true))}
        onKeyDown={handleTriggerKeyDown}
        data-tihoka-id="cue-filter-fab"
      >
        <Icon name="slidersHorizontal" aria-hidden="true" />
      </Button>
      <span className={styles.badge} aria-hidden="true" data-tihoka-id="cue-filter-badge">
        {badgeText}
      </span>
      <Menu
        open={isOpen}
        onClose={() => closeMenu()}
        triggerRef={triggerRef}
        align="right"
        ariaLabel={t('cueFilter.menuLabel')}
        container={menuContainer ?? undefined}
      >
        {CUE_FILTER_MODES.map((m) => (
          <MenuItem
            key={m}
            radio
            selected={m === mode}
            trailing={counts?.[m]}
            onSelect={() => selectMode(m)}
          >
            {cueFilterModeLabel(m)}
          </MenuItem>
        ))}
      </Menu>
    </div>
  );
}
