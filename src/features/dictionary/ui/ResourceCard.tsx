// ResourceCard — resource list item (spec F11 + Resources management upgrade).
//
// Row: expand chevron · name/meta · "Ưu tiên N" + up/down reorder (when the
// section has >1 resource) · enable Toggle · icon-only delete.
// Expanded body (ResourceDetail): sample entries, test lookup, profile picker.
// Disabled resources are dimmed visually — controls stay usable.

import { useState, type ReactElement } from 'react';
import { Button, Card } from '@/shared/ui';
import { Toggle } from '@/shared/ui/Toggle';
import { Icon } from '@/shared/ui/Icon';
import { setResourceEnabled } from '@/features/dictionary/services/resourceClient';
import type { ResourceInfo } from '@/entities/dictionary';
import { formatRelativeTime } from './relativeTime';
import { ResourceDetail } from './ResourceDetail';
import styles from './ResourceCard.module.css';

interface ResourceCardProps {
  readonly resource: ResourceInfo;
  /** 0-based position within its section (for the "Ưu tiên N" hint). */
  readonly index: number;
  /** Total resources in the section — reorder + priority hint need >1. */
  readonly sectionSize: number;
  readonly onDelete: () => void;
  /** Move within the section: -1 = up (higher priority), +1 = down. */
  readonly onMove?: (direction: -1 | 1) => void;
  /** Called after card-side mutations (enable toggle, profiles) to refresh. */
  readonly onChanged?: () => void;
}

export function ResourceCard({
  resource,
  index,
  sectionSize,
  onDelete,
  onMove,
  onChanged,
}: ResourceCardProps): ReactElement {
  const enabled = resource.enabled !== false;
  const [expanded, setExpanded] = useState(false);
  const [toggling, setToggling] = useState(false);

  const handleToggle = (next: boolean): void => {
    if (resource.id == null || toggling) return;
    setToggling(true);
    void setResourceEnabled(resource.langCode, resource.id, next)
      .then(() => onChanged?.())
      .catch(() => { /* refresh restores the persisted state */ onChanged?.(); })
      .finally(() => setToggling(false));
  };

  const canReorder = sectionSize > 1 && onMove != null;

  return (
    <Card
      className={`${styles.card} ${enabled ? '' : styles.cardDisabled}`}
      data-cell-id={`resource-card-${resource.id}`}
    >
      <div className={styles.row}>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setExpanded((v) => !v)}
          aria-label={expanded ? `Thu gọn ${resource.name}` : `Chi tiết ${resource.name}`}
          aria-expanded={expanded}
          data-cell-id={`expand-${resource.id}`}
        >
          <Icon
            name="chevronDown"
            size="xs"
            className={expanded ? styles.iconUp : undefined}
          />
        </Button>

        <div className={styles.info}>
          <span className={styles.name}>{resource.name}</span>
          <span className={styles.meta}>
            {resource.wordCount} từ · {resource.format} · {formatRelativeTime(resource.importedAt)}
            {!resource.installationFinished && ' · đang thêm…'}
          </span>
        </div>

        {sectionSize > 1 && (
          <span className={styles.priority} data-cell-id={`priority-${resource.id}`}>
            Ưu tiên {index + 1}
          </span>
        )}

        {canReorder && (
          <div className={styles.reorder}>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onMove(-1)}
              disabled={index === 0}
              aria-label={`Nâng ưu tiên ${resource.name}`}
              data-cell-id={`move-up-${resource.id}`}
            >
              <Icon name="chevronDown" size="xs" className={styles.iconUp} />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onMove(1)}
              disabled={index === sectionSize - 1}
              aria-label={`Hạ ưu tiên ${resource.name}`}
              data-cell-id={`move-down-${resource.id}`}
            >
              <Icon name="chevronDown" size="xs" />
            </Button>
          </div>
        )}

        <Toggle
          checked={enabled}
          onChange={handleToggle}
          ariaLabel={enabled ? `Tắt ${resource.name}` : `Bật ${resource.name}`}
          dataTestId={`enable-toggle-${resource.id}`}
        />

        <Button
          variant="ghost"
          size="sm"
          onClick={onDelete}
          aria-label={`Xóa ${resource.name}`}
          data-cell-id={`delete-button-${resource.id}`}
        >
          <Icon name="trash" size="xs" />
        </Button>
      </div>

      {expanded && <ResourceDetail resource={resource} onChanged={onChanged} />}
    </Card>
  );
}

export function ResourceCardSkeleton(): ReactElement {
  return <div className={styles.skeleton} data-cell-id="resource-card-skeleton" aria-hidden="true" />;
}
