// ResourceCard — list item with name, wordCount, format, delete button (spec F11).

import { type ReactElement } from 'react';
import { Button, Card } from '@/shared/ui';
import type { ResourceInfo } from '@/entities/dictionary';
import styles from './ResourceCard.module.css';

interface ResourceCardProps {
  readonly resource: ResourceInfo;
  readonly onDelete: () => void;
}

export function ResourceCard({ resource, onDelete }: ResourceCardProps): ReactElement {
  return (
    <Card className={styles.card} data-cell-id={`resource-card-${resource.id}`}>
      <div className={styles.info}>
        <span className={styles.name}>{resource.name}</span>
        <span className={styles.meta}>
          {resource.format} · {resource.wordCount} mục
          {!resource.installationFinished && ' · đang import...'}
        </span>
      </div>
      <Button material="solid"
        variant="outline"
        size="sm"
        onClick={onDelete}
        aria-label={`Xóa ${resource.name}`}
        data-cell-id={`delete-button-${resource.id}`}
      >
        Xóa
      </Button>
    </Card>
  );
}

export function ResourceCardSkeleton(): ReactElement {
  return <div className={styles.skeleton} data-cell-id="resource-card-skeleton" aria-hidden="true" />;
}
