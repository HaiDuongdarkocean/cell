import { Icon } from '@/shared/icons/Icon';
import { EmptyState } from '@/shared/ui/EmptyState';
import { Skeleton } from '@/shared/ui/Skeleton';
import styles from './DictionaryPanelView.module.css';
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
        <div className={styles.cellImageError}>{error}</div>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className={styles.cellImage} data-cell-id="dictionary-image-panel">
        <EmptyState
          size="md"
          icon={<Icon name="image" size={24} />}
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
      <div className={styles.cellImageStrip}>
        {items.map((item) => {
          const selected = selection.get(item.id) ?? item.defaultSelected;
          return (
            <button
              key={item.id}
              type="button"
              className={`${styles.cellImageCard} ${selected ? styles['cellImageCard--selected'] : ''}`}
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
              <span className={styles.cellDefCheckBox} aria-hidden="true">
                <Icon name="check" size={24} />
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function ImageSkeleton(): React.JSX.Element {
  return (
    <div className={styles.cellImageSkeleton} aria-hidden="true">
      {Array.from({ length: 8 }).map((_, i) => (
        <Skeleton key={i} width="84px" height="84px" shape="rounded" className={styles.cellImageSkeletonCard} />
      ))}
    </div>
  );
}
