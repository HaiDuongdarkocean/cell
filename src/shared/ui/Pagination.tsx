import { useCallback, useEffect, useRef, useState, type ReactElement } from 'react';
import { Button } from './Button';
import { Input } from './Input';
import { Popover } from './Popover';
import { Slider } from './Slider';
import { pushEscapeLayer } from './escapeLayerStack';
import { useDismissOnScroll } from './useDismissOnScroll';
import { Icon } from '@/shared/icons/Icon';
import { t } from '@/shared/i18n';
import styles from './Pagination.module.css';

export interface PaginationProps {
  /** Current active page index (0-based). */
  readonly current: number;
  /** Total number of pages. */
  readonly total: number;
  /** Callback when page changes. Receives the new 0-based page index. */
  readonly onChange: (page: number) => void;
  /** Show jump-to-page input. Default: true. */
  readonly showJump?: boolean;
  /** Optional extra className for the container. */
  readonly className?: string;
}

type PageItem = number | 'ellipsis-left' | 'ellipsis-right';

function buildPageNumbers(current: number, total: number): PageItem[] {
  if (total <= 9) return Array.from({ length: total }, (_, i) => i + 1);
  const cur = current + 1;
  const numbers = [...new Set([1, 2, total - 1, total, cur - 1, cur, cur + 1])]
    .filter((n) => n >= 1 && n <= total)
    .sort((a, b) => a - b);
  const pages: PageItem[] = [];
  let prev = 0;
  for (const n of numbers) {
    if (n - prev > 1) pages.push(n <= cur ? 'ellipsis-left' : 'ellipsis-right');
    pages.push(n);
    prev = n;
  }
  return pages;
}

