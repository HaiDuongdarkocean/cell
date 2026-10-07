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
import { Box } from '@/shared/ui/Box';
import { Button } from '@/shared/ui/Button';
import { Checkbox } from '@/shared/ui/Checkbox';
import { Chip } from '@/shared/ui/Chip';
import { Dialog } from '@/shared/ui/Dialog';
import { EmptyState } from '@/shared/ui/EmptyState';
import { FlagIcon } from '@/shared/ui/FlagIcon';
import { Heading } from '@/shared/ui/Heading';
import { Icon } from '@/shared/ui/Icon';
import type { IconCatalogKey } from '@/shared/icons';
import { Menu, MenuItem, MenuSeparator } from '@/shared/ui/Menu';
import { SearchField } from '@/shared/ui/SearchField';
import { SelectionBar } from '@/shared/ui/SelectionBar';
import { Spinner } from '@/shared/ui/Spinner';
import { Text } from '@/shared/ui/Text';
import { pushEscapeLayer } from '@/shared/ui/escapeLayerStack';
import { t, type MessageKey } from '@/shared/i18n';
import { TRASH_TTL_MS } from '@/features/dictionary';
import { runAnkiSyncNow } from '@/features/ankiStatusSync';
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
  groupByStatus,
  pruneSelection,
  selectAllTerms,
  selectEntries,
  snapshotStatuses,
  statusesForSegment,
  trashHoursLeft,
  type MarkedStatus,
  type VocabularySegment,
  type VocabularySort,
} from '../logic/vocabularyList';
import styles from './VocabularyTab.module.css';

const RENDER_CHUNK = 100;

const STATUS_LABEL: Record<WordStatus, MessageKey> = {
  unknown: 'vocabulary.status.unknown',
  tracking: 'vocabulary.status.tracking',
  learning: 'vocabulary.status.learning',
  known: 'vocabulary.status.known',
  ignore: 'vocabulary.status.ignore',
};

export const STATUS_ICON: Record<MarkedStatus, IconCatalogKey> = {
  tracking: 'eye',
  learning: 'clock',
  known: 'circleCheck',
  ignore: 'eyeOff',
};

const SEGMENT_LABEL: Record<VocabularySegment, MessageKey> = {
  all: 'vocabulary.segment.all',
  tracking: 'vocabulary.status.tracking',
  learning: 'vocabulary.status.learning',
  known: 'vocabulary.status.known',
  ignore: 'vocabulary.status.ignore',
};

const SORT_OPTIONS: readonly { value: VocabularySort; label: MessageKey }[] = [
  { value: 'recent', label: 'vocabulary.sort.recent' },
  { value: 'alpha', label: 'vocabulary.sort.alpha' },
  { value: 'grouped', label: 'vocabulary.sort.grouped' },
];

const BULK_STATUSES: readonly MarkedStatus[] = ['tracking', 'learning', 'known', 'ignore'];

type ToolbarMenu = 'filter' | 'sort' | 'more' | 'status';

type UndoRecord =
  | { readonly kind: 'status'; readonly previous: ReadonlyMap<string, WordStatus> }
  | { readonly kind: 'trash'; readonly terms: readonly string[] };

export interface VocabularyTabProps {
  /** Base-2 language of the active profile — source refetches when it changes. */
  readonly langCode: string;
  /** Called when a term row is clicked — parent switches to Dictionary lookup. */
  readonly onLookup: (term: string) => void;
}

