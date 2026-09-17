import { useCallback, useEffect, useId, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';
import { Button } from '@/shared/ui/Button';
import { Popover } from '@/shared/ui/Popover';
import { Icon } from '@/shared/icons/Icon';
import { pushEscapeLayer } from '@/shared/ui/escapeLayerStack';
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
  dense: 'cueFilter.mode.dense',
  tracking: 'cueFilter.mode.tracking',
};

export function cueFilterModeLabel(mode: CueFilterMode): string {
  return t(MODE_LABEL_KEY[mode]);
}

export interface CueRecommendFabProps {
  readonly mode: CueFilterMode;
  readonly counts: Readonly<Record<CueFilterMode, number>>;
  readonly onModeChange: (mode: CueFilterMode) => void;
}

export function CueRecommendFab({
  mode,
  counts,
  onModeChange,
}: CueRecommendFabProps): React.JSX.Element {
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const idPrefix = useId();

  const optionId = (m: CueFilterMode): string => `${idPrefix}-opt-${m}`;
  const i1Count = counts.i1;
  const badgeText = i1Count > 99 ? '99+' : String(i1Count);

  const openMenu = useCallback((): void => {
    setHighlightedIndex(Math.max(0, CUE_FILTER_MODES.indexOf(mode)));
    setIsOpen(true);
  }, [mode]);

  const closeMenu = useCallback((restoreFocus = false): void => {
    setIsOpen(false);
    setHighlightedIndex(-1);
    if (restoreFocus) triggerRef.current?.focus();
  }, []);

  const selectMode = useCallback(
    (next: CueFilterMode): void => {
      onModeChange(next);
      closeMenu(true);
    },
    [onModeChange, closeMenu],
  );

  useEffect(() => {
    if (!isOpen) return;
    const doc = rootRef.current?.ownerDocument ?? document;
    const win = doc.defaultView ?? window;
    const handleClickOutside = (e: Event): void => {
      const path = e.composedPath();
      if (
        !path.includes(rootRef.current as Node) &&
        !path.includes(menuRef.current as Node)
      ) {
        closeMenu();
      }
    };
    const handleScroll = (): void => closeMenu();
    doc.addEventListener('mousedown', handleClickOutside);
    win.addEventListener('scroll', handleScroll, true);
    return () => {
      doc.removeEventListener('mousedown', handleClickOutside);
      win.removeEventListener('scroll', handleScroll, true);
    };
  }, [isOpen, closeMenu]);

  useEffect(() => {
    if (!isOpen) return;
    const doc = rootRef.current?.ownerDocument ?? document;
    return pushEscapeLayer((e) => {
      e.preventDefault();
      closeMenu(true);
    }, doc);
  }, [isOpen, closeMenu]);

  useEffect(() => {
    if (isOpen) menuRef.current?.focus();
  }, [isOpen]);

  const handleTriggerKeyDown = (e: KeyboardEvent<HTMLButtonElement>): void => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === ' ' || e.key === 'Enter') {
      e.preventDefault();
      if (!isOpen) openMenu();
    }
  };

  const handleMenuKeyDown = (e: KeyboardEvent<HTMLDivElement>): void => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedIndex((prev) => Math.min(prev + 1, CUE_FILTER_MODES.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex((prev) => Math.max(prev - 1, 0));
    } else if (e.key === 'Home') {
      e.preventDefault();
      setHighlightedIndex(0);
    } else if (e.key === 'End') {
      e.preventDefault();
      setHighlightedIndex(CUE_FILTER_MODES.length - 1);
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      const highlighted = CUE_FILTER_MODES[highlightedIndex];
      if (highlighted) selectMode(highlighted);
    } else if (e.key === 'Tab') {
      closeMenu();
    }
  };

  return (
    <div ref={rootRef} className={styles.fab} data-cell-id="cue-filter">
      <Button
        ref={triggerRef}
        variant={mode === 'all' ? 'secondary' : 'primary'}
        size="lg"
        shape="circle"
        elevation="high"
        aria-label={t('cueFilter.fabAriaLabel', [i1Count])}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        title={t('cueFilter.fabTooltip')}
        onClick={() => (isOpen ? closeMenu() : openMenu())}
        onKeyDown={handleTriggerKeyDown}
        data-cell-id="cue-filter-fab"
      >
        <Icon name="slidersHorizontal" aria-hidden="true" />
      </Button>
      <span className={styles.badge} aria-hidden="true" data-cell-id="cue-filter-badge">
        {badgeText}
      </span>
      <Popover open={isOpen} triggerRef={triggerRef} menuAlign="right">
        <div
          ref={menuRef}
          className={styles.menu}
          role="menu"
          tabIndex={-1}
          aria-label={t('cueFilter.menuLabel')}
          aria-activedescendant={
            highlightedIndex >= 0 ? optionId(CUE_FILTER_MODES[highlightedIndex]) : undefined
          }
          onKeyDown={handleMenuKeyDown}
        >
          {CUE_FILTER_MODES.map((m, i) => (
            <div
              key={m}
              id={optionId(m)}
              role="menuitemradio"
              aria-checked={m === mode}
              className={[
                styles.item,
                i === highlightedIndex ? styles.itemHighlighted : '',
                m === mode ? styles.itemActive : '',
              ]
                .filter(Boolean)
                .join(' ')}
              onClick={() => selectMode(m)}
              onMouseEnter={() => setHighlightedIndex(i)}
            >
              <span className={styles.itemLabel}>{cueFilterModeLabel(m)}</span>
              <span className={styles.itemCount}>{counts[m]}</span>
              {m === mode && <Icon name="check" className={styles.itemCheck} aria-hidden="true" />}
            </div>
          ))}
        </div>
      </Popover>
    </div>
  );
}
