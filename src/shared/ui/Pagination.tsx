import { useState, type ReactElement } from 'react';
import { Button } from './Button';
import { IconButton } from './IconButton';
import { Input } from './Input';
import { Icon } from '@/shared/icons/Icon';
import styles from './Pagination.module.css';

/** ponytail: using unicode text labels for first/last/ellipsis because dedicated
 *  chevron-first/last/ellipsis icons are not in the catalog. When multi-page UIs
 *  multiply, add those icons to `src/shared/icons/index.ts`. */

export interface PaginationProps {
  /** Current active page index (0-based). */
  readonly current: number;
  /** Total number of pages. */
  readonly total: number;
  /** Callback when page changes. Receives the new 0-based page index. */
  readonly onChange: (page: number) => void;
  /** Show jump-to-page input. Default: true. */
  readonly showJump?: boolean;
  /** Maximum visible page numbers before using ellipsis. Default: 7. */
  readonly siblingLimit?: number;
  /** Optional extra className for the container. */
  readonly className?: string;
}

function buildPageNumbers(current: number, total: number, siblingLimit: number): (number | 'ellipsis-left' | 'ellipsis-right')[] {
  const visible = Math.max(5, Math.min(siblingLimit, total));
  if (total <= visible) return Array.from({ length: total }, (_, i) => i + 1);

  const pages: (number | 'ellipsis-left' | 'ellipsis-right')[] = [1];
  const left = Math.max(2, current - 1);
  const right = Math.min(total - 1, current + 1);
  const showLeftEllipsis = left > 2;
  const showRightEllipsis = right < total - 1;

  if (showLeftEllipsis) pages.push('ellipsis-left');
  for (let i = left; i <= right; i++) pages.push(i);
  if (showRightEllipsis) pages.push('ellipsis-right');
  pages.push(total);
  return pages;
}

export function Pagination({
  current,
  total,
  onChange,
  showJump = true,
  siblingLimit = 7,
  className,
}: PaginationProps): ReactElement {
  const [ellipsisPopup, setEllipsisPopup] = useState<'left' | 'right' | null>(null);
  const [jumpValue, setJumpValue] = useState('');

  if (total <= 1) {
    return <div className={`${styles.pagination} ${className ?? ''}`.trim()} />;
  }

  const pages = buildPageNumbers(current, total, siblingLimit);

  const handleJump = (): void => {
    const n = parseInt(jumpValue, 10);
    if (!Number.isNaN(n) && n >= 1 && n <= total) onChange(n - 1);
    setJumpValue('');
  };

  const handleEllipsisClick = (side: 'left' | 'right'): void => {
    setEllipsisPopup(ellipsisPopup === side ? null : side);
  };

  return (
    <div className={`${styles.pagination} ${className ?? ''}`.trim()}>
      <Button
        aria-label="First page"
        size="sm"
        variant="ghost"
        disabled={current === 0}
        className={styles.navBtn}
        onClick={() => onChange(0)}
      >
        ‹‹
      </Button>
      <Button
        aria-label="Previous page"
        size="sm"
        variant="ghost"
        disabled={current === 0}
        className={styles.navBtn}
        onClick={() => onChange(Math.max(0, current - 1))}
      >
        ‹
      </Button>

      <div className={styles.pageNumbers}>
        {pages.map((p, i) => {
          if (p === 'ellipsis-left' || p === 'ellipsis-right') {
            const side = p === 'ellipsis-left' ? 'left' : 'right';
            return (
              <span key={`ellipsis-${i}`} className={styles.ellipsisWrap}>
                <Button
                  aria-label={`More pages ${side}`}
                  size="sm"
                  variant="ghost"
                  className={styles.ellipsisBtn}
                  onClick={() => handleEllipsisClick(side)}
                >
                  …
                </Button>
                {ellipsisPopup === side && (
                  <div className={styles.ellipsisPopup} onClick={(e) => e.stopPropagation()}>
                    <div className={styles.popupHeader}>Jump to page</div>
                    <div className={styles.popupList}>
                      {Array.from({ length: total }, (_, idx) => idx + 1).map((n) => (
                        <Button
                          key={n}
                          variant="ghost"
                          size="sm"
                          className={styles.popupItem}
                          onClick={() => { onChange(n - 1); setEllipsisPopup(null); }}
                        >
                          {n}
                        </Button>
                      ))}
                    </div>
                  </div>
                )}
              </span>
            );
          }
          return (
            <Button
              key={p}
              variant={p - 1 === current ? 'primarySubtle' : 'ghost'}
              size="sm"
              active={p - 1 === current}
              className={styles.pageBtn}
              onClick={() => onChange(p - 1)}
            >
              {p}
            </Button>
          );
        })}
      </div>

      <Button
        aria-label="Next page"
        size="sm"
        variant="ghost"
        disabled={current >= total - 1}
        className={styles.navBtn}
        onClick={() => onChange(Math.min(total - 1, current + 1))}
      >
        ›
      </Button>
      <Button
        aria-label="Last page"
        size="sm"
        variant="ghost"
        disabled={current >= total - 1}
        className={styles.navBtn}
        onClick={() => onChange(total - 1)}
      >
        ››
      </Button>

      {showJump && (
        <div className={styles.jumpInput}>
          <Input
            type="number"
            min={1}
            max={total}
            value={jumpValue}
            onChange={(e) => setJumpValue(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleJump(); }}
            placeholder="Go"
            aria-label="Jump to page"
            className={styles.jumpField}
          />
          <IconButton aria-label="Jump to page" size="sm" variant="ghost" onClick={handleJump}>
            <Icon name="search" />
          </IconButton>
        </div>
      )}
    </div>
  );
}