const EMPTY_SOURCE_STATE: VocabularySourceState = {
  entries: [],
  trash: [],
  cardSources: { anki: new Set(), srs: new Set() },
  loaded: false,
};

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
  const [searchOpen, setSearchOpen] = useState(false);
  const [sort, setSort] = useState<VocabularySort>('recent');
  const [inTrash, setInTrash] = useState(false);
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());
  const [undo, setUndo] = useState<UndoRecord | null>(null);
  const [menu, setMenu] = useState<ToolbarMenu | null>(null);
  const [pendingBulkDelete, setPendingBulkDelete] = useState(false);
  const [pendingPurge, setPendingPurge] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [limit, setLimit] = useState(RENDER_CHUNK);

  const rootRef = useRef<HTMLDivElement>(null);
  const sortTriggerRef = useRef<HTMLButtonElement>(null);
  const filterTriggerRef = useRef<HTMLButtonElement>(null);
  const moreTriggerRef = useRef<HTMLButtonElement>(null);
  const statusTriggerRef = useRef<HTMLButtonElement>(null);
  const sentinelObserverRef = useRef<IntersectionObserver | null>(null);

  useEffect(() => {
    setSegment('all');
    setQuery('');
    setSearchOpen(false);
    setSort('recent');
    setInTrash(false);
    setSelected(new Set());
    setUndo(null);
    setMenu(null);
    setError(null);
    setLimit(RENDER_CHUNK);
  }, [langCode]);

  useEffect(() => {
    if (!inTrash || !source) return;
    const doc = rootRef.current?.ownerDocument ?? document;
    source.refreshTrash().catch((err: unknown) => {
      setError(err instanceof Error ? err.message : String(err));
    });
    return pushEscapeLayer((e) => {
      e.preventDefault();
      setInTrash(false);
    }, doc);
  }, [inTrash, source]);

  const closeMenu = useCallback(() => setMenu(null), []);
  const fail = useCallback((err: unknown) => {
    setError(err instanceof Error ? err.message : String(err));
  }, []);

  const statusCounts = useMemo(() => countByStatus(state.entries), [state.entries]);
  const segmentCounts = useMemo<Record<VocabularySegment, number>>(
    () => ({
      all: state.entries.length,
      tracking: statusCounts.tracking,
      learning: statusCounts.learning,
      known: statusCounts.known,
      ignore: statusCounts.ignore,
    }),
    [state.entries.length, statusCounts],
  );

  const sorted = useMemo(
    () => selectEntries(state.entries, { statuses: statusesForSegment(segment), query }, sort),
    [state.entries, segment, query, sort],
  );
  const visible = useMemo(() => sorted.slice(0, limit), [sorted, limit]);
  const hasMore = visible.length < sorted.length;

  const trashVisible = useMemo(() => filterTrashEntries(state.trash, query), [state.trash, query]);
  const trashPage = useMemo(() => trashVisible.slice(0, limit), [trashVisible, limit]);
  const trashHasMore = trashPage.length < trashVisible.length;

  useEffect(() => {
    setSelected((prev) => {
      const next = pruneSelection(prev, state.entries);
      return next.size === prev.size ? prev : next;
    });
  }, [state.entries]);

  const observeSentinel = useCallback((el: HTMLElement | null) => {
    sentinelObserverRef.current?.disconnect();
    sentinelObserverRef.current = null;
    const root = rootRef.current;
    if (!el || !root) return;
    if (typeof IntersectionObserver === 'undefined') {
      setLimit(Number.MAX_SAFE_INTEGER);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setLimit((prev) => prev + RENDER_CHUNK);
        }
      },
      { root },
    );
    io.observe(el);
    sentinelObserverRef.current = io;
  }, []);

  useEffect(() => () => sentinelObserverRef.current?.disconnect(), []);

  const resetView = useCallback(() => {
    setSelected(new Set());
    setLimit(RENDER_CHUNK);
    setMenu(null);
  }, []);

  const handleSegmentChange = (value: VocabularySegment): void => {
    setSegment(value);
    resetView();
  };

  const handleSearchToggle = (): void => {
    setSearchOpen((prev) => {
      if (prev) setQuery('');
      return !prev;
    });
  };

  const toggleSelect = (term: string): void => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(term)) next.delete(term);
      else next.add(term);
      return next;
    });
  };

  const toggleSelectAll = (): void => {
    setSelected((prev) => (prev.size > 0 ? new Set() : selectAllTerms(sorted)));
  };

  const handleCycle = (term: string): void => {
    if (!source) return;
    const entry = state.entries.find((e) => e.term === term);
    if (entry) {
      setUndo({ kind: 'status', previous: new Map([[term, entry.status]]) });
    }
    source.cycle(term).catch(fail);
  };

  const handleBulkStatus = (status: WordStatus): void => {
    if (!source || selected.size === 0) return;
    setMenu(null);
    const terms = [...selected];
    setUndo({ kind: 'status', previous: snapshotStatuses(state.entries, selected) });
    setSelected(new Set());
    source.setStatusMany(terms, status).catch(fail);
  };

  const confirmBulkDelete = (): void => {
    setPendingBulkDelete(false);
    if (!source || selected.size === 0) return;
    const terms = [...selected];
    setUndo({ kind: 'trash', terms });
    setSelected(new Set());
    source.trashMany(terms).catch(fail);
  };

  const handleUndo = (): void => {
    if (!source || !undo) return;
    const record = undo;
    setUndo(null);
    if (record.kind === 'trash') {
      source.restoreMany(record.terms).catch(fail);
      return;
    }
    const groups = groupByStatus(record.previous);
    const writes = [...groups].map(([status, terms]) => source.setStatusMany(terms, status));
    Promise.all(writes).catch(fail);
  };

  const handleRestore = (term: string): void => {
    source?.restore(term).catch(fail);
  };

  const confirmPurge = (): void => {
    const term = pendingPurge;
    setPendingPurge(null);
    if (term === null) return;
    source?.deleteTrash(term).catch(fail);
  };

  const enterTrash = (): void => {
    setMenu(null);
    setQuery('');
    setSearchOpen(false);
    setSelected(new Set());
    setUndo(null);
    setLimit(RENDER_CHUNK);
    setInTrash(true);
  };

  const runSync = (): void => {
    if (syncing) return;
    setSyncing(true);
    void (async () => {
      try {
        await runAnkiSyncNow();
        await source?.refreshCardSources();
      } catch (err) {
        fail(err);
      } finally {
        setSyncing(false);
      }
    })();
  };

  const activeSort = SORT_OPTIONS.find((o) => o.value === sort) ?? SORT_OPTIONS[0]!;
  const selectAllLabel = selected.size > 0 ? 'vocabulary.deselectAll' : 'vocabulary.selectAll';

  let lastGroup: WordStatus | null = null;

  return (
    <div ref={rootRef} className={styles.tab} data-cell-id="vocabulary-tab">
      <div className={styles.content}>
        {inTrash ? (
          <div className={styles.topBar}>
            <Button
              variant="secondary"
              shape="circle"
              aria-label={t('vocabulary.trash.back')}
              onClick={() => setInTrash(false)}
              data-cell-id="vocabulary-trash-back"
            >
              <Icon name="chevronLeft" />
            </Button>
            <Heading level={2} size={3} className={styles.trashTitle}>
              {t('vocabulary.segment.trash')}
            </Heading>
          </div>
        ) : (
          <div className={styles.topBar}>
            <Button
              variant="secondary"
              shape="circle"
              aria-label={t('vocabulary.undo')}
              disabled={!undo}
              onClick={handleUndo}
              data-cell-id="vocabulary-undo"
            >
              <Icon name="rotateCcw" />
            </Button>
            {sorted.length > 0 && (
              <Button
                variant="secondary"
                size="md"
                className={styles.selectAllBtn}
                onClick={toggleSelectAll}
                data-cell-id="vocabulary-select-all"
              >
                {t(selectAllLabel)}
              </Button>
            )}
            <span className={styles.topBarSpacer} />
            <Button
              variant="secondary"
              shape="circle"
              aria-label={t('vocabulary.search.toggle')}
              aria-expanded={searchOpen}
              onClick={handleSearchToggle}
              data-cell-id="vocabulary-search-toggle"
            >
              <Icon name="search" />
            </Button>
            <Button
              ref={moreTriggerRef}
              variant="secondary"
              shape="circle"
              aria-label={t('vocabulary.more')}
              aria-haspopup="menu"
              aria-expanded={menu === 'more'}
              onClick={() => setMenu(menu === 'more' ? null : 'more')}
              data-cell-id="vocabulary-more"
            >
              <Icon name="ellipsis" />
            </Button>
          </div>
        )}

        {searchOpen && !inTrash && (
          <SearchField
            value={query}
            onChange={setQuery}
            placeholder={t('vocabulary.search.placeholder')}
            className={styles.search}
            autoFocus
            data-cell-id="vocabulary-search"
          />
        )}

        {!inTrash && (
          <Box bg="card" radius="container" className={styles.hero}>
            <div className={styles.heroInner} data-cell-id="vocabulary-hero">
              <FlagIcon lang={langCode} size={72} className={styles.heroFlag} />
              <Heading level={2} size={3} className={styles.heroHeadline}>
                <span className={styles.heroCount}>{statusCounts.known.toLocaleString()}</span>{' '}
                {t('vocabulary.hero.knownWords')}
              </Heading>
              <Text className={styles.heroBreakdown}>
                <span>
                  <span className={styles.countLearning}>{statusCounts.learning.toLocaleString()}</span>{' '}
                  {t('vocabulary.hero.learning')}
                </span>
                <span>
                  <span className={styles.countTracking}>{statusCounts.tracking.toLocaleString()}</span>{' '}
                  {t('vocabulary.hero.tracking')}
                </span>
                <span>
                  <span className={styles.countIgnore}>{statusCounts.ignore.toLocaleString()}</span>{' '}
                  {t('vocabulary.hero.ignore')}
                </span>
              </Text>
            </div>
          </Box>
        )}

        {error && (
          <Alert
            variant="error"
            description={error}
            onDismiss={() => setError(null)}
            className={styles.error}
          />
        )}

        {!inTrash && (
          <div className={styles.pillRow}>
            <Button
              ref={sortTriggerRef}
              variant="secondary"
              size="md"
              className={styles.pill}
              aria-haspopup="menu"
              aria-expanded={menu === 'sort'}
              aria-label={t('vocabulary.sort.label')}
              onClick={() => setMenu(menu === 'sort' ? null : 'sort')}
              data-cell-id="vocabulary-sort"
            >
              <Icon name="moveVertical" size="xs" />
              <span className={styles.pillLabel}>{t(activeSort.label)}</span>
              <Icon name="chevronDown" size={14} />
            </Button>
            <Button
              ref={filterTriggerRef}
              variant="secondary"
              size="md"
              className={styles.pill}
              aria-haspopup="menu"
              aria-expanded={menu === 'filter'}
              aria-label={t('vocabulary.segment.label')}
              onClick={() => setMenu(menu === 'filter' ? null : 'filter')}
              data-cell-id="vocabulary-filter"
            >
              <Icon name="slidersHorizontal" size="xs" />
              <span className={styles.pillLabel}>{t(SEGMENT_LABEL[segment])}</span>
              <Icon name="chevronDown" size={14} />
            </Button>
          </div>
        )}

        {!inTrash && (
          <div className={styles.meta} data-cell-id="vocabulary-meta">
            <Text variant="supporting" color="secondary">
              {selected.size > 0
                ? t('vocabulary.selectedCount', [selected.size.toLocaleString()])
                : sorted.length === 1
                  ? t('vocabulary.wordCountOne')
                  : t('vocabulary.wordCount', [sorted.length.toLocaleString()])}
            </Text>
          </div>
        )}

        {!state.loaded ? (
          <div className={styles.loading}>
            <Spinner size="lg" />
          </div>
        ) : inTrash ? (
          <>
            <Text variant="supporting" color="secondary" className={styles.retention}>
              {t('vocabulary.trash.retention')}
            </Text>
            {trashVisible.length === 0 ? (
              state.trash.length === 0 ? (
                <EmptyState
                  title={t('vocabulary.emptyTrash')}
                  description={t('vocabulary.emptyTrashHint')}
                  size="compact"
                  data-cell-id="vocabulary-trash-empty"
                />
              ) : (
                <EmptyState
                  title={t('vocabulary.emptyFiltered')}
                  description={t('vocabulary.emptyFilteredHint')}
                  size="compact"
                />
              )
            ) : (
              <Box bg="card" radius="container" className={styles.listCard}>
                <ul className={styles.list}>
                  {trashPage.map((entry) => (
                    <li
                      key={entry.term}
                      className={styles.row}
                      data-cell-id={`vocabulary-trash-row-${entry.term}`}
                    >
                      <Button
                        variant="ghost"
                        className={styles.term}
                        title={entry.term}
                        onClick={() => onLookup(entry.term)}
                        data-cell-id={`vocabulary-term-${entry.term}`}
                      >
                        <span className={styles.termLabel}>{entry.term}</span>
                      </Button>
                      <Chip
                        as="span"
                        size="sm"
                        status={entry.previousStatus}
                        className={styles.rowChip}
                      >
                        {t(STATUS_LABEL[entry.previousStatus])}
                      </Chip>
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
                    </li>
                  ))}
                  {trashHasMore && <li ref={observeSentinel} className={styles.sentinel} aria-hidden="true" />}
                </ul>
              </Box>
            )}
          </>
        ) : state.entries.length === 0 ? (
          <EmptyState title={t('vocabulary.empty')} description={t('vocabulary.emptyHint')} size="compact" />
        ) : visible.length === 0 ? (
          <EmptyState title={t('vocabulary.emptyFiltered')} description={t('vocabulary.emptyFilteredHint')} size="compact" />
        ) : (
          <Box bg="card" radius="container" className={styles.listCard}>
            <ul className={styles.list}>
              {visible.map((entry) => {
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
                      <Checkbox
                        checked={selected.has(entry.term)}
                        onChange={() => toggleSelect(entry.term)}
                        aria-label={t('vocabulary.row.select', [entry.term])}
                        data-cell-id={`vocabulary-select-${entry.term}`}
                        className={styles.checkbox}
                      />
                      <Button
                        variant="ghost"
                        className={styles.term}
                        title={entry.term}
                        onClick={() => onLookup(entry.term)}
                        data-cell-id={`vocabulary-term-${entry.term}`}
                      >
                        <span className={styles.termLabel}>{entry.term}</span>
                      </Button>
                      {state.cardSources.anki.has(entry.term) && (
                        <span
                          className={styles.srcIcon}
                          role="img"
                          aria-label={t('vocabulary.source.anki')}
                          title={t('vocabulary.source.anki')}
                          data-cell-id={`vocabulary-card-anki-${entry.term}`}
                        >
                          <Icon name="import" size="xs" />
                        </span>
                      )}
                      {state.cardSources.srs.has(entry.term) && (
                        <span
                          className={styles.srcIcon}
                          role="img"
                          aria-label={t('vocabulary.source.srs')}
                          title={t('vocabulary.source.srs')}
                          data-cell-id={`vocabulary-card-srs-${entry.term}`}
                        >
                          <Icon name="layers" size="xs" />
                        </span>
                      )}
                      <Button
                        variant="transparent"
                        shape="circle"
                        size="md"
                        className={`${styles.statusCircle} ${styles[`status-${entry.status}`] ?? ''}`}
                        aria-label={t('vocabulary.row.cycle', [entry.term])}
                        onClick={() => handleCycle(entry.term)}
                        data-cell-id={`vocabulary-cycle-${entry.term}`}
                      >
                        <Icon
                          name={
                            entry.status === 'unknown' ? 'eye' : STATUS_ICON[entry.status]
                          }
                        />
                      </Button>
                    </li>
                  </Fragment>
                );
              })}
              {hasMore && <li ref={observeSentinel} className={styles.sentinel} aria-hidden="true" />}
            </ul>
          </Box>
        )}

        {!inTrash && (
          <SelectionBar
            open={selected.size > 0}
            data-cell-id="vocabulary-bulk-bar"
          >
            <Button
              ref={statusTriggerRef}
              variant="primary"
              size="md"
              aria-haspopup="menu"
              aria-expanded={menu === 'status'}
              onClick={() => setMenu(menu === 'status' ? null : 'status')}
              data-cell-id="vocabulary-bulk-status"
            >
              {t('vocabulary.bulk.changeStatus')}
            </Button>
            <Button
              variant="errorSubtle"
              size="md"
              onClick={() => setPendingBulkDelete(true)}
              data-cell-id="vocabulary-bulk-delete"
            >
              <Icon name="trash" />
              {t('vocabulary.bulk.delete')}
            </Button>
          </SelectionBar>
        )}
      </div>

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
              setLimit(RENDER_CHUNK);
              setMenu(null);
            }}
            data-cell-id={`vocabulary-sort-${o.value}`}
            trailing={sort === o.value ? <Icon name="check" size="xs" /> : undefined}
          >
            {t(o.label)}
          </MenuItem>
        ))}
      </Menu>

      <Menu
        open={menu === 'filter'}
        onClose={closeMenu}
        triggerRef={filterTriggerRef}
        ariaLabel={t('vocabulary.segment.label')}
      >
        {VOCABULARY_SEGMENTS.map((s) => (
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
      </Menu>

      <Menu
        open={menu === 'more'}
        onClose={closeMenu}
        triggerRef={moreTriggerRef}
        align="right"
        ariaLabel={t('vocabulary.more')}
      >
        <MenuItem
          icon={<Icon name="trash2" size="xs" />}
          onSelect={enterTrash}
          data-cell-id="vocabulary-more-trash"
          trailing={
            <span data-cell-id="vocabulary-trash-count">{state.trash.length}</span>
          }
        >
          {t('vocabulary.segment.trash')}
        </MenuItem>
        <MenuSeparator />
        <MenuItem
          icon={syncing ? <Spinner size="sm" /> : <Icon name="repeat" size="xs" />}
          disabled={syncing}
          onSelect={runSync}
          data-cell-id="vocabulary-more-sync"
        >
          {syncing ? t('vocabulary.syncing') : t('vocabulary.sync')}
        </MenuItem>
      </Menu>

      <Menu
        open={menu === 'status'}
        onClose={closeMenu}
        triggerRef={statusTriggerRef}
        ariaLabel={t('vocabulary.bulk.changeStatus')}
      >
        {BULK_STATUSES.map((status) => (
          <MenuItem
            key={status}
            icon={<Icon name={STATUS_ICON[status]} size="xs" />}
            onSelect={() => handleBulkStatus(status)}
            data-cell-id={`vocabulary-bulk-status-${status}`}
          >
            {t(STATUS_LABEL[status])}
          </MenuItem>
        ))}
      </Menu>

      <Dialog
        open={pendingBulkDelete}
        onOpenChange={(open) => {
          if (!open) setPendingBulkDelete(false);
        }}
        title={
          selected.size === 1
            ? t('vocabulary.bulk.deleteTitleOne')
            : t('vocabulary.bulk.deleteTitle', [selected.size.toLocaleString()])
        }
        description={
          selected.size === 1
            ? t('vocabulary.bulk.deleteDescriptionOne')
            : t('vocabulary.bulk.deleteDescription', [selected.size.toLocaleString()])
        }
        showCloseButton
        data-cell-id="vocabulary-bulk-delete-dialog"
        footer={
          <>
            <Button variant="ghost" onClick={() => setPendingBulkDelete(false)}>
              {t('vocabulary.delete.cancel')}
            </Button>
            <Button
              variant="destructive"
              onClick={confirmBulkDelete}
              data-cell-id="vocabulary-bulk-delete-confirm"
            >
              {t('vocabulary.bulk.delete')}
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
