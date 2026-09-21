// ResourceCard — resource list item (spec F11 + Resources management upgrade).
//
// Row: left-edge DragHandle (6-dot grip — pointer drag is orchestrated by the
// section via useSectionDrag; ArrowUp/Down = keyboard fallback) · name/meta
// button (idle: toggles the samples detail; section edit mode: toggles
// selection) · enable Toggle · icon-only delete (edit mode only — the idle
// list carries no delete affordances).
// Expanded body (ResourceDetail): sample entries.
// Disabled resources are dimmed visually — controls stay usable.

import { useRef, useState, type ReactElement } from 'react';
import { Button, Card } from '@/shared/ui';
import { DragHandle } from '@/shared/ui/DragHandle';
import { Toggle } from '@/shared/ui/Toggle';
import { Icon } from '@/shared/ui/Icon';
import { setResourceEnabled } from '@/features/dictionary/services/resourceClient';
import type { ResourceInfo } from '@/entities/dictionary';
import { displayResourceName } from './displayResourceName';
import { ResourceDetail } from './ResourceDetail';
import styles from './ResourceCard.module.css';

interface ResourceCardProps {
  readonly resource: ResourceInfo;
  /** Total resources in the section — reorder needs >1. */
  readonly sectionSize: number;
  readonly onDelete: () => void;
  /** Keyboard reorder within the section: -1 = up (higher priority), +1 = down. */
  readonly onMove?: (direction: -1 | 1) => void;
  /** Grip pointerdown → the section's useSectionDrag takes over the session. */
  readonly onGripPointerDown?: (e: React.PointerEvent<HTMLElement>) => void;
  /** Section drag session is lifting this card (ghost styling). */
  readonly dragging?: boolean;
  /** Called after card-side mutations (enable toggle) to refresh. */
  readonly onChanged?: () => void;
  /** Section edit mode: name/meta toggles selection; delete + grip appear. */
  readonly editing?: boolean;
  readonly selected?: boolean;
  readonly onSelect?: () => void;
}

export function ResourceCard({
  resource,
  sectionSize,
  onDelete,
  onMove,
  onGripPointerDown,
  dragging = false,
  onChanged,
  editing = false,
  selected = false,
  onSelect,
}: ResourceCardProps): ReactElement {
  const enabled = resource.enabled !== false;
  const [expanded, setExpanded] = useState(false);
  const [toggling, setToggling] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const displayName = displayResourceName(resource.name);

  const handleToggle = (next: boolean): void => {
    if (resource.id == null || toggling) return;
    setToggling(true);
    void setResourceEnabled(resource.langCode, resource.id, next)
      .then(() => onChanged?.())
      .catch(() => { /* refresh restores the persisted state */ onChanged?.(); })
      .finally(() => setToggling(false));
  };

  const canReorder = sectionSize > 1 && !editing && onGripPointerDown != null;

  const onGripKeyDown = (e: React.KeyboardEvent<HTMLDivElement>): void => {
    if (!onMove) return;
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      onMove(-1);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      onMove(1);
    }
  };

  return (
    <Card
      ref={cardRef}
      variant={editing && selected ? 'selected' : 'default'}
      className={`${styles.card} ${enabled ? '' : styles.cardDisabled} ${dragging ? styles.cardDragging : ''}`}
      data-cell-id={`resource-card-${resource.id}`}
    >
      <div className={styles.row}>
        {canReorder && (
          <DragHandle
            size="sm"
            aria-label={`Kéo để đổi thứ tự ${displayName}`}
            draggable={false}
            className={styles.grip}
            data-cell-id={`drag-${resource.id}`}
            onPointerDown={onGripPointerDown}
            onKeyDown={onGripKeyDown}
          />
        )}

        <button
          type="button"
          className={styles.info}
          onClick={editing ? onSelect : () => setExpanded((v) => !v)}
          aria-expanded={editing ? undefined : expanded}
          aria-pressed={editing ? selected : undefined}
          aria-label={editing
            ? `Chọn ${displayName}`
            : expanded ? `Thu gọn ${displayName}` : `Xem mục mẫu ${displayName}`}
          data-cell-id={editing ? `select-${resource.id}` : `expand-${resource.id}`}
        >
          <span className={styles.name}>{displayName}</span>
          <span className={styles.meta}>
            {resource.wordCount} từ{!resource.installationFinished && ' · đang thêm…'}
          </span>
        </button>

        <Toggle
          checked={enabled}
          onChange={handleToggle}
          ariaLabel={enabled ? `Tắt ${displayName}` : `Bật ${displayName}`}
          dataTestId={`enable-toggle-${resource.id}`}
        />

        {editing && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onDelete}
            aria-label={`Xóa ${displayName}`}
            data-cell-id={`delete-button-${resource.id}`}
          >
            <Icon name="trash" size="xs" />
          </Button>
        )}
      </div>

      {expanded && <ResourceDetail resource={resource} />}
    </Card>
  );
}

export function ResourceCardSkeleton(): ReactElement {
  return <div className={styles.skeleton} data-cell-id="resource-card-skeleton" aria-hidden="true" />;
}
