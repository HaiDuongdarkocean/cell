import { useCallback, useEffect, useRef, useState } from 'react';
import { Badge, Box, Button, Checkbox, FlagIcon, Heading, Input, Menu, MenuItem, Text } from '@/shared/ui';
import { Icon } from '@/shared/ui/Icon';
import { t } from '@/shared/i18n';
import { useSrsStudy } from '@/features/srs/ui/SrsStudyProvider';
import { ensureFirstRun } from '@/features/srs/services/firstRunService';
import { getCollection } from '@/features/srs/repositories/collectionRepository';
import { getDecksByCollection, putDeck } from '@/features/srs/repositories/deckRepository';
import { deleteDeckCascade } from '@/features/srs/repositories/deleteCascade';
import { generateId } from '@/features/srs/lib/helpers';
import { getSrsHomeStats, dayKeyFor, type SrsHomeStats, type SrsHomeDeckStat } from '@/features/srs/services/getSrsHomeStats';
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
  onAddSubdeck,
  onDelete,
}: {
  readonly stat: SrsHomeDeckStat;
  readonly selectMode: boolean;
  readonly selected: boolean;
  readonly onToggleSelect: () => void;
  readonly onStudy: () => void;
  readonly onOpen: () => void;
  readonly onChange: () => void;
  readonly onAddSubdeck: () => void;
  readonly onDelete: () => void;
}): React.JSX.Element {
  const [menuOpen, setMenuOpen] = useState(false);
  const kebabRef = useRef<HTMLButtonElement | null>(null);
  return (
    <Box className={styles.deckRow}>
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
            onClick={() => { setMenuOpen(true); }}
            aria-label={t('srs.home.deckActions')}
          >
            <Icon name="ellipsisVertical" />
          </Button>
          <Menu open={menuOpen} onClose={() => { setMenuOpen(false); }} triggerRef={kebabRef} ariaLabel={t('srs.home.deckActions')} align="right">
            <MenuItem icon={<Icon name="eye" />} onSelect={() => { setMenuOpen(false); onOpen(); }}>
              {t('srs.deck.viewContent')}
            </MenuItem>
            <MenuItem icon={<Icon name="pencil" />} onSelect={() => { setMenuOpen(false); onChange(); }}>
              {t('srs.deck.change')}
            </MenuItem>
            <MenuItem icon={<Icon name="plus" />} onSelect={() => { setMenuOpen(false); onAddSubdeck(); }}>
              {t('srs.manage.createSubdeck')}
            </MenuItem>
            <MenuItem icon={<Icon name="check" />} onSelect={() => { setMenuOpen(false); onToggleSelect(); }}>
              {t('srs.deck.select')}
            </MenuItem>
            <MenuItem icon={<Icon name="trash" />} onSelect={() => { setMenuOpen(false); onDelete(); }}>
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
  readonly onOpenDeck: (deck: SrsDeck, mode: 'view' | 'change', decks: readonly SrsDeck[]) => void;
}

export function SrsHome({ onOpenSettings, onOpenStreaks, onOpenVocabulary, onOpenDeck }: SrsHomeProps): React.JSX.Element {
  const { start, loading, finished, stats } = useSrsStudy();
  const prefs = useSrsUiPrefs();
  const [home, setHome] = useState<SrsHomeStats | null>(null);
  const [collectionId, setCollectionId] = useState<string | null>(null);
  const [targetLanguage, setTargetLanguage] = useState<string>('en');
  const [searching, setSearching] = useState(false);
  const [query, setQuery] = useState('');
  const [adding, setAdding] = useState(false);
  const [addParentId, setAddParentId] = useState<string | null>(null);
  const [newDeckName, setNewDeckName] = useState('');
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());

  const refreshHome = useCallback(async () => {
    const result = await ensureFirstRun();
    const collection = await getCollection(result.collectionId);
    setCollectionId(result.collectionId);
    setTargetLanguage(collection.targetLanguage || 'en');
    setHome(await getSrsHomeStats(result.collectionId, prefs.dayStartHour));
  }, [prefs.dayStartHour]);

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
    const siblings = existing.filter((d) => d.parentId === addParentId);
    const deck: SrsDeck = {
      id: generateId(),
      collectionId,
      parentId: addParentId,
      name: newDeckName.trim(),
      order: siblings.length,
      studyConfigId: collection.defaultStudyConfigId,
    };
    await putDeck(deck);
    setNewDeckName('');
    setAdding(false);
    setAddParentId(null);
    await refreshHome();
  }

  async function handleDeleteDeck(deck: SrsDeck): Promise<void> {
    if (!window.confirm(t('srs.manage.confirmDeleteDeck'))) return;
    await deleteDeckCascade(deck.id);
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
    if (!window.confirm(t('srs.deck.confirmDeleteSelected', [selected.size]))) return;
    for (const id of selected) {
      await deleteDeckCascade(id);
    }
    setSelected(new Set());
    setSelectMode(false);
    await refreshHome();
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
          <Button variant="ghost" size="sm" shape="circle" onClick={onOpenSettings} aria-label={t('srs.settings.title')} className={styles.chromeButton}>
            <Icon name="settings" />
          </Button>
        </Box>
      </Box>

      <Box className={styles.hero}>
        <Box className={styles.heroChip}>
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

        {adding && (
          <Box className={styles.addRow}>
            <Input
              value={newDeckName}
              onChange={(e) => { setNewDeckName(e.target.value); }}
              placeholder={t('srs.manage.newDeckName')}
              aria-label={t('srs.manage.newDeckName')}
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') void handleAddDeck();
                if (e.key === 'Escape') { setAdding(false); setNewDeckName(''); setAddParentId(null); }
              }}
            />
            <Button variant="secondary" size="sm" onClick={() => { void handleAddDeck(); }} disabled={!newDeckName.trim()}>
              {addParentId ? t('srs.manage.createSubdeck') : t('srs.manage.createDeck')}
            </Button>
          </Box>
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
              onAddSubdeck={() => { setAddParentId(stat.deck.id); setAdding(true); }}
              onDelete={() => { void handleDeleteDeck(stat.deck); }}
            />
          ))
        )}

        {selectMode ? (
          <Box className={styles.selectBar}>
            <Text className={styles.selectCount}>{t('srs.deck.selectedCount', [selected.size])}</Text>
            <Button variant="destructive" size="sm" onClick={() => { void handleDeleteSelected(); }} disabled={selected.size === 0}>
              {t('srs.manage.delete')}
            </Button>
            <Button variant="ghost" size="sm" onClick={exitSelectMode}>
              {t('srs.edit.cancel')}
            </Button>
          </Box>
        ) : (
          <Button variant="ghost" fullWidth className={styles.addDeckButton} onClick={() => { setAddParentId(null); setAdding(true); }}>
            <Icon name="plus" /> {t('srs.home.addDeck')}
          </Button>
        )}
      </Box>

      <Text className={styles.footerNote}>{t('srs.app.desc')}</Text>
    </Box>
  );
}
