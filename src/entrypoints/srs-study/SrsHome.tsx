import { useCallback, useEffect, useRef, useState } from 'react';
import { Badge, Box, Button, Checkbox, ConfirmDialog, Dialog, FlagIcon, Heading, Input, Menu, MenuItem, SelectionBar, Spinner, Text } from '@/shared/ui';
import { Icon } from '@/shared/ui/Icon';
import { t } from '@/shared/i18n';
import { spawnRipple } from '@/shared/lib/dom/ripple';
import { useSrsStudy } from '@/features/srs/ui/SrsStudyProvider';
import { ensureFirstRun } from '@/features/srs/services/firstRunService';
import { getCollection } from '@/features/srs/repositories/collectionRepository';
import { getDecksByCollection, putDeck } from '@/features/srs/repositories/deckRepository';
import { deleteDeckCascade } from '@/features/srs/repositories/deleteCascade';
import { generateId } from '@/features/srs/lib/helpers';
import { getSrsHomeStats, dayKeyFor, type SrsHomeStats, type SrsHomeDeckStat } from '@/features/srs/services/getSrsHomeStats';
import {
  AnkiImportJobRow, flattenDeckName, importNormalized, ImportError, ImportWizard,
  type AnkiImportJob, type AnkiImportStartPayload,
} from '@/features/ankiImport';
import { seedStatusesFromSrs } from '@/features/ankiStatusSync';
import { sendMessage } from '@/shared/lib/chrome-apis/runtime';
import { MESSAGE_TYPES } from '@/shared/config/messages';
import { useSrsUiPrefs } from '@/features/srs/ui/srsUiPrefs';
import { deckIconName } from './SrsDeckDetail';
import type { SrsDeck } from '@/entities/srs/types';
import styles from './SrsHome.module.css';

const DAY_MS = 24 * 60 * 60 * 1000;

function lastTwoWeeks(dayKeys: ReadonlySet<string>, dayStartHour: number): readonly boolean[] {
  const now = Date.now();
  return Array.from({ length: 14 }, (_, i) => dayKeys.has(dayKeyFor(now - (13 - i) * DAY_MS, dayStartHour)));
}

function DeckRow({
  stat,
  selectMode,
  selected,
  onToggleSelect,
  onStudy,
  onOpen,
  onChange,
  onDelete,
}: {
  readonly stat: SrsHomeDeckStat;
  readonly selectMode: boolean;
  readonly selected: boolean;
  readonly onToggleSelect: () => void;
  readonly onStudy: () => void;
  readonly onOpen: () => void;
  readonly onChange: () => void;
  readonly onDelete: () => void;
}): React.JSX.Element {
  const [menuOpen, setMenuOpen] = useState(false);
  const kebabRef = useRef<HTMLButtonElement | null>(null);
  return (
    <Box bg="card" className={styles.deckRow}>
      {selectMode && (
        <Checkbox
          checked={selected}
          onChange={onToggleSelect}
          aria-label={t('srs.deck.selectDeck', [stat.deck.name])}
        />
      )}
      <button
        type="button"
        className={styles.deckMain}
        data-tihoka-no-ripple
        onPointerDown={(e) => {
          if (e.button === 0 && e.currentTarget.parentElement) {
            spawnRipple(e.currentTarget.parentElement as HTMLElement, e.clientX, e.clientY);
          }
        }}
        onClick={selectMode ? onToggleSelect : onStudy}
        aria-pressed={selectMode ? selected : undefined}
      >
        <span className={styles.deckIcon}><Icon name={deckIconName(stat.deck)} /></span>
        <span className={styles.deckInfo}>
          <span className={styles.deckName}>{stat.deck.name}</span>
          <span className={styles.deckPills}>
            <Badge className={styles.pillReviews}>{t('srs.home.reviewsCount', [stat.dueNow])}</Badge>
            <Badge className={styles.pillNew}>{t('srs.home.newCount', [stat.newCount])}</Badge>
          </span>
        </span>
      </button>
      {!selectMode && (
        <>
          <Button
            ref={kebabRef}
            variant="ghost"
            size="sm"
            shape="circle"
            onClick={() => { setMenuOpen((v) => !v); }}
            aria-label={t('srs.home.deckActions')}
          >
            <Icon name="ellipsisVertical" />
          </Button>
          <Menu open={menuOpen} onClose={() => { setMenuOpen(false); }} triggerRef={kebabRef} ariaLabel={t('srs.home.deckActions')} align="right" emphasis>
            <MenuItem icon={<Icon name="eye" />} onSelect={() => { setMenuOpen(false); onOpen(); }}>
              {t('srs.deck.viewContent')}
            </MenuItem>
            <MenuItem icon={<Icon name="pencil" />} onSelect={() => { setMenuOpen(false); onChange(); }}>
              {t('srs.deck.change')}
            </MenuItem>
            <MenuItem icon={<Icon name="check" />} onSelect={() => { setMenuOpen(false); onToggleSelect(); }}>
              {t('srs.deck.select')}
            </MenuItem>
            <MenuItem icon={<Icon name="trash" />} destructive onSelect={() => { setMenuOpen(false); onDelete(); }}>
              {t('srs.manage.delete')}
            </MenuItem>
          </Menu>
        </>
      )}
    </Box>
  );
}

