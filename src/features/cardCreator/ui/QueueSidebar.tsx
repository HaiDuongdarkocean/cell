/**
 * QueueSidebar — right sidebar for the I+N review flow in Card Creator.
 *
 * Shows a list of unknown/tracking words from the current subtitle line.
 * Each item has a status badge + delete (×) button. Clicking an item
 * switches the dialog's prefill. The sidebar can be toggled open/closed
 * via the toggle icon in the dialog header (next to close button).
 *
 * BEM block: .cc-queue
 */
import type { ReactElement } from 'react';
import { Button } from '@/shared/ui/Button';

import { useRef, useCallback } from 'react';
import { Icon } from '@/shared/ui/Icon';
import type { CardCreatorQueueItem, Toast } from '../types';
import styles from './QueueSidebar.module.css';

interface QueueSidebarProps {
  /** Queue items (I+N review flow). */
  queueItems: readonly CardCreatorQueueItem[];
  /** Active queue item index. */
  queueActiveIndex: number;
  /** Select a queue item by index (switches prefill). */
  onSelectQueueItem: (index: number) => void;
  /** Delete a queue item by index. Shows undo toast for 3s. */
  onDeleteQueueItem: (index: number) => void;
  /** Undo the last queue item deletion (within 3s window). */
  onUndoDeleteQueueItem: () => void;
  /** Active toasts (used to detect a recent delete for the undo button). */
  toasts: readonly Toast[];
  /** Dismiss a toast by id. */
  onDismissToast: (id: number) => void;
  /** Mobile layout: render as a capped top strip instead of a right rail. */
  mobile?: boolean;
}

export function QueueSidebar({
  queueItems,
  queueActiveIndex,
  onSelectQueueItem,
  onDeleteQueueItem,
  onUndoDeleteQueueItem,
  toasts,
  onDismissToast,
  mobile = false,
}: QueueSidebarProps): ReactElement {
  const asideRef = useRef<HTMLElement>(null);

  const focusAt = useCallback((elements: Element[], index: number): void => {
    if (index >= 0 && index < elements.length) {
      (elements[index] as HTMLElement).focus();
    }
  }, []);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLElement>): void => {
      if (!asideRef.current) return;
      const focusable = Array.from(asideRef.current.querySelectorAll('button, [tabindex="0"]'));
      const active = document.activeElement;
      const currentIndex = active ? focusable.indexOf(active) : -1;

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        focusAt(focusable, currentIndex + 1);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        focusAt(focusable, currentIndex - 1);
      } else if (e.key === 'Home') {
        e.preventDefault();
        focusAt(focusable, 0);
      } else if (e.key === 'End') {
        e.preventDefault();
        focusAt(focusable, focusable.length - 1);
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        const listItem = active?.closest('li');
        const rawIndex = listItem?.getAttribute('data-index');
        if (rawIndex != null) {
          e.preventDefault();
          const index = Number(rawIndex);
          if (!Number.isNaN(index)) {
            onDeleteQueueItem(index);
          }
        }
      }
    },
    [focusAt, onDeleteQueueItem],
  );

  if (queueItems.length === 0) return <></>;

  return (
    <aside
      ref={asideRef}
      className={`${styles['cc-queue']}${mobile ? ` ${styles['cc-queue--mobile']}` : ''}`}
      aria-label="Card creator queue"
      onKeyDown={handleKeyDown}
      data-cell-id="cc-queue-sidebar"
    >
      <div className={styles['cc-queue__header']}>
        <span className={styles['cc-queue__title']}>
          Queue ({queueActiveIndex + 1}/{queueItems.length})
        </span>
      </div>
      <ul className={styles['cc-queue__list']} aria-label="Queue items">
        {queueItems.map((item, i) => (
          <QueueItemRow
            key={`${item.term}-${i}`}
            item={item}
            index={i}
            isActive={i === queueActiveIndex}
            onSelect={() => onSelectQueueItem(i)}
            onDelete={() => onDeleteQueueItem(i)}
          />
        ))}
      </ul>
      {/* Undo button — shown when there's a pending undo (3s window).
          Uses the last warning toast as a proxy for "just deleted". */}
      <UndoButton onUndo={onUndoDeleteQueueItem} toasts={toasts} onDismissToast={onDismissToast} />
    </aside>
  );
}

interface QueueItemRowProps {
  item: CardCreatorQueueItem;
  index: number;
  isActive: boolean;
  onSelect: () => void;
  onDelete: () => void;
}

function QueueItemRow({ item, index, isActive, onSelect, onDelete }: QueueItemRowProps): ReactElement {
  return (
    <li
      className={`${styles['cc-queue__item']} ${isActive ? styles['cc-queue__item--active'] : ''}`}
      data-index={index}
      data-cell-id={`cc-queue-item-${index}`}
    >
      <Button variant="secondary"
        className={styles['cc-queue__item-btn']}
        onClick={onSelect}
        aria-label={`Select ${item.term}`}
        aria-current={isActive ? 'true' : undefined}
      >
        <span className={styles['cc-queue__item-term']}>{item.term}</span>
        <span
          className={`${styles['cc-queue__item-badge']} ${styles[`cc-queue__item-badge--${item.status}`]}`}
        >
          {item.status}
        </span>
      </Button>
      <Button shape="circle" variant="ghost"
        className={styles['cc-queue__item-delete']}
        onClick={onDelete}
        aria-label={`Remove ${item.term} from queue`}
        data-cell-id={`cc-queue-delete-${index}`}
      >
        <Icon name="x" className={styles['cc-queue__item-delete-icon']} />
      </Button>
    </li>
  );
}

interface UndoButtonProps {
  onUndo: () => void;
  toasts: readonly Toast[];
  onDismissToast: (id: number) => void;
}

/** Shows an undo button when the latest toast is a warning containing "Removed".
 *  Clicking it calls onUndo + dismisses the toast. */
function UndoButton({ onUndo, toasts, onDismissToast }: UndoButtonProps): ReactElement | null {
  const lastToast = toasts[toasts.length - 1];
  if (!lastToast || lastToast.kind !== 'warning' || !lastToast.message.includes('Removed')) return null;
  return (
    <Button variant="secondary"
      className={styles['cc-queue__undo']}
      onClick={() => {
        onUndo();
        onDismissToast(lastToast.id);
      }}
      aria-label="Undo last deletion"
      data-cell-id="cc-queue-undo"
    >
      <Icon name="rotateCcw" className={styles['cc-queue__undo-icon']} />
      Undo
    </Button>
  );
}
