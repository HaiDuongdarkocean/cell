import { useLayoutEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { Icon } from '@/shared/icons/Icon';
import { Button } from './Button';
import { t } from '@/shared/i18n';
import styles from './CollapsibleLine.module.css';

export interface CollapsibleLineProps {
  readonly children: ReactNode;
  readonly className?: string;
  /** Class applied to the inner content box — where flex/text styling lives. */
  readonly contentClassName?: string;
  readonly dataTihokaId?: string;
}

/** First visual row height — max box among items sitting on the top line.
 *  Flex/grid children give boxes; inline content is measured via Range rects
 *  (covers text lines and inline elements like buttons). */
function measureRowHeight(el: HTMLElement): number {
  const rects: { top: number; height: number }[] = [];
  if (/flex|grid/.test(getComputedStyle(el).display)) {
    for (const c of el.children) {
      const r = c.getBoundingClientRect();
      if (r.height > 0) rects.push(r);
    }
  } else if (typeof Range.prototype.getClientRects === 'function') {
    const range = document.createRange();
    range.selectNodeContents(el);
    for (const r of range.getClientRects()) if (r.height > 0) rects.push(r);
  }
  if (!rects.length) return 0;
  const top = Math.min(...rects.map((r) => r.top));
  return Math.max(...rects.filter((r) => r.top <= top + 2).map((r) => r.height));
}

/**
 * CollapsibleLine — clips overflowing inline/flex content to its first row.
 * A chevron toggle expands the clipped region downward (or back) with a
 * height animation. Down = more below, up = collapse back.
 */
export function CollapsibleLine({
  children,
  className,
  contentClassName,
  dataTihokaId,
}: CollapsibleLineProps): React.JSX.Element {
  const contentRef = useRef<HTMLDivElement>(null);
  const [expanded, setExpanded] = useState(false);
  const [rowHeight, setRowHeight] = useState(0);
  const [fullHeight, setFullHeight] = useState(0);

  useLayoutEffect(() => {
    const el = contentRef.current;
    setExpanded(false);
    if (!el) return;
    const measure = () => {
      setRowHeight(measureRowHeight(el));
      setFullHeight(el.scrollHeight);
    };
    measure();
    // Re-measure when the container resizes (popup resize, font zoom).
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [children]);

  // Only clip when a real second row exists — glyph descenders can spill a
  // few px past the line box without wrapping.
  const overflows = rowHeight > 0 && fullHeight > rowHeight * 1.4;

  return (
    <div className={[styles.wrap, className ?? ''].filter(Boolean).join(' ')} data-tihoka-id={dataTihokaId}>
      <div
        className={styles.clip}
        style={overflows ? { maxHeight: expanded ? fullHeight : rowHeight } : undefined}
      >
        <div ref={contentRef} className={[styles.content, contentClassName ?? ''].filter(Boolean).join(' ')}>
          {children}
        </div>
      </div>
      {overflows && (
        <Button
          variant="unstyled"
          className={styles.toggle}
          style={{ height: rowHeight }}
          aria-expanded={expanded}
          aria-label={expanded ? t('ui.collapse.collapse') : t('ui.collapse.expand')}
          onClick={() => setExpanded((v) => !v)}
          data-tihoka-id={dataTihokaId ? `${dataTihokaId}-expand` : undefined}
        >
          <Icon name="chevronDown" size={16} className={`${styles.chevron} ${expanded ? styles.chevronUp : ''}`} />
        </Button>
      )}
    </div>
  );
}
