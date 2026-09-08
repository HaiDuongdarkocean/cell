import { useCallback, useEffect, useRef, type KeyboardEvent, type ReactNode } from 'react';
import { Button } from '@/shared/ui/Button';
import styles from './InkTabs.module.css';

export interface InkTabItem {
  /** Tab value passed to onValueChange. */
  value: string;
  /** Tab label content. */
  label: ReactNode;
  /** Optional count badge rendered next to the label (dictionary-toolbar badge style). */
  badge?: number;
  /** Disabled tabs cannot be selected. */
  disabled?: boolean;
  /** Accessible name override — defaults to the label text. */
  ariaLabel?: string;
}

export interface InkTabsProps {
  items: readonly InkTabItem[];
  /** Active tab value (controlled). */
  value: string;
  onValueChange: (value: string) => void;
  /** Tablist accessible name. */
  'aria-label': string;
  className?: string;
}

/**
 * InkTabs — text tab row with a single liquid ink-bar underline that flows
 * between tabs (3-phase WAAPI: shrink around the current tab, travel at half
 * width, expand to the destination width). Extracted from the dictionary
 * AudioPanel subtabs; supports N tabs and optional count badges.
 */
export function InkTabs({ items, value, onValueChange, className, ...rest }: InkTabsProps): React.JSX.Element {
  const listRef = useRef<HTMLDivElement>(null);
  const inkAnimRef = useRef<Animation | null>(null);

  // The ::after ink bar reads its resting geometry from --ink-x/--ink-w.
  const updateInk = useCallback((): void => {
    const bar = listRef.current;
    const active = bar?.querySelector<HTMLElement>('[aria-selected="true"]');
    if (!bar || !active) return;
    const x = active.offsetLeft;
    const w = active.offsetWidth;
    const raw = bar.style.getPropertyValue('--ink-x');
    const fx = parseFloat(raw || '0');
    const fw = parseFloat(bar.style.getPropertyValue('--ink-w') || '0');
    bar.style.setProperty('--ink-x', `${x}px`);
    bar.style.setProperty('--ink-w', `${w}px`);
    // Skip on first measure (nothing set yet) and on no-op re-measures —
    // ResizeObserver's initial callback re-runs this with the same geometry.
    if (raw === '' || (x === fx && w === fw)) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    inkAnimRef.current?.cancel();
    // Direction-anchored liquid: shrink toward the edge facing the travel
    // direction, the half-width bar flows to the target's opposite edge,
    // then it slowly stretches across the new tab.
    const right = x > fx;
    const frames: Keyframe[] = right
      ? [
          { left: `${fx}px`, width: `${fw}px` },
          { left: `${fx + fw / 2}px`, width: `${fw / 2}px`, offset: 0.3, easing: 'ease-in' },
          { left: `${x}px`, width: `${w / 2}px`, offset: 0.55, easing: 'cubic-bezier(0.4, 0, 0.2, 1)' },
          { left: `${x}px`, width: `${w}px`, easing: 'cubic-bezier(0, 0, 0.2, 1)' },
        ]
      : [
          { left: `${fx}px`, width: `${fw}px` },
          { left: `${fx}px`, width: `${fw / 2}px`, offset: 0.3, easing: 'ease-in' },
          { left: `${x + w / 2}px`, width: `${w / 2}px`, offset: 0.55, easing: 'cubic-bezier(0.4, 0, 0.2, 1)' },
          { left: `${x}px`, width: `${w}px`, easing: 'cubic-bezier(0, 0, 0.2, 1)' },
        ];
    inkAnimRef.current = bar.animate(frames, { duration: 400, pseudoElement: '::after' });
  }, []);

  useEffect(() => {
    updateInk();
    const bar = listRef.current;
    if (!bar) return;
    const ro = new ResizeObserver(updateInk);
    ro.observe(bar);
    return (): void => ro.disconnect();
  }, [value, items, updateInk]);

  // WAI-ARIA tabs keyboard nav — roving tabindex + arrows/Home/End.
  const onKeyDown = useCallback(
    (e: KeyboardEvent<HTMLDivElement>): void => {
      const tabs = Array.from(
        listRef.current?.querySelectorAll<HTMLElement>('[role="tab"]:not([disabled])') ?? [],
      );
      if (tabs.length === 0) return;
      const activeIndex = tabs.findIndex((tab) => tab.getAttribute('aria-selected') === 'true');
      const currentIndex = activeIndex >= 0 ? activeIndex : 0;

      let nextIndex = currentIndex;
      if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        e.preventDefault();
        nextIndex = currentIndex <= 0 ? tabs.length - 1 : currentIndex - 1;
      } else if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
        e.preventDefault();
        nextIndex = currentIndex >= tabs.length - 1 ? 0 : currentIndex + 1;
      } else if (e.key === 'Home') {
        e.preventDefault();
        nextIndex = 0;
      } else if (e.key === 'End') {
        e.preventDefault();
        nextIndex = tabs.length - 1;
      } else {
        return;
      }

      const nextValue = tabs[nextIndex]?.getAttribute('data-value');
      if (nextValue) {
        onValueChange(nextValue);
        tabs[nextIndex]?.focus();
      }
    },
    [onValueChange],
  );

  return (
    <div
      ref={listRef}
      className={[styles.list, className ?? ''].filter(Boolean).join(' ')}
      role="tablist"
      onKeyDown={onKeyDown}
      {...rest}
    >
      {items.map((item) => {
        const active = item.value === value;
        return (
          <Button
            key={item.value}
            variant="transparent"
            ripple={false}
            role="tab"
            aria-selected={active}
            aria-label={item.ariaLabel}
            tabIndex={active ? 0 : -1}
            data-value={item.value}
            disabled={item.disabled}
            className={[styles.tab, active ? styles.tabActive : ''].filter(Boolean).join(' ')}
            onClick={(): void => onValueChange(item.value)}
          >
            {item.label}
            {item.badge !== undefined && (
              <span className={styles.badge} data-cell-id={`inktab-badge-${item.value}`}>
                {item.badge}
              </span>
            )}
          </Button>
        );
      })}
    </div>
  );
}
