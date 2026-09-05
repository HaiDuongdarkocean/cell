import { useCallback, useEffect, useRef, useState } from 'react';
import { Icon } from '@/shared/ui/Icon';
import { Button } from '@/shared/ui/Button';
import { EmptyState } from '@/shared/ui/EmptyState';
import { Skeleton } from '@/shared/ui/Skeleton';
import checkStyles from './DictionaryCheckable.module.css';
import panelStyles from './DictionaryPanelView.module.css';
import styles from './ImagePanel.module.css';
import type { ImageItem } from '../types';

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
      <div className={styles.cellImage} data-cell-id="dictionary-image-panel">
        <ImageSkeleton />
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.cellImage} data-cell-id="dictionary-image-panel">
        <div className={panelStyles.cellImageError}>{error}</div>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className={styles.cellImage} data-cell-id="dictionary-image-panel">
        <EmptyState
          size="md"
          icon={<Icon name="image"  />}
          title="No images"
          action={
            <a
              href={`https://www.google.com/search?tbm=isch&q=${encodeURIComponent(term)}`}
              target="_blank"
              rel="noopener noreferrer"
              className={styles.cellImageEmptyAction}
            >
              Search Google Images →
            </a>
          }
          data-cell-id="dictionary-image-empty"
        />
      </div>
    );
  }

  return (
    <div className={styles.cellImage} data-cell-id="dictionary-image-panel">
      <div
        className={styles.cellImageStrip}
        ref={stripRef}
        onScroll={updateScrollState}
        data-cell-id="dictionary-image-strip"
      >
        {items.map((item) => {
          const selected = selection.get(item.id) === true;
          return (
            <button
              type="button"
              key={item.id}
              className={`${checkStyles.cellImageCard} ${selected ? checkStyles['cellImageCard--selected'] : ''}`}
              role="checkbox"
              aria-checked={selected}
              onClick={(): void => onToggle(item.id, !selected)}
            >
              <img
                src={item.src}
                alt={item.alt}
                className={styles.cellImageThumb}
                onError={(): void => onImageError(item.id)}
              />
              <span className={checkStyles.cellDefCheckBox} aria-hidden="true">
                <Icon name="check" size="md" />
              </span>
            </button>
          );
        })}
      </div>
      <Button
        material="solid"
        variant="secondary"
        size="xs"
        shape="circle"
        className={styles.cellImageNavLeft}
        aria-label="Scroll images left"
        disabled={!canScrollLeft}
        onClick={(): void => scroll('left')}
        data-cell-id="dictionary-image-scroll-left"
      >
        <Icon name="chevronLeft"  />
      </Button>
      <Button
        material="solid"
        variant="secondary"
        size="xs"
        shape="circle"
        className={styles.cellImageNavRight}
        aria-label="Scroll images right"
        disabled={!canScrollRight}
        onClick={(): void => scroll('right')}
        data-cell-id="dictionary-image-scroll-right"
      >
        <Icon name="chevronRight"  />
      </Button>
    </div>
  );
}

function ImageSkeleton(): React.JSX.Element {
  return (
    <div className={styles.cellImageSkeleton} aria-hidden="true">
      {Array.from({ length: 8 }).map((_, i) => (
        <Skeleton key={i} width="100%" height="100%" shape="rounded" className={styles.cellImageSkeletonCard} />
      ))}
    </div>
  );
}
