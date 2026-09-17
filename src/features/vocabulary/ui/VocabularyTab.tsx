import { Fragment, useCallback, useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { Alert } from '@/shared/ui/Alert';
import { Button } from '@/shared/ui/Button';
import { Chip } from '@/shared/ui/Chip';
import { Dialog } from '@/shared/ui/Dialog';
import { EmptyState } from '@/shared/ui/EmptyState';
import { Icon } from '@/shared/icons/Icon';
import { Pagination } from '@/shared/ui/Pagination';
import { SearchField } from '@/shared/ui/SearchField';
import { Select } from '@/shared/ui/Select';
import { Timestamp } from '@/shared/ui/Timestamp';
import { t, type MessageKey } from '@/shared/i18n';
import { STATUS_CYCLE, type WordStatus } from '@/entities/dictionary';
import { createVocabularySource } from '../services/vocabularySource';
import {
  selectEntries,
  paginateEntries,
  type VocabularySort,
} from '../logic/vocabularyList';
import styles from './VocabularyTab.module.css';

const PAGE_SIZE = 200;

const STATUS_LABEL: Record<WordStatus, MessageKey> = {
  unknown: 'vocabulary.status.unknown',
  tracking: 'vocabulary.status.tracking',
  known: 'vocabulary.status.known',
  ignore: 'vocabulary.status.ignore',
};

const STATUS_CLASS: Record<WordStatus, string> = {
  unknown: styles.statusUnknown,
  tracking: styles.statusTracking,
  known: styles.statusKnown,
  ignore: styles.statusIgnore,
};

export interface VocabularyTabProps {
  /** Base-2 language of the active profile — source refetches when it changes. */
  readonly langCode: string;
  /** Called when a term row is clicked — parent switches to Dictionary lookup. */
  readonly onLookup: (term: string) => void;
}

export function VocabularyTab({ langCode, onLookup }: VocabularyTabProps): React.JSX.Element {
  const source = useMemo(() => createVocabularySource(langCode), [langCode]);
  useEffect(() => () => source.destroy(), [source]);

  const subscribe = useCallback(
    (listener: () => void) => source.subscribe(listener),
    [source],
  );
  const getSnapshot = useCallback(() => source.getState(), [source]);
  const state = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  const [statuses, setStatuses] = useState<ReadonlySet<WordStatus>>(() => new Set(STATUS_CYCLE));
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<VocabularySort>('recent');
  const [pageIndex, setPageIndex] = useState(0);
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setStatuses(new Set(STATUS_CYCLE));
    setQuery('');
    setSort('recent');
    setPageIndex(0);
    setError(null);
  }, [langCode]);

  const sorted = useMemo(
    () => selectEntries(state.entries, { statuses, query }, sort),
    [state.entries, statuses, query, sort],
  );
  const page = useMemo(() => paginateEntries(sorted, PAGE_SIZE, pageIndex), [sorted, pageIndex]);

  useEffect(() => {
    if (page.pageIndex !== pageIndex) setPageIndex(page.pageIndex);
  }, [page.pageIndex, pageIndex]);

  const toggleStatus = (status: WordStatus): void => {
    const next = new Set(statuses);
    if (next.has(status)) next.delete(status);
    else next.add(status);
    setStatuses(next);
    setPageIndex(0);
  };

  const handleCycle = (term: string): void => {
    source.cycle(term).catch((err: unknown) => {
      setError(err instanceof Error ? err.message : String(err));
    });
  };

  const confirmDelete = (): void => {
    const term = pendingDelete;
    setPendingDelete(null);
    if (term === null) return;
    source.remove(term).catch((err: unknown) => {
      setError(err instanceof Error ? err.message : String(err));
    });
  };

  let lastGroup: WordStatus | null = null;

  return (
    <div className={styles.tab} data-cell-id="vocabulary-tab">
      <div className={styles.controls}>
        <div className={styles.chips}>
          {STATUS_CYCLE.map((status) => (
            <Chip
              key={status}
              as="button"
              size="sm"
              selected={statuses.has(status)}
              onClick={() => toggleStatus(status)}
              className={STATUS_CLASS[status]}
              data-cell-id={`vocabulary-filter-${status}`}
            >
              {t(STATUS_LABEL[status])}
            </Chip>
          ))}
        </div>
        <div className={styles.controlsRow}>
          <SearchField
            value={query}
            onChange={(value) => { setQuery(value); setPageIndex(0); }}
            placeholder={t('vocabulary.search.placeholder')}
            className={styles.search}
            data-cell-id="vocabulary-search"
          />
          <Select
            value={sort}
            onChange={(value) => { setSort(value as VocabularySort); setPageIndex(0); }}
            options={[
              { value: 'recent', label: t('vocabulary.sort.recent') },
              { value: 'alpha', label: t('vocabulary.sort.alpha') },
              { value: 'grouped', label: t('vocabulary.sort.grouped') },
            ]}
            size="sm"
            aria-label={t('vocabulary.sort.label')}
            data-cell-id="vocabulary-sort"
          />
        </div>
      </div>

      {error && (
        <Alert
          variant="error"
          description={error}
          onDismiss={() => setError(null)}
          className={styles.error}
        />
      )}

      {!state.loaded ? null : state.entries.length === 0 ? (
        <EmptyState title={t('vocabulary.empty')} size="compact" />
      ) : page.entries.length === 0 ? (
        <EmptyState title={t('vocabulary.emptyFiltered')} size="compact" />
      ) : (
        <>
          <ul className={styles.list}>
            {page.entries.map((entry) => {
              const groupHeader = sort === 'grouped' && entry.status !== lastGroup
                ? (lastGroup = entry.status, (
                    <li key={`group-${entry.status}`} className={styles.groupHeader}>
                      {t(STATUS_LABEL[entry.status])}
                    </li>
                  ))
                : null;
              return (
                <Fragment key={entry.term}>
                  {groupHeader}
                  <li className={styles.row} data-cell-id={`vocabulary-row-${entry.term}`}>
                    <div className={styles.rowBody}>
                    <Button
                      variant="ghost"
                      className={styles.term}
                      onClick={() => onLookup(entry.term)}
                      data-cell-id={`vocabulary-term-${entry.term}`}
                    >
                      {entry.term}
                    </Button>
                    <Timestamp value={entry.updatedAt} format="absolute" className={styles.time} />
                    <Button
                      variant="ghost"
                      size="sm"
                      shape="pill"
                      className={`${styles.statusBadge} ${STATUS_CLASS[entry.status]}`}
                      aria-label={t('vocabulary.row.cycle', [entry.term])}
                      onClick={() => handleCycle(entry.term)}
                      data-cell-id={`vocabulary-cycle-${entry.term}`}
                    >
                      {t(STATUS_LABEL[entry.status])}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      shape="circle"
                      aria-label={t('vocabulary.row.remove', [entry.term])}
                      onClick={() => setPendingDelete(entry.term)}
                      data-cell-id={`vocabulary-delete-${entry.term}`}
                    >
                      <Icon name="trash" />
                    </Button>
                    </div>
                  </li>
                </Fragment>
              );
            })}
          </ul>
          <Pagination
            current={page.pageIndex}
            total={page.pageCount}
            onChange={setPageIndex}
            showJump={false}
            className={styles.pagination}
          />
        </>
      )}

      <Dialog
        open={pendingDelete !== null}
        onOpenChange={(open) => { if (!open) setPendingDelete(null); }}
        title={t('vocabulary.delete.title')}
        description={t('vocabulary.delete.description', [pendingDelete ?? ''])}
        showCloseButton
        data-cell-id="vocabulary-delete-dialog"
        footer={(
          <>
            <Button variant="ghost" onClick={() => setPendingDelete(null)}>
              {t('vocabulary.delete.cancel')}
            </Button>
            <Button variant="destructive" onClick={confirmDelete} data-cell-id="vocabulary-delete-confirm">
              {t('vocabulary.delete.confirm')}
            </Button>
          </>
        )}
      />
    </div>
  );
}
