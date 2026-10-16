import { useCallback, useEffect, useRef, useState } from 'react';
import { Icon } from '@/shared/ui/Icon';
import { Button } from '@/shared/ui/Button';
import { EmptyState } from '@/shared/ui/EmptyState';
import { Skeleton } from '@/shared/ui/Skeleton';
import { Panel, PanelList } from './PopupPanel';
import checkStyles from './DictionaryCheckable.module.css';
import panelStyles from './DictionaryPanelView.module.css';
import styles from './ImagePanel.module.css';
import type { ImageItem } from '@/entities/dictionary';
import { t } from '@/shared/i18n';

export interface ImagePanelProps {
  readonly items: readonly ImageItem[];
  readonly loading: boolean;
  readonly error: string | null;
  readonly selection: Map<string, boolean>;
  readonly onToggle: (id: string, selected: boolean) => void;
  readonly onImageError: (id: string) => void;
  readonly term: string;
}

export function ImagePanel({
  items,
  loading,
  error,
  selection,
  onToggle,
  onImageError,
  term,
}: ImagePanelProps): React.JSX.Element {
  const stripRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(items.length > 0);

  const updateScrollState = useCallback((): void => {
    const el = stripRef.current;
    if (!el || el.clientWidth === 0) return;
    const maxScroll = el.scrollWidth - el.clientWidth;
    setCanScrollLeft(el.scrollLeft > 0);
    setCanScrollRight(el.scrollLeft < maxScroll - 1);
  }, []);

  const scroll = useCallback((direction: 'left' | 'right'): void => {
    const el = stripRef.current;
    if (!el) return;
    const card = el.querySelector('button[role="checkbox"]');
    const gap = parseFloat(getComputedStyle(el).gap || '8px');
    const step = (card?.clientWidth || 120) + gap;
    el.scrollBy({ left: direction === 'left' ? -step : step, behavior: 'smooth' });
  }, []);

  useEffect(() => {
    updateScrollState();
  }, [items, updateScrollState]);

  if (loading) {
    return (
      <Panel id="dictionary-image-panel" className={styles.TihokaImage}>
        <ImageSkeleton />
      </Panel>
    );
  }

  if (error) {
    return (
      <Panel id="dictionary-image-panel" className={styles.TihokaImage}>
        <div className={panelStyles.TihokaImageError}>{error}</div>
      </Panel>
    );
  }

  if (items.length === 0) {
    return (
      <Panel id="dictionary-image-panel" className={styles.TihokaImage}>
        <EmptyState
          size="md"
          icon={<Icon name="image"  />}
          title={t('dict.images.empty')}
          action={
            <a
              href={`https://www.google.com/search?tbm=isch&q=${encodeURIComponent(term)}`}
              target="_blank"
              rel="noopener noreferrer"
              className={styles.TihokaImageEmptyAction}
            >
              {t('dict.images.searchMore')}
            </a>
          }
          data-tihoka-id="dictionary-image-empty"
        />
      </Panel>
    );
  }

  return (
    <Panel id="dictionary-image-panel" className={styles.TihokaImage}>
      <PanelList
        direction="horizontal"
        className={styles.TihokaImageStrip}
        listRef={stripRef}
        onScroll={updateScrollState}
        id="dictionary-image-strip"
      >
        {items.map((item) => {
          const selected = selection.get(item.id) === true;
          return (
            <button
              type="button"
              key={item.id}
              className={`${checkStyles.TihokaImageCard} ${selected ? checkStyles['TihokaImageCard--selected'] : ''}`}
              role="checkbox"
              aria-checked={selected}
              onClick={(): void => onToggle(item.id, !selected)}
            >
              <img
                src={item.src}
                alt={item.alt}
                className={styles.TihokaImageThumb}
                onError={(): void => onImageError(item.id)}
              />
              <span className={checkStyles.TihokaDefCheckBox} aria-hidden="true">
                <Icon name="check" size="md" />
              </span>
            </button>
          );
        })}
      </PanelList>
      <Button
        variant="secondary"
        size="sm"
        shape="circle"
        className={styles.TihokaImageNavLeft}
        aria-label={t('dict.images.scrollLeft')}
        disabled={!canScrollLeft}
        onClick={(): void => scroll('left')}
        data-tihoka-id="dictionary-image-scroll-left"
        data-compact-hit
      >
        <Icon name="chevronLeft"  />
      </Button>
      <Button
        variant="secondary"
        size="sm"
        shape="circle"
        className={styles.TihokaImageNavRight}
        aria-label={t('dict.images.scrollRight')}
        disabled={!canScrollRight}
        onClick={(): void => scroll('right')}
        data-tihoka-id="dictionary-image-scroll-right"
        data-compact-hit
      >
        <Icon name="chevronRight"  />
      </Button>
    </Panel>
  );
}

function ImageSkeleton(): React.JSX.Element {
  return (
    <div className={styles.TihokaImageSkeleton} aria-hidden="true">
      {/* 8 cards × 128px covers any resizable popup width (min 320px, user can
         drag to ~viewport width) so the strip never shows a right-side gap. */}
      {Array.from({ length: 8 }).map((_, i) => (
        <Skeleton key={i} shape="rounded" className={styles.TihokaImageSkeletonCard} />
      ))}
    </div>
  );
}
