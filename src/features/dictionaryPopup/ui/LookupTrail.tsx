import { useCallback, useEffect, useLayoutEffect, useRef } from 'react';
import { Chip } from '@/shared/ui/Chip';
import { t } from '@/shared/i18n';
import styles from './LookupTrail.module.css';

export interface LookupTrailProps {
  /** Lookup terms from level 1 to the current level. */
  readonly trail: readonly string[];
  /** Called with the tapped crumb's index — the controller closes deeper levels. */
  readonly onNavigate: (index: number) => void;
}

export function LookupTrail({ trail, onNavigate }: LookupTrailProps): React.JSX.Element | null {
  const stripRef = useRef<HTMLDivElement | null>(null);
  const visible = trail.length >= 2;

  const syncFades = useCallback((): void => {
    const el = stripRef.current;
    if (!el) return;
    el.classList.toggle(styles.fadeStart, el.scrollLeft > 1);
    el.classList.toggle(styles.fadeEnd, el.scrollLeft + el.clientWidth < el.scrollWidth - 1);
  }, []);

  const prevLengthRef = useRef(0);
  useLayoutEffect(() => {
    const el = stripRef.current;
    if (el && trail.length > prevLengthRef.current) el.scrollLeft = el.scrollWidth;
    prevLengthRef.current = trail.length;
    syncFades();
  }, [trail.length, syncFades]);

  // React attaches wheel handlers passively — deltaY→scrollLeft mapping needs
  // preventDefault to keep the page behind the sheet from scrolling, so this
  // listener is registered natively with passive: false.
  useEffect(() => {
    const el = stripRef.current;
    if (!el || !visible) return;
    const onWheel = (e: WheelEvent): void => {
      if (e.deltaX !== 0 || e.deltaY === 0) return;
      const before = el.scrollLeft;
      el.scrollLeft += e.deltaY;
      if (el.scrollLeft !== before) e.preventDefault();
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [visible]);

  const lastIndex = trail.length - 1;
  return (
    <div
      ref={stripRef}
      className={`${styles.trail} ${visible ? '' : styles.trailHidden}`}
      data-cell-id="lookup-trail"
      onScroll={syncFades}
    >
      <nav className={styles.nav} aria-label={t('ui.breadcrumb.aria')} aria-hidden={!visible || undefined}>
        <ol className={styles.list}>
          {trail.map((term, index) => (
            <li
              key={`${index}-${term}`}
              aria-current={index === lastIndex ? 'page' : undefined}
            >
              {index === lastIndex ? (
                <Chip size="xs" className={styles.crumbCurrent}>
                  {term}
                </Chip>
              ) : (
                <Chip
                  as="button"
                  size="xs"
                  className={styles.crumb}
                  data-compact-hit
                  aria-label={t('dict.trail.backTo', [term])}
                  title={t('dict.trail.backTo', [term])}
                  onClick={() => onNavigate(index)}
                >
                  {term}
                </Chip>
              )}
            </li>
          ))}
        </ol>
      </nav>
    </div>
  );
}
