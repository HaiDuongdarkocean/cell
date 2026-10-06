import {
  Fragment,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';
import { Alert } from '@/shared/ui/Alert';
import { Button } from '@/shared/ui/Button';
import { Dialog } from '@/shared/ui/Dialog';
import { EmptyState } from '@/shared/ui/EmptyState';
import { Icon } from '@/shared/ui/Icon';
import { Pagination } from '@/shared/ui/Pagination';
import { Menu, MenuItem, MenuSeparator } from '@/shared/ui/Menu';
import { SearchField } from '@/shared/ui/SearchField';
import { Text } from '@/shared/ui/Text';
import { t, type MessageKey } from '@/shared/i18n';
import { TRASH_TTL_MS } from '@/features/dictionary';
import { type WordStatus } from '@/entities/dictionary';
import {
  createVocabularySource,
  type VocabularySource,
  type VocabularySourceState,
} from '../services/vocabularySource';
import {
  VOCABULARY_SEGMENTS,
  countByStatus,
  filterTrashEntries,
  selectEntries,
  paginateEntries,
  statusesForSegment,
  trashHoursLeft,
  type VocabularySegment,
  type VocabularySort,
} from '../logic/vocabularyList';
import styles from './VocabularyTab.module.css';

const PAGE_SIZE = 200;

const STATUS_LABEL: Record<WordStatus, MessageKey> = {
  unknown: 'vocabulary.status.unknown',
  tracking: 'vocabulary.status.tracking',
  learning: 'vocabulary.status.learning',
  known: 'vocabulary.status.known',
  ignore: 'vocabulary.status.ignore',
};

const STATUS_CLASS: Record<WordStatus, string> = {
  unknown: styles.statusUnknown,
  tracking: styles.statusTracking,
  learning: styles.statusLearning,
  known: styles.statusKnown,
  ignore: styles.statusIgnore,
};

const SEGMENT_LABEL: Record<VocabularySegment, MessageKey> = {
  all: 'vocabulary.segment.all',
  tracking: 'vocabulary.status.tracking',
  learning: 'vocabulary.status.learning',
  known: 'vocabulary.status.known',
  ignore: 'vocabulary.status.ignore',
  trash: 'vocabulary.segment.trash',
};

const SORT_OPTIONS: readonly { value: VocabularySort; label: MessageKey }[] = [
  { value: 'recent', label: 'vocabulary.sort.recent' },
  { value: 'alpha', label: 'vocabulary.sort.alpha' },
  { value: 'grouped', label: 'vocabulary.sort.grouped' },
];

type ToolbarMenu = 'filter' | 'sort';

export interface VocabularyTabProps {
  /** Base-2 language of the active profile — source refetches when it changes. */
  readonly langCode: string;
  /** Called when a term row is clicked — parent switches to Dictionary lookup. */
  readonly onLookup: (term: string) => void;
}

const EMPTY_SOURCE_STATE: VocabularySourceState = { entries: [], trash: [], loaded: false };

export function VocabularyTab({ langCode, onLookup }: VocabularyTabProps): React.JSX.Element {
  const [source, setSource] = useState<VocabularySource | null>(null);
  useEffect(() => {
    const next = createVocabularySource(langCode);
    setSource(next);
    return () => {
      setSource(null);
      next.destroy();
    };
  }, [langCode]);

  const subscribe = useCallback(
    (listener: () => void) => source?.subscribe(listener) ?? (() => {}),
    [source],
  );
  const getSnapshot = useCallback(() => source?.getState() ?? EMPTY_SOURCE_STATE, [source]);
  const state = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  const [segment, setSegment] = useState<VocabularySegment>('all');
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<VocabularySort>('recent');
  const [pageIndex, setPageIndex] = useState(0);
  const [editMode, setEditMode] = useState(false);
  const [menu, setMenu] = useState<ToolbarMenu | null>(null);
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);
  const [pendingPurge, setPendingPurge] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const rootRef = useRef<HTMLDivElement>(null);
  const filterTriggerRef = useRef<HTMLButtonElement>(null);
  const sortTriggerRef = useRef<HTMLButtonElement>(null);

  const inTrash = segment === 'trash';

  useEffect(() => {
    setSegment('all');
    setQuery('');
    setSort('recent');
    setPageIndex(0);
    setEditMode(false);
    setMenu(null);
    setError(null);
  }, [langCode]);

  useEffect(() => {
    if (inTrash && source) {
      source.refreshTrash().catch((err: unknown) => {
        setError(err instanceof Error ? err.message : String(err));
      });
    }
  }, [inTrash, source]);

  const closeMenu = useCallback(() => setMenu(null), []);

  const statusCounts = useMemo(() => countByStatus(state.entries), [state.entries]);
  const segmentCounts = useMemo<Record<VocabularySegment, number>>(
    () => ({
      all: state.entries.length,
      tracking: statusCounts.tracking,
      learning: statusCounts.learning,
      known: statusCounts.known,
      ignore: statusCounts.ignore,
      trash: state.trash.length,
    }),
    [state.entries.length, statusCounts, state.trash.length],
  );

  const sorted = useMemo(
    () => selectEntries(state.entries, { statuses: statusesForSegment(segment), query }, sort),
    [state.entries, segment, query, sort],
  );
  const page = useMemo(() => paginateEntries(sorted, PAGE_SIZE, pageIndex), [sorted, pageIndex]);

  const trashVisible = useMemo(() => filterTrashEntries(state.trash, query), [state.trash, query]);
  const trashPage = useMemo(
    () => paginateEntries(trashVisible, PAGE_SIZE, pageIndex),
    [trashVisible, pageIndex],
  );

  useEffect(() => {
    if (page.pageIndex !== pageIndex) setPageIndex(page.pageIndex);
  }, [page.pageIndex, pageIndex]);

  const handleSegmentChange = (value: VocabularySegment): void => {
    setSegment(value);
    setPageIndex(0);
    setEditMode(false);
    setMenu(null);
  };

  const handleCycle = (term: string): void => {
    source?.cycle(term).catch((err: unknown) => {
      setError(err instanceof Error ? err.message : String(err));
    });
  };

  const confirmDelete = (): void => {
    const term = pendingDelete;
    setPendingDelete(null);
    if (term === null) return;
    source?.trash(term).catch((err: unknown) => {
      setError(err instanceof Error ? err.message : String(err));
    });
  };

  const handleRestore = (term: string): void => {
    source?.restore(term).catch((err: unknown) => {
      setError(err instanceof Error ? err.message : String(err));
    });
  };

  const confirmPurge = (): void => {
    const term = pendingPurge;
    setPendingPurge(null);
    if (term === null) return;
    source?.deleteTrash(term).catch((err: unknown) => {
      setError(err instanceof Error ? err.message : String(err));
    });
  };

  const filterSegments = VOCABULARY_SEGMENTS.filter((s) => s !== 'trash');
  const activeSort = SORT_OPTIONS.find((o) => o.value === sort) ?? SORT_OPTIONS[0]!;

  let lastGroup: WordStatus | null = null;

  return (
    <div ref={rootRef} className={styles.tab} data-cell-id="vocabulary-tab">
      <div className={styles.toolbar}>
        <Button
          ref={filterTriggerRef}
          variant="ghost"
          size="sm"
          className={styles.toolBtn}
          aria-haspopup="menu"
          aria-expanded={menu === 'filter'}
          aria-label={t('vocabulary.segment.label')}
          onClick={() => setMenu(menu === 'filter' ? null : 'filter')}
          data-cell-id="vocabulary-filter"
        >
          <Icon name="slidersHorizontal" size="xs" />
          {t(SEGMENT_LABEL[segment])}
          <Icon name="chevronDown" size={14} />
        </Button>
        {!inTrash && (
          <Button
            ref={sortTriggerRef}
            variant="ghost"
            size="sm"
            className={styles.toolBtn}
            aria-haspopup="menu"
            aria-expanded={menu === 'sort'}
            aria-label={t('vocabulary.sort.label')}
            onClick={() => setMenu(menu === 'sort' ? null : 'sort')}
            data-cell-id="vocabulary-sort"
          >
            {t(activeSort.label)}
            <Icon name="chevronDown" size={14} />
          </Button>
        )}
        <span className={styles.toolbarSpacer} />
        {!inTrash && (
          <Button
            variant="ghost"
            size="sm"
            className={styles.toolBtn}
            aria-pressed={editMode}
            onClick={() => setEditMode((v) => !v)}
            data-cell-id="vocabulary-edit-toggle"
          >
            <Icon name="pencil" size="xs" />
            {editMode ? t('vocabulary.done') : t('vocabulary.edit')}
          </Button>
        )}
      </div>

      <Menu
        open={menu === 'filter'}
        onClose={closeMenu}
        triggerRef={filterTriggerRef}
        ariaLabel={t('vocabulary.segment.label')}
      >
        {filterSegments.map((s) => (
          <MenuItem
            key={s}
            radio
            selected={segment === s}
            onSelect={() => handleSegmentChange(s)}
            data-cell-id={`vocabulary-segment-${s}`}
            trailing={
              <span data-cell-id={`vocabulary-segment-count-${s}`}>{segmentCounts[s]}</span>
            }
          >
            {t(SEGMENT_LABEL[s])}
          </MenuItem>
        ))}
        <MenuSeparator />
        <MenuItem
          radio
          selected={inTrash}
          icon={<Icon name="trash2" size="xs" />}
          onSelect={() => handleSegmentChange('trash')}
          data-cell-id="vocabulary-segment-trash"
          trailing={
            <span data-cell-id="vocabulary-segment-count-trash">{segmentCounts.trash}</span>
          }
        >
          {t('vocabulary.segment.trash')}
        </MenuItem>
      </Menu>

      <Menu
        open={menu === 'sort'}
        onClose={closeMenu}
        triggerRef={sortTriggerRef}
        ariaLabel={t('vocabulary.sort.label')}
      >
        {SORT_OPTIONS.map((o) => (
          <MenuItem
            key={o.value}
            radio
            selected={sort === o.value}
            onSelect={() => {
              setSort(o.value);
              setPageIndex(0);
              setMenu(null);
            }}
            data-cell-id={`vocabulary-sort-${o.value}`}
            trailing={sort === o.value ? <Icon name="check" size="xs" /> : undefined}
          >
            {t(o.label)}
          </MenuItem>
        ))}
      </Menu>

      <SearchField
        value={query}
        onChange={(value) => {
          setQuery(value);
          setPageIndex(0);
        }}
        placeholder={t('vocabulary.search.placeholder')}
        className={styles.search}
        data-cell-id="vocabulary-search"
      />

      {error && (
        <Alert
          variant="error"
          description={error}
          onDismiss={() => setError(null)}
          className={styles.error}
        />
      )}

      {!state.loaded ? null : inTrash ? (
        <>
          <Text variant="supporting" color="secondary" className={styles.retention}>
            {t('vocabulary.trash.retention')}
          </Text>
          {trashVisible.length === 0 ? (
            state.trash.length === 0 ? (
              <EmptyState
                title={t('vocabulary.emptyTrash')}
                size="compact"
                data-cell-id="vocabulary-trash-empty"
              />
            ) : (
              <EmptyState title={t('vocabulary.emptyFiltered')} size="compact" />
            )
          ) : (
            <>
              <ul className={styles.list}>
                {trashPage.entries.map((entry) => (
                  <li
                    key={entry.term}
                    className={styles.row}
                    data-cell-id={`vocabulary-trash-row-${entry.term}`}
                  >
                    <div className={styles.rowBody}>
                      <Button
                        variant="ghost"
                        className={styles.term}
                        title={entry.term}
                        onClick={() => onLookup(entry.term)}
                        data-cell-id={`vocabulary-term-${entry.term}`}
                      >
                        {entry.term}
                      </Button>
                      <span
                        className={`${styles.statusBadge} ${styles.statusBadgeStatic} ${STATUS_CLASS[entry.previousStatus]}`}
                      >
                        {t(STATUS_LABEL[entry.previousStatus])}
                      </span>
                      <Text variant="supporting" color="secondary" className={styles.time}>
                        {t('vocabulary.trash.expiresIn', [
                          String(trashHoursLeft(entry.trashedAt, Date.now(), TRASH_TTL_MS)),
                        ])}
                      </Text>
                      <Button
                        variant="ghost"
                        size="sm"
                        shape="circle"
                        onClick={() => handleRestore(entry.term)}
                        aria-label={t('vocabulary.row.restore', [entry.term])}
                        data-cell-id={`vocabulary-restore-${entry.term}`}
                      >
                        <Icon name="rotateCcw" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        shape="circle"
                        aria-label={t('vocabulary.row.deleteForever', [entry.term])}
                        onClick={() => setPendingPurge(entry.term)}
                        data-cell-id={`vocabulary-trash-delete-${entry.term}`}
                      >
                        <Icon name="x" />
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
              <Pagination
                current={trashPage.pageIndex}
                total={trashPage.pageCount}
                onChange={setPageIndex}
                showJump={false}
                className={styles.pagination}
              />
            </>
          )}
        </>
      ) : state.entries.length === 0 ? (
        <EmptyState title={t('vocabulary.empty')} size="compact" />
      ) : page.entries.length === 0 ? (
        <EmptyState title={t('vocabulary.emptyFiltered')} size="compact" />
      ) : (
        <>
          <ul className={styles.list}>
            {page.entries.map((entry) => {
              const groupHeader =
                sort === 'grouped' && entry.status !== lastGroup
                  ? ((lastGroup = entry.status),
                    (
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
                        title={entry.term}
                        onClick={() => onLookup(entry.term)}
                        data-cell-id={`vocabulary-term-${entry.term}`}
                      >
                        {entry.term}
                      </Button>
                      <Button
                        variant="transparent"
                        className={`${styles.statusBadge} ${STATUS_CLASS[entry.status]}`}
                        aria-label={t('vocabulary.row.cycle', [entry.term])}
                        onClick={() => handleCycle(entry.term)}
                        data-cell-id={`vocabulary-cycle-${entry.term}`}
                      >
                        {t(STATUS_LABEL[entry.status])}
                      </Button>
                      <span className={styles.actionSlot}>
                        {editMode && (
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
                        )}
                      </span>
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
        onOpenChange={(open) => {
          if (!open) setPendingDelete(null);
        }}
        title={t('vocabulary.delete.title')}
        description={t('vocabulary.delete.description', [pendingDelete ?? ''])}
        showCloseButton
        data-cell-id="vocabulary-delete-dialog"
        footer={
          <>
            <Button variant="ghost" onClick={() => setPendingDelete(null)}>
              {t('vocabulary.delete.cancel')}
            </Button>
            <Button
              variant="destructive"
              onClick={confirmDelete}
              data-cell-id="vocabulary-delete-confirm"
            >
              {t('vocabulary.delete.confirm')}
            </Button>
          </>
        }
      />

      <Dialog
        open={pendingPurge !== null}
        onOpenChange={(open) => {
          if (!open) setPendingPurge(null);
        }}
        title={t('vocabulary.trashDelete.title')}
        description={t('vocabulary.trashDelete.description', [pendingPurge ?? ''])}
        showCloseButton
        data-cell-id="vocabulary-trash-delete-dialog"
        footer={
          <>
            <Button variant="ghost" onClick={() => setPendingPurge(null)}>
              {t('vocabulary.delete.cancel')}
            </Button>
            <Button
              variant="destructive"
              onClick={confirmPurge}
              data-cell-id="vocabulary-trash-delete-confirm"
            >
              {t('vocabulary.trashDelete.confirm')}
            </Button>
          </>
        }
      />
    </div>
  );
}
