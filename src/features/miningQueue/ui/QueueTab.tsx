import { useCallback, useEffect, useState } from 'react';
import {
  Button,
  Chip,
  EmptyState,
  Icon,
  IconButton,
  SectionHeader,
  Spinner,
  Text,
} from '@/shared/ui';
import { t } from '@/shared/i18n';
import type { MiningQueueItem, MiningQueueRow } from '@/entities/miningQueue';
import { queueGet, queueList, queueRemove, onQueueChanged } from '../services/miningQueueClient';
import styles from './QueueTab.module.css';

export interface QueueTabProps {
  /** Cardify: mount fetches the full item and replays it into card creator. */
  readonly onCardify: (item: MiningQueueItem) => void;
  /** Quick-add (term rows only): replay through the configured sink. */
  readonly onQuickAdd: (item: MiningQueueItem) => void;
  /** Surface a failed action (toast etc.). */
  readonly onActionError?: (message: string) => void;
}

function formatAge(createdAt: number, now: number): string {
  const diffMin = Math.floor((now - createdAt) / 60_000);
  if (diffMin < 1) return t('queue.age.now');
  if (diffMin < 60) return t('queue.age.minutes', [String(diffMin)]);
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return t('queue.age.hours', [String(diffHr)]);
  const diffDay = Math.floor(diffHr / 24);
  return t('queue.age.days', [String(diffDay)]);
}

function formatCueTime(ms: number): string {
  const total = Math.floor(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function QueueRow({
  row,
  now,
  onCardify,
  onQuickAdd,
  onDiscard,
}: {
  readonly row: MiningQueueRow;
  readonly now: number;
  readonly onCardify: (id: string) => void;
  readonly onQuickAdd: (id: string) => void;
  readonly onDiscard: (id: string) => void;
}) {
  return (
    <li className={styles.row} data-cell-id="queue-row" data-queue-id={row.id}>
      <div className={styles.rowMain}>
        <div className={styles.rowTerm}>
          <Chip size="sm" color={row.kind === 'term' ? 'primary' : undefined} as="span">
            {row.kind === 'term' ? t('queue.kind.term') : t('queue.kind.sentence')}
          </Chip>
          {row.term && (
            <Text as="span" variant="label" className={styles.term}>
              {row.term}
              {row.pos ? ` · ${row.pos}` : ''}
            </Text>
          )}
        </div>
        <Text as="span" variant="label" className={styles.sentence}>
          {row.sentence}
        </Text>
        <Text as="span" variant="supporting" color="secondary" className={styles.rowMeta}>
          {row.sourceLabel ?? t('queue.source.unknown')}
          {row.cueStart !== undefined ? ` · ${formatCueTime(row.cueStart)}` : ''}
          {' · '}
          {formatAge(row.createdAt, now)}
        </Text>
      </div>
      <div className={styles.rowActions}>
        <IconButton
          size="sm"
          aria-label={t('queue.action.cardify')}
          title={t('queue.action.cardify')}
          onClick={() => onCardify(row.id)}
          data-cell-id="queue-cardify"
        >
          <Icon name="pencil" />
        </IconButton>
        {row.kind === 'term' && (
          <IconButton
            size="sm"
            aria-label={t('queue.action.quickAdd')}
            title={t('queue.action.quickAdd')}
            onClick={() => onQuickAdd(row.id)}
            data-cell-id="queue-quick-add"
          >
            <Icon name="zap" />
          </IconButton>
        )}
        <IconButton
          size="sm"
          aria-label={t('queue.action.discard')}
          title={t('queue.action.discard')}
          onClick={() => onDiscard(row.id)}
          data-cell-id="queue-discard"
        >
          <Icon name="trash2" />
        </IconButton>
      </div>
    </li>
  );
}

export function QueueTab({ onCardify, onQuickAdd, onActionError }: QueueTabProps) {
  const [rows, setRows] = useState<readonly MiningQueueRow[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());

  const refresh = useCallback((): void => {
    queueList()
      .then((list) => {
        setRows(list);
        setLoadError(null);
      })
      .catch((err: unknown) => {
        setLoadError(err instanceof Error ? err.message : String(err));
      });
  }, []);

  useEffect(() => {
    refresh();
    const unsub = onQueueChanged(() => {
      refresh();
      setNow(Date.now());
    });
    const timer = setInterval(() => setNow(Date.now()), 60_000);
    return () => {
      unsub();
      clearInterval(timer);
    };
  }, [refresh]);

  const withItem = useCallback(
    (fn: (item: MiningQueueItem) => void) =>
      (id: string): void => {
        queueGet(id)
          .then((item) => {
            if (item) {
              fn(item);
            } else {
              refresh();
              onActionError?.(t('queue.error.missing'));
            }
          })
          .catch((err: unknown) => {
            onActionError?.(err instanceof Error ? err.message : String(err));
          });
      },
    [onActionError, refresh],
  );

  const handleDiscard = useCallback(
    (id: string): void => {
      setRows((prev) => prev?.filter((r) => r.id !== id) ?? prev);
      queueRemove(id).catch((err: unknown) => {
        refresh();
        onActionError?.(err instanceof Error ? err.message : String(err));
      });
    },
    [onActionError, refresh],
  );

  return (
    <div className={styles.tabPane} data-cell-id="queue-tab">
      <div className={styles.tabHeader}>
        <SectionHeader
          title={t('queue.title')}
          subtitle={rows ? t('queue.count', [String(rows.length)]) : undefined}
        />
      </div>
      <div className={styles.scrollport} role="list" aria-label={t('queue.title')}>
        {rows === null && !loadError && (
          <div className={styles.centerState}>
            <Spinner size="md" />
          </div>
        )}
        {loadError && (
          <div className={styles.centerState}>
            <EmptyState
              size="compact"
              icon={<Icon name="alertCircle" />}
              title={t('queue.error.loadTitle')}
              description={loadError}
            />
            <Button variant="outline" size="sm" onClick={refresh} data-cell-id="queue-retry">
              {t('queue.action.retry')}
            </Button>
          </div>
        )}
        {rows?.length === 0 && (
          <EmptyState
            size="compact"
            icon={<Icon name="layers" />}
            title={t('queue.empty.title')}
            description={t('queue.empty.desc')}
          />
        )}
        {rows && rows.length > 0 && (
          <ul className={styles.list}>
            {rows.map((row) => (
              <QueueRow
                key={row.id}
                row={row}
                now={now}
                onCardify={withItem(onCardify)}
                onQuickAdd={withItem(onQuickAdd)}
                onDiscard={handleDiscard}
              />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