export function Pagination({
  current,
  total,
  onChange,
  showJump = true,
  className,
}: PaginationProps): ReactElement {
  const [ellipsisSide, setEllipsisSide] = useState<'left' | 'right' | null>(null);
  const [jumpValue, setJumpValue] = useState('');
  const ellipsisLeftRef = useRef<HTMLButtonElement>(null);
  const ellipsisRightRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  const triggerRef = ellipsisSide === 'right' ? ellipsisRightRef : ellipsisLeftRef;
  const closePopover = useCallback(() => setEllipsisSide(null), []);

  useDismissOnScroll(ellipsisSide !== null, popoverRef, triggerRef, closePopover);

  useEffect(() => {
    if (!ellipsisSide) return;
    const trigger = triggerRef.current;
    const doc = trigger?.ownerDocument ?? document;
    const handlePointerDown = (e: Event): void => {
      const path = e.composedPath();
      const insideTrigger = trigger !== null && path.includes(trigger);
      const insidePopover = popoverRef.current !== null && path.includes(popoverRef.current);
      if (!insideTrigger && !insidePopover) setEllipsisSide(null);
    };
    const popEscapeLayer = pushEscapeLayer((e) => {
      e.preventDefault();
      setEllipsisSide(null);
      trigger?.focus();
    }, doc);
    doc.addEventListener('mousedown', handlePointerDown);
    return () => {
      popEscapeLayer();
      doc.removeEventListener('mousedown', handlePointerDown);
    };
  }, [ellipsisSide, triggerRef]);

  useEffect(() => {
    if (!ellipsisSide) return;
    popoverRef.current?.querySelector('input')?.focus();
  }, [ellipsisSide]);

  if (total <= 1) {
    return <div className={`${styles.pagination} ${className ?? ''}`.trim()} />;
  }

  const pages = buildPageNumbers(current, total);
  const jumpTarget = (): number | null => {
    const n = parseInt(jumpValue, 10);
    return Number.isNaN(n) || n < 1 || n > total ? null : n;
  };
  const scrub = jumpTarget() ?? current + 1;

  const handleJump = (): void => {
    const n = jumpTarget();
    if (n !== null) onChange(n - 1);
    setJumpValue('');
  };

  const handlePopoverJump = (): void => {
    const n = jumpTarget();
    if (n !== null) {
      onChange(n - 1);
      setEllipsisSide(null);
    }
  };

  const openPopover = (side: 'left' | 'right'): void => {
    if (ellipsisSide === side) {
      setEllipsisSide(null);
      return;
    }
    setJumpValue('');
    setEllipsisSide(side);
  };

  return (
    <div className={`${styles.pagination} ${className ?? ''}`.trim()}>
      <Button
        aria-label={t('ui.pagination.first')}
        size="sm"
        variant="ghost"
        disabled={current === 0}
        onClick={() => onChange(0)}
      >
        <Icon name="chevronsLeft" />
      </Button>
      <Button
        aria-label={t('ui.pagination.previous')}
        size="sm"
        variant="ghost"
        disabled={current === 0}
        onClick={() => onChange(Math.max(0, current - 1))}
      >
        <Icon name="chevronLeft" />
      </Button>

      <div className={styles.pageNumbers}>
        {pages.map((p, i) => {
          if (p === 'ellipsis-left' || p === 'ellipsis-right') {
            const side = p === 'ellipsis-left' ? 'left' : 'right';
            return (
              <Button
                key={`ellipsis-${i}`}
                ref={side === 'left' ? ellipsisLeftRef : ellipsisRightRef}
                aria-label={t('ui.pagination.allPages')}
                aria-haspopup="dialog"
                aria-expanded={ellipsisSide === side}
                size="sm"
                variant="ghost"
                onClick={() => openPopover(side)}
              >
                <Icon name="ellipsis" />
              </Button>
            );
          }
          return (
            <Button
              key={p}
              variant={p - 1 === current ? 'primarySubtle' : 'ghost'}
              size="sm"
              active={p - 1 === current}
              aria-current={p - 1 === current ? 'page' : undefined}
              className={styles.pageBtn}
              onClick={() => onChange(p - 1)}
            >
              {p}
            </Button>
          );
        })}
      </div>

      <Button
        aria-label={t('ui.pagination.next')}
        size="sm"
        variant="ghost"
        disabled={current >= total - 1}
        onClick={() => onChange(Math.min(total - 1, current + 1))}
      >
        <Icon name="chevronRight" />
      </Button>
      <Button
        aria-label={t('ui.pagination.last')}
        size="sm"
        variant="ghost"
        disabled={current >= total - 1}
        onClick={() => onChange(total - 1)}
      >
        <Icon name="chevronsRight" />
      </Button>

      <Popover
        open={ellipsisSide !== null}
        triggerRef={triggerRef}
        contentRef={popoverRef}
        variant="menu"
        role="dialog"
        aria-label={t('ui.pagination.jump')}
        menuAlign="auto"
      >
        <div className={styles.jumpBody}>
          <div className={styles.popupHeader}>{t('ui.pagination.jump')}</div>
          <div className={styles.jumpRow}>
            <Input
              type="number"
              size="sm"
              min={1}
              max={total}
              value={jumpValue}
              onChange={(e) => setJumpValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handlePopoverJump();
              }}
              placeholder={t('ui.pagination.jumpPlaceholder')}
              aria-label={t('ui.pagination.jump')}
              className={styles.popoverField}
            />
            <span className={styles.jumpTotal}>/ {total}</span>
          </div>
          <Slider
            size="compact"
            min={1}
            max={total}
            step={1}
            value={scrub}
            aria-label={t('ui.pagination.jump')}
            onChange={(v) => {
              setJumpValue(String(v));
              onChange(v - 1);
            }}
          />
        </div>
      </Popover>

      {showJump && (
        <div className={styles.jumpInput}>
          <Input
            type="number"
            min={1}
            max={total}
            value={jumpValue}
            onChange={(e) => setJumpValue(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleJump(); }}
            placeholder={t('ui.pagination.jumpPlaceholder')}
            aria-label={t('ui.pagination.jump')}
            className={styles.jumpField}
          />
          <Button shape="circle" aria-label={t('ui.pagination.jump')} size="sm" variant="ghost" onClick={handleJump}>
            <Icon name="search" />
          </Button>
        </div>
      )}
    </div>
  );
}
