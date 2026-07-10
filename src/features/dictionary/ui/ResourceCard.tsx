// ResourceCard — list item with name, wordCount, format, delete button (spec F11).

import { type ReactElement } from 'react';
import type { ResourceInfo } from '@/entities/dictionary';
import styles from './ResourceCard.module.css';

interface ResourceCardProps {
  readonly resource: ResourceInfo;
  readonly onDelete: () => void;
}

export function ResourceCard({ resource, onDelete }: ResourceCardProps): ReactElement {
  return (
    <div className={styles.card} data-testid={`resource-card-${resource.id}`}>
      <div className={styles.info}>
        <span className={styles.name}>{resource.name}</span>
        <span className={styles.meta}>
          {resource.format} · {resource.wordCount} mục
          {!resource.installationFinished && ' · đang import...'}
        </span>
      </div>
      <button
        type="button"
        className={styles.deleteButton}
        onClick={onDelete}
        aria-label={`Xóa ${resource.name}`}
        data-testid={`delete-button-${resource.id}`}
      >
        Xóa
      </button>
    </div>
  );
}

export function ResourceCardSkeleton(): ReactElement {
  return <div className={styles.skeleton} data-testid="resource-card-skeleton" aria-hidden="true" />;
}
