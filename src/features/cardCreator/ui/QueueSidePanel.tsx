import type { ReactElement } from 'react';
import { CardCreatorSidePanel } from './CardCreatorSidePanel';
import { QueueSidebar } from './QueueSidebar';
import { t } from '@/shared/i18n';
import type { CardCreatorQueueItem, Toast } from '../types';

interface QueueSidePanelProps {
  /** Whether the panel is open. */
  readonly open: boolean;
  /** Called when the panel should close. */
  readonly onClose: () => void;
  /** Queue items (I+N review flow). */
  readonly queueItems: readonly CardCreatorQueueItem[];
  /** Active queue item index. */
  readonly queueActiveIndex: number;
  /** Select a queue item by index (switches prefill + closes the panel). */
  readonly onSelectQueueItem: (index: number) => void;
  /** Delete a queue item by index. Shows undo toast for 3s. */
  readonly onDeleteQueueItem: (index: number) => void;
  /** Undo the last queue item deletion (within 3s window). */
  readonly onUndoDeleteQueueItem: () => void;
  /** Active toasts (used to detect a recent delete for the undo button). */
  readonly toasts: readonly Toast[];
  /** Dismiss a toast by id. */
  readonly onDismissToast: (id: number) => void;
}

/**
 * QueueSidePanel — slide-in overlay showing the I+N review queue for the
 * integrated Card Creator. Slides in from the right via the shared
 * CardCreatorSidePanel shell (same mechanism as the settings panel).
 *
 * Selecting an item switches prefill AND closes the panel (jump-to-fill is
 * the primary action); deleting keeps it open for pruning multiple items.
 */
export function QueueSidePanel({
  open,
  onClose,
  queueItems,
  queueActiveIndex,
  onSelectQueueItem,
  onDeleteQueueItem,
  onUndoDeleteQueueItem,
  toasts,
  onDismissToast,
}: QueueSidePanelProps): ReactElement | null {
  return (
    <CardCreatorSidePanel
      open={open}
      onClose={onClose}
      side="right"
      ariaLabel={t('cardCreator.queue.aria')}
      dataCellId="cc-queue-panel"
      flushContent
    >
      <QueueSidebar
        overlay
        queueItems={queueItems}
        queueActiveIndex={queueActiveIndex}
        onSelectQueueItem={(index) => {
          onSelectQueueItem(index);
          onClose();
        }}
        onDeleteQueueItem={onDeleteQueueItem}
        onUndoDeleteQueueItem={onUndoDeleteQueueItem}
        toasts={toasts}
        onDismissToast={onDismissToast}
      />
    </CardCreatorSidePanel>
  );
}