export interface SrsHomeProps {
  readonly onOpenSettings: () => void;
  readonly onOpenStreaks: () => void;
  readonly onOpenVocabulary: () => void;
  readonly onOpenPump: () => void;
  readonly onOpenDeck: (deck: SrsDeck, mode: 'view' | 'change', decks: readonly SrsDeck[]) => void;
}

export function SrsHome({ onOpenSettings, onOpenStreaks, onOpenVocabulary, onOpenPump, onOpenDeck }: SrsHomeProps): React.JSX.Element {
  const { start, loading, finished, stats } = useSrsStudy();
  const prefs = useSrsUiPrefs();
  const [home, setHome] = useState<SrsHomeStats | null>(null);
  const [collectionId, setCollectionId] = useState<string | null>(null);
  const [targetLanguage, setTargetLanguage] = useState<string>('en');
  const [searching, setSearching] = useState(false);
  const [query, setQuery] = useState('');
  const [adding, setAdding] = useState(false);
  const [newDeckName, setNewDeckName] = useState('');
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());
  const [importOpen, setImportOpen] = useState(false);
  const [importJob, setImportJob] = useState<AnkiImportJob | null>(null);
  const [importFidelity, setImportFidelity] = useState<'full' | 'estimated' | null>(null);
  const importAbort = useRef<AbortController | null>(null);
  const importPayload = useRef<AnkiImportStartPayload | null>(null);

  const refreshHome = useCallback(async () => {
    const result = await ensureFirstRun();
    const collection = await getCollection(result.collectionId);
    setCollectionId(result.collectionId);
    setTargetLanguage(collection.targetLanguage || 'en');
    setHome(await getSrsHomeStats(result.collectionId, prefs.dayStartHour));
  }, [prefs.dayStartHour]);

  const runImport = useCallback(async (payload: AnkiImportStartPayload) => {
    importAbort.current?.abort();
    const controller = new AbortController();
    importAbort.current = controller;
    importPayload.current = payload;
    setImportFidelity(payload.data.fidelity);
    const names = payload.data.decks
      .filter((d) => !d.filtered && payload.selection.deckIds.has(d.id))
      .map((d) => flattenDeckName(d.name));
    const title = names.length > 1
      ? t('ankiImport.job.titleMany', [names[0]!, names.length - 1])
      : names[0] ?? '';
    setImportJob({ status: 'running', done: 0, total: payload.data.cards.length, title });
    try {
      const report = await importNormalized({
        data: payload.data,
        selection: payload.selection,
        mappings: payload.mappings,
        targetLanguage: '',
        now: new Date(),
        signal: controller.signal,
        onProgress: (done, total) => {
          setImportJob((j) => (j?.status === 'running' ? { ...j, done, total } : j));
        },
      });
      setImportJob((j) => (j ? { ...j, status: 'done', report } : j));
      void seedStatusesFromSrs();
      void sendMessage({
        type: MESSAGE_TYPES.SRS_CARDS_CHANGED,
        payload: { langCode: targetLanguage },
      }).catch(() => {});
    } catch (err) {
      const cancelled = err instanceof ImportError && err.code === 'ABORTED';
      setImportJob((j) => (j ? {
        ...j,
        status: cancelled ? 'cancelled' : 'error',
        error: cancelled ? undefined : err instanceof Error ? err.message : String(err),
      } : j));
    }
    void refreshHome();
  }, [refreshHome, targetLanguage]);

  useEffect(() => {
    void refreshHome().catch(() => {});
  }, [refreshHome, stats]);

  const streakDots = lastTwoWeeks(home?.activeDayKeys ?? new Set(), prefs.dayStartHour);
  const todayPct = home && home.dueNow + home.studiedToday > 0
    ? Math.round((home.studiedToday / (home.dueNow + home.studiedToday)) * 100)
    : 0;
  const wordsPerDay = home?.wordsPerDay ?? new Array<number>(14).fill(0);
  const wordsMax = Math.max(1, ...wordsPerDay);

  const visibleDecks = (home?.decks ?? []).filter((s) =>
    !query.trim() || s.deck.name.toLowerCase().includes(query.trim().toLowerCase()),
  );

  async function handleAddDeck(): Promise<void> {
    if (!collectionId || !newDeckName.trim()) return;
    const collection = await getCollection(collectionId);
    const existing = await getDecksByCollection(collectionId);
    const siblings = existing.filter((d) => d.parentId === null);
    const deck: SrsDeck = {
      id: generateId(),
      collectionId,
      parentId: null,
      name: newDeckName.trim(),
      order: siblings.length,
      studyConfigId: collection.defaultStudyConfigId,
    };
    await putDeck(deck);
    setNewDeckName('');
    setAdding(false);
    await refreshHome();
  }

  const [pendingDelete, setPendingDelete] = useState<SrsDeck | 'selected' | null>(null);

  async function handleConfirmDelete(): Promise<void> {
    if (pendingDelete === 'selected') {
      for (const id of selected) {
        await deleteDeckCascade(id);
      }
      setSelected(new Set());
      setSelectMode(false);
    } else if (pendingDelete) {
      await deleteDeckCascade(pendingDelete.id);
    }
    setPendingDelete(null);
    // Direct-IDB deletes bypass the background handlers — ask it to
    // rebroadcast so tokenized pages repaint their card layer.
    void sendMessage({
      type: MESSAGE_TYPES.SRS_CARDS_CHANGED,
      payload: { langCode: targetLanguage },
    }).catch(() => {});
    await refreshHome();
  }

  function toggleSelect(deckId: string): void {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(deckId)) next.delete(deckId);
      else next.add(deckId);
      return next;
    });
    setSelectMode(true);
  }

  async function handleDeleteSelected(): Promise<void> {
    if (selected.size === 0) return;
    setPendingDelete('selected');
  }

  function exitSelectMode(): void {
    setSelectMode(false);
    setSelected(new Set());
  }

  return (
    <Box className={styles.home}>
      <Box className={styles.topBar}>
        <Heading level={1} className={styles.appTitle}>{t('srs.title')}</Heading>
        <Box className={styles.topBarActions}>
          <Button
            variant="ghost"
            size="sm"
            shape="circle"
            onClick={() => { setImportOpen(true); }}
            disabled={importJob?.status === 'running'}
            aria-busy={importJob?.status === 'running'}
            aria-label={t('srs.home.importAnki')}
            className={styles.chromeButton}
          >
            {importJob?.status === 'running' ? <Spinner size="sm" /> : <Icon name="import" />}
          </Button>
          <Button variant="ghost" size="sm" shape="circle" onClick={onOpenSettings} aria-label={t('srs.settings.title')} className={styles.chromeButton}>
            <Icon name="settings" />
          </Button>
        </Box>
      </Box>

      <Box bg="surface" className={styles.hero}>
        <Box bg="popover" className={styles.heroChip}>
          <FlagIcon lang={targetLanguage} size={16} />
          <Text className={styles.heroChipText}>{home?.learnedWords.toLocaleString() ?? '0'}</Text>
        </Box>

        <div
          className={styles.ringWrap}
          role="progressbar"
          aria-valuenow={todayPct}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={t('srs.home.todayProgress')}
        >
          <svg className={styles.ring} viewBox="0 0 120 64" fill="none" aria-hidden="true">
            <path className={styles.ringTrack} d="M 8 60 A 52 52 0 0 1 112 60" />
            <path
              className={styles.ringBar}
              d="M 8 60 A 52 52 0 0 1 112 60"
              strokeDasharray={Math.PI * 52}
              strokeDashoffset={Math.PI * 52 * (1 - todayPct / 100)}
              strokeLinecap="round"
            />
          </svg>
          <Box className={styles.ringContent}>
            <Text className={styles.ringValue}>{todayPct}%</Text>
            <Text className={styles.heroLabel}>{t('srs.home.todayReviews')}</Text>
            <Box className={styles.heroPills}>
              <Badge className={styles.pillReviews}>{t('srs.home.reviewsCount', [home?.studiedToday ?? 0])}</Badge>
              <Badge className={styles.pillNew}>{t('srs.home.newCount', [home?.newCount ?? 0])}</Badge>
            </Box>
          </Box>
        </div>

        <Text className={styles.minLeft}>{t('srs.home.minLeft', [home?.minutesLeft ?? 0])}</Text>

        <Box className={styles.heroStats}>
          <button type="button" className={styles.statCard} onClick={onOpenStreaks}>
            <span className={styles.statCardHeader}>
              <Text className={styles.statCardTitle}>{t('srs.home.streak')}</Text>
              <Icon name="chevronRight" />
            </span>
            <span className={styles.streakRow}>
              <Icon name="flame" className={styles.streakFlame} />
              <Text className={styles.streakDays}>{t('srs.home.streakDays', [home?.streakDays ?? 0])}</Text>
            </span>
            <span className={styles.streakGrid}>
              {streakDots.map((active, i) => (
                <span key={i} className={[styles.streakDot, active ? styles.streakDotActive : '', i === 13 ? styles.streakDotToday : ''].filter(Boolean).join(' ')} />
              ))}
            </span>
          </button>

          <button type="button" className={styles.statCard} onClick={onOpenVocabulary}>
            <span className={styles.statCardHeader}>
              <Text className={styles.statCardTitle}>{t('srs.home.knownWords')}</Text>
              <Icon name="chevronRight" />
            </span>
            <span className={styles.knownRow}>
              <FlagIcon lang={targetLanguage} size={18} />
              <Text className={styles.knownCount}>{(home?.learnedWords ?? 0).toLocaleString()}</Text>
            </span>
            <span className={styles.wordsBars} role="img" aria-label={t('srs.home.knownWords')}>
              {wordsPerDay.map((count, i) => (
                <span
                  key={i}
                  className={[styles.wordsBar, count > 0 ? styles.wordsBarActive : '', i === 13 ? styles.wordsBarToday : ''].filter(Boolean).join(' ')}
                  style={{ height: `${Math.max(12, (count / wordsMax) * 100)}%` }}
                />
              ))}
            </span>
            <Text className={styles.knownDelta}>{t('srs.home.wordsAdded', [home?.wordsAddedToday ?? 0])}</Text>
          </button>
        </Box>

        <Button variant="primary" className={styles.continueButton} fullWidth onClick={() => { void start(); }} disabled={loading}>
          {loading ? t('srs.action.loading') : t('srs.home.continue')}
        </Button>
        <Button variant="secondary" fullWidth onClick={onOpenPump} data-tihoka-id="srs-home-pump">
          <Icon name="audioWave" /> {t('pump.launcher')}
        </Button>
      </Box>

      {finished && prefs.showStudySummary !== 'never' && (
        <Text className={styles.finishedText}>{t('srs.finished')}</Text>
      )}

      <Box className={styles.decksSection}>
        <Box className={styles.decksHeader}>
          <Heading level={2} className={styles.decksTitle}>{t('srs.home.allDecks')}</Heading>
          <Box className={styles.decksActions}>
            <Button variant="ghost" size="sm" shape="circle" onClick={() => { setAdding(true); }} aria-label={t('srs.home.addDeck')} className={styles.chromeButton}>
              <Icon name="plus" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              shape="circle"
              onClick={() => { setSearching((v) => !v); setQuery(''); }}
              aria-label={t('srs.home.searchDecks')}
              className={styles.chromeButton}
            >
              <Icon name="search" />
            </Button>
          </Box>
        </Box>

        {searching && (
          <Input
            value={query}
            onChange={(e) => { setQuery(e.target.value); }}
            placeholder={t('srs.home.searchDecks')}
            aria-label={t('srs.home.searchDecks')}
            autoFocus
          />
        )}

      <Dialog
        open={adding}
        onOpenChange={(o) => { if (!o) { setAdding(false); setNewDeckName(''); } }}
        title={t('srs.manage.createDeck')}
        footer={(
          <>
            <Button variant="ghost" onClick={() => { setAdding(false); setNewDeckName(''); }}>
              {t('srs.edit.cancel')}
            </Button>
            <Button variant="primary" onClick={() => { void handleAddDeck(); }} disabled={!newDeckName.trim()}>
              {t('srs.edit.save')}
            </Button>
          </>
        )}
      >
        <Box className={styles.addDialogBody}>
          <Input
            value={newDeckName}
            onChange={(e) => { setNewDeckName(e.target.value); }}
            placeholder={t('srs.manage.newDeckName')}
            aria-label={t('srs.manage.newDeckName')}
            autoFocus
            onKeyDown={(e) => { if (e.key === 'Enter') void handleAddDeck(); }}
          />
        </Box>
      </Dialog>

      <ConfirmDialog
        open={pendingDelete !== null}
        onOpenChange={(o) => { if (!o) setPendingDelete(null); }}
        title={pendingDelete === 'selected'
          ? t('srs.deck.deleteSelectedTitle', [selected.size])
          : t('srs.deck.deleteTitle', [pendingDelete?.name ?? ''])}
        description={pendingDelete === 'selected'
          ? t('srs.deck.deleteSelectedDesc')
          : t('srs.deck.deleteDesc')}
        cancelLabel={t('srs.edit.cancel')}
        confirmLabel={t('srs.manage.delete')}
        onConfirm={() => { void handleConfirmDelete(); }}
      />

        {importJob && (
          <AnkiImportJobRow
            job={importJob}
            fidelity={importFidelity}
            onCancel={() => { importAbort.current?.abort(); }}
            onDismiss={() => { setImportJob(null); }}
            onStudyNow={() => { setImportJob(null); void start(); }}
            onRetry={() => { if (importPayload.current) void runImport(importPayload.current); }}
          />
        )}
        {visibleDecks.length === 0 ? (
          <Text className={styles.emptyText}>{t('srs.manage.noDecks')}</Text>
        ) : (
          visibleDecks.map((stat) => (
            <DeckRow
              key={stat.deck.id}
              stat={stat}
              selectMode={selectMode}
              selected={selected.has(stat.deck.id)}
              onToggleSelect={() => { toggleSelect(stat.deck.id); }}
              onStudy={() => { void start(stat.deck.id); }}
              onOpen={() => { onOpenDeck(stat.deck, 'view', visibleDecks.map((s) => s.deck)); }}
              onChange={() => { onOpenDeck(stat.deck, 'change', visibleDecks.map((s) => s.deck)); }}
              onDelete={() => { setPendingDelete(stat.deck); }}
            />
          ))
        )}

        <SelectionBar
          open={selectMode}
          label={<Text className={styles.selectCount}>{t('srs.deck.selectedCount', [selected.size])}</Text>}
          data-tihoka-id="srs-select-bar"
        >
          <Button variant="destructive" size="sm" onClick={() => { void handleDeleteSelected(); }} disabled={selected.size === 0}>
            {t('srs.manage.delete')}
          </Button>
          <Button variant="ghost" size="sm" onClick={exitSelectMode}>
            {t('srs.edit.cancel')}
          </Button>
        </SelectionBar>
      </Box>

      <Text className={styles.footerNote}>{t('srs.app.desc')}</Text>

      <ImportWizard
        open={importOpen}
        onClose={() => { setImportOpen(false); }}
        onStart={(payload) => { setImportOpen(false); void runImport(payload); }}
      />
    </Box>
  );
}
