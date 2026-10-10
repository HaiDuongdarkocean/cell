import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Badge, Box, Button, Checkbox, ConfirmDialog, Dialog, Heading, Input, Menu, MenuItem, Text } from '@/shared/ui';
import { Icon } from '@/shared/ui/Icon';
import type { ICON_CATALOG } from '@/shared/icons';
import { t } from '@/shared/i18n';
import { useSrsStudy } from '@/features/srs/ui/SrsStudyProvider';
import { getCollection } from '@/features/srs/repositories/collectionRepository';
import { putDeck } from '@/features/srs/repositories/deckRepository';
import { getNotesByDeck, putNote } from '@/features/srs/repositories/noteRepository';
import { getCardsByDeck, getCardsByNote, putCard } from '@/features/srs/repositories/cardRepository';
import { getNotetype, getNotetypesByCollection } from '@/features/srs/repositories/notetypeRepository';
import { getStudyConfig } from '@/features/srs/repositories/studyConfigRepository';
import { deleteNoteCascade, deleteDeckCascade } from '@/features/srs/repositories/deleteCascade';
import { reconcileLearningFlags } from '@/features/ankiStatusSync';
import { sendMessage } from '@/shared/lib/chrome-apis/runtime';
import { MESSAGE_TYPES } from '@/shared/config/messages';
import { resetCard } from '@/features/srs/logic/reviewEngine';
import { getVariantPresetForDeck } from '@/features/srs/repositories/variantPresetRepository';
import { createSrsFsrsAdapter } from '@/features/srs/services/srsFsrsAdapter';
import { setWordStatus } from '@/features/dictionary/services/wordStatusClient';
import type { WordStatus } from '@/entities/dictionary';
import type { SrsCard, SrsDeck, SrsFieldValue, SrsNote, SrsNotetype } from '@/entities/srs/types';
import { SrsNoteEditorPanel } from './SrsNoteEditorPanel';
import styles from './SrsDeckDetail.module.css';

const DECK_ICONS = ['library', 'bookOpen', 'folderOpen', 'star', 'zap', 'languages', 'flag', 'clock'] as const satisfies readonly (keyof typeof ICON_CATALOG)[];

export function deckIconName(deck: SrsDeck): keyof typeof ICON_CATALOG {
  return deck.icon && (DECK_ICONS as readonly string[]).includes(deck.icon) ? deck.icon as keyof typeof ICON_CATALOG : 'library';
}

const MARK_STATUSES: readonly WordStatus[] = ['unknown', 'known', 'tracking', 'ignore'];

function fieldText(value: SrsFieldValue | undefined): string {
  if (!value) return '';
  if (value.kind === 'list') return value.value.join(', ');
  return typeof value.value === 'string' ? value.value : value.value.join(', ');
}

function fieldByHint(note: SrsNote, notetype: SrsNotetype | undefined, hint: string): string {
  if (!notetype) return '';
  const field = notetype.fields.find((f) => f.name.toLowerCase().includes(hint));
  return field ? fieldText(note.fields[field.id]) : '';
}

function isNew(card: SrsCard | undefined, variantIds: readonly string[]): boolean {
  if (!card) return true;
  return variantIds.every((id) => (card.components[id]?.exploreCount ?? 0) === 0);
}

export interface SrsDeckDetailProps {
  readonly deck: SrsDeck;
  readonly decks: readonly SrsDeck[];
  readonly initialMode?: 'view' | 'change';
  readonly initialQuery?: string;
  readonly onBack: () => void;
  readonly onChanged: () => void;
}

export function SrsDeckDetail({ deck, decks, initialMode = 'view', initialQuery, onBack, onChanged }: SrsDeckDetailProps): React.JSX.Element {
  const { start } = useSrsStudy();
  const [notes, setNotes] = useState<readonly SrsNote[]>([]);
  const [cards, setCards] = useState<readonly SrsCard[]>([]);
  const [notetypes, setNotetypes] = useState<ReadonlyMap<string, SrsNotetype>>(new Map());
  const [notetypeList, setNotetypeList] = useState<readonly SrsNotetype[]>([]);
  const [targetLanguage, setTargetLanguage] = useState('en');
  const [searching, setSearching] = useState(() => Boolean(initialQuery));
  const [query, setQuery] = useState(initialQuery ?? '');
  const [menuOpen, setMenuOpen] = useState(false);
  const kebabRef = useRef<HTMLButtonElement | null>(null);
  const [renaming, setRenaming] = useState(initialMode === 'change');
  const [pickingIcon, setPickingIcon] = useState(false);
  const [editName, setEditName] = useState(deck.name);
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());
  const [dialog, setDialog] = useState<'delete' | 'reset' | 'type' | 'move' | 'deleteDeck' | null>(null);
  const [editing, setEditing] = useState<{ note: SrsNote; notetype: SrsNotetype } | null>(null);
  const [variantIds, setVariantIds] = useState<readonly string[]>([]);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    const [n, c, collection, nts, preset] = await Promise.all([
      getNotesByDeck(deck.id),
      getCardsByDeck(deck.id),
      getCollection(deck.collectionId),
      getNotetypesByCollection(deck.collectionId),
      getVariantPresetForDeck(deck.id).catch(() => null),
    ]);
    setNotes(n);
    setCards(c);
    setTargetLanguage(collection.targetLanguage || 'en');
    setNotetypeList(nts);
    setNotetypes(new Map(nts.map((nt) => [nt.id, nt])));
    setVariantIds(preset?.variants.map((v) => v.id) ?? []);
  }, [deck.id, deck.collectionId]);

  useEffect(() => {
    void reload().catch((err) => { setError(err instanceof Error ? err.message : String(err)); });
  }, [reload]);

  const subdecks = useMemo(() => decks.filter((d) => d.parentId === deck.id), [decks, deck.id]);
  const newCount = useMemo(() => cards.filter((c) => isNew(c, variantIds)).length, [cards, variantIds]);
  const visibleNotes = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return notes;
    return notes.filter((n) =>
      n.targetWord.toLowerCase().includes(q) ||
      fieldByHint(n, notetypes.get(n.notetypeId), 'sentence').toLowerCase().includes(q));
  }, [notes, query, notetypes]);

  const allSelected = selected.size > 0 && selected.size === visibleNotes.length;

  function toggleSelect(noteId: string): void {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(noteId)) next.delete(noteId);
      else next.add(noteId);
      return next;
    });
  }

  function exitSelectMode(): void {
    setSelectMode(false);
    setSelected(new Set());
    setDialog(null);
  }

  async function handleRename(): Promise<void> {
    const name = editName.trim();
    if (!name) return;
    await putDeck({ ...deck, name });
    setRenaming(false);
    onChanged();
  }

  async function handlePickIcon(icon: keyof typeof ICON_CATALOG): Promise<void> {
    await putDeck({ ...deck, icon: icon === 'library' ? undefined : icon });
    setPickingIcon(false);
    onChanged();
  }

  async function handleDeleteDeck(): Promise<void> {
    await deleteDeckCascade(deck.id);
    void reconcileLearningFlags(targetLanguage);
    notifyCardsChanged();
    onChanged();
    onBack();
  }

  async function handleEditNote(note: SrsNote): Promise<void> {
    const notetype = await getNotetype(note.notetypeId);
    setEditing({ note, notetype });
  }

  async function markStatus(note: SrsNote, status: WordStatus): Promise<void> {
    await setWordStatus(targetLanguage, note.targetWord, status).catch(() => {});
  }

  // Direct-IDB deletes bypass the background handlers — ask it to rebroadcast
  // so tokenized pages repaint their card layer.
  function notifyCardsChanged(): void {
    void sendMessage({
      type: MESSAGE_TYPES.SRS_CARDS_CHANGED,
      payload: { langCode: targetLanguage },
    }).catch(() => {});
  }

  async function handleDeleteSelected(status?: WordStatus): Promise<void> {
    for (const note of notes.filter((n) => selected.has(n.id))) {
      if (status) await markStatus(note, status);
      await deleteNoteCascade(note.id);
    }
    void reconcileLearningFlags(targetLanguage);
    notifyCardsChanged();
    exitSelectMode();
    await reload();
    onChanged();
  }

  async function handleResetSelected(toUnknown: boolean): Promise<void> {
    const config = await getStudyConfig(deck.studyConfigId);
    const variants = (await getVariantPresetForDeck(deck.id)).variants;
    const adapter = createSrsFsrsAdapter();
    const notetypeCache = new Map<string, SrsNotetype>();
    for (const card of cards.filter((c) => selected.has(c.noteId))) {
      const note = notes.find((n) => n.id === card.noteId);
      if (!note) continue;
      if (!notetypeCache.has(note.notetypeId)) {
        const nt = await getNotetype(note.notetypeId);
        if (nt) notetypeCache.set(nt.id, nt);
      }
      const notetype = notetypeCache.get(note.notetypeId);
      if (!notetype) continue;
      await putCard(resetCard(card, note, notetype, variants, new Date().toISOString(), config, adapter));
    }
    if (toUnknown) {
      for (const note of notes.filter((n) => selected.has(n.id))) {
        await markStatus(note, 'unknown');
      }
    }
    setDialog(null);
    setSelectMode(false);
    setSelected(new Set());
    await reload();
    onChanged();
  }

  async function handleChangeType(notetypeId: string): Promise<void> {
    for (const note of notes.filter((n) => selected.has(n.id))) {
      await putNote({ ...note, notetypeId });
    }
    setDialog(null);
    exitSelectMode();
    await reload();
    onChanged();
  }

  async function handleMove(targetDeckId: string): Promise<void> {
    for (const note of notes.filter((n) => selected.has(n.id))) {
      await putNote({ ...note, deckId: targetDeckId });
      const noteCards = await getCardsByNote(note.id);
      for (const card of noteCards) {
        await putCard({ ...card, deckId: targetDeckId });
      }
    }
    setDialog(null);
    exitSelectMode();
    await reload();
    onChanged();
  }

  if (editing) {
    return (
      <Box className={styles.view}>
        <SrsNoteEditorPanel
          note={editing.note}
          notetype={editing.notetype}
          decks={decks}
          onClose={() => { setEditing(null); }}
          onSaved={() => { notifyCardsChanged(); void reload(); onChanged(); }}
        />
      </Box>
    );
  }

  return (
    <Box className={styles.view}>
      {selectMode ? (
        <Box className={styles.topBar}>
          <Button variant="ghost" size="sm" shape="circle" onClick={exitSelectMode} aria-label={t('ui.close')} className={styles.chromeButton}>
            <Icon name="x" />
          </Button>
          <Text className={styles.selectedCount}>{t('srs.deck.selectedCount', [selected.size])}</Text>
          <Button
            variant="secondary"
            size="sm"
            className={styles.selectAllPill}
            onClick={() => {
              setSelected(allSelected ? new Set() : new Set(visibleNotes.map((n) => n.id)));
            }}
          >
            {t(allSelected ? 'srs.notes.deselectAll' : 'srs.notes.selectAll')}
          </Button>
        </Box>
      ) : (
        <Box className={styles.topBar}>
          <Button variant="ghost" size="sm" shape="circle" onClick={onBack} aria-label={t('ui.back')} className={styles.chromeButton}>
            <Icon name="chevronLeft" />
          </Button>
          <Box className={styles.topBarActions}>
            <Button
              variant="ghost" size="sm" shape="circle"
              onClick={() => { setSearching((s) => !s); }}
              aria-label={t('srs.deck.searchNotes')}
              aria-pressed={searching}
              className={styles.chromeButton}
            >
              <Icon name="search" />
            </Button>
            <Button
              variant="ghost" size="sm" shape="circle"
              onClick={() => { void start(deck.id); }}
              aria-label={t('srs.home.studyDeck')}
              className={styles.chromeButton}
            >
              <Icon name="play" />
            </Button>
            <Button
              ref={kebabRef}
              variant="ghost" size="sm" shape="circle"
              onClick={() => { setMenuOpen((v) => !v); }}
              aria-label={t('srs.home.deckActions')}
              className={styles.chromeButton}
            >
              <Icon name="ellipsisVertical" />
            </Button>
          </Box>
          <Menu open={menuOpen} onClose={() => { setMenuOpen(false); }} triggerRef={kebabRef} ariaLabel={t('srs.home.deckActions')} align="right" emphasis>
            <MenuItem icon={<Icon name="pencil" />} onSelect={() => { setMenuOpen(false); setEditName(deck.name); setRenaming(true); }}>
              {t('srs.deck.rename')}
            </MenuItem>
            <MenuItem icon={<Icon name="image" />} onSelect={() => { setMenuOpen(false); setPickingIcon(true); }}>
              {t('srs.deck.changeIcon')}
            </MenuItem>
            <MenuItem icon={<Icon name="check" />} onSelect={() => { setMenuOpen(false); setSelectMode(true); }}>
              {t('srs.deck.select')}
            </MenuItem>
            <MenuItem icon={<Icon name="trash" />} destructive onSelect={() => { setMenuOpen(false); setDialog('deleteDeck'); }}>
              {t('srs.manage.delete')}
            </MenuItem>
          </Menu>
        </Box>
      )}

      {searching && !selectMode && (
        <Input
          value={query}
          onChange={(e) => { setQuery(e.target.value); }}
          placeholder={t('srs.deck.searchNotes')}
          aria-label={t('srs.deck.searchNotes')}
          autoFocus
        />
      )}

      <Box className={styles.heroCard}>
        <span className={styles.heroIcon}><Icon name={deckIconName(deck)} /></span>
        <Heading level={1} className={styles.heroName}>{deck.name}</Heading>
        <Text className={styles.heroCount}>{t('srs.deck.cardsCount', [notes.length])}</Text>
        {newCount > 0 && (
          <Badge className={styles.newPill}>{t('srs.deck.newCardsCount', [newCount])}</Badge>
        )}
        {subdecks.length > 0 && (
          <Text className={styles.subdeckLine}>
            {t('srs.deck.subdecks')}: {subdecks.map((d) => d.name).join(', ')}
          </Text>
        )}
      </Box>

      <Box className={styles.notesCard}>
        {visibleNotes.length === 0 ? (
          <Text className={styles.empty}>{t(query.trim() ? 'srs.deck.noMatch' : 'srs.manage.noNotes')}</Text>
        ) : (
          visibleNotes.map((note, i) => {
            const nt = notetypes.get(note.notetypeId);
            const card = cards.find((c) => c.noteId === note.id);
            const sentence = fieldByHint(note, nt, 'sentence');
            const isSel = selected.has(note.id);
            return (
              <Box
                key={note.id}
                className={`${styles.noteRow} ${i > 0 ? styles.noteRowBorder : ''}`}
              >
                {selectMode && (
                  <Checkbox
                    checked={isSel}
                    onChange={() => { toggleSelect(note.id); }}
                    aria-label={t('srs.deck.selectDeck', [note.targetWord])}
                  />
                )}
                <button
                  type="button"
                  className={styles.noteMain}
                  onClick={() => { if (selectMode) toggleSelect(note.id); else void handleEditNote(note); }}
                >
                  <span className={styles.noteLine}>
                    <span className={styles.noteWord}>{note.targetWord}</span>
                  </span>
                  {sentence && <span className={styles.noteSentence}>{sentence}</span>}
                </button>
                {card && isNew(card, variantIds) && !selectMode && (
                  <Badge className={styles.statusPill}>{t('srs.notes.new')}</Badge>
                )}
                {!selectMode && (
                  <Button variant="ghost" size="sm" shape="circle" onClick={() => { void handleEditNote(note); }} aria-label={t('srs.review.editCard')} className={styles.noteEdit}>
                    <Icon name="pencil" />
                  </Button>
                )}
              </Box>
            );
          })
        )}
      </Box>
      {error && <Text className={styles.error}>{error}</Text>}

      {selectMode && (
        <Box className={styles.actionBar}>
          <Button variant="secondary" size="sm" className={styles.actionPill} disabled={selected.size === 0} onClick={() => { setDialog('type'); }}>
            <Icon name="layers" /> {t('srs.notes.changeType')}
          </Button>
          <Button variant="secondary" size="sm" className={styles.actionPill} disabled={selected.size === 0} onClick={() => { setDialog('move'); }}>
            <Icon name="folderOpen" /> {t('srs.notes.move')}
          </Button>
          <Button variant="secondary" size="sm" className={styles.actionPill} disabled={selected.size === 0} onClick={() => { setDialog('reset'); }}>
            <Icon name="rotateCcw" /> {t('srs.notes.resetToNew')}
          </Button>
          <Button variant="secondary" size="sm" className={`${styles.actionPill} ${styles.actionPillDanger}`} disabled={selected.size === 0} onClick={() => { setDialog('delete'); }}>
            <Icon name="trash" /> {t('srs.manage.delete')}
          </Button>
        </Box>
      )}

      <Dialog
        open={renaming}
        onOpenChange={(o) => { setRenaming(o); }}
        title={t('srs.deck.rename')}
        footer={(
          <>
            <Button variant="ghost" onClick={() => { setRenaming(false); }}>{t('srs.edit.cancel')}</Button>
            <Button variant="primary" onClick={() => { void handleRename(); }} disabled={!editName.trim()}>{t('srs.edit.save')}</Button>
          </>
        )}
      >
        <Input
          value={editName}
          onChange={(e) => { setEditName(e.target.value); }}
          placeholder={t('srs.manage.newDeckName')}
          aria-label={t('srs.manage.newDeckName')}
          autoFocus
        />
      </Dialog>

      <Dialog open={pickingIcon} onOpenChange={(o) => { setPickingIcon(o); }} title={t('srs.deck.changeIcon')}>
        <Box className={styles.iconGrid}>
          {DECK_ICONS.map((name) => (
            <Button
              key={name}
              variant={deckIconName(deck) === name ? 'primary' : 'secondary'}
              size="sm"
              shape="circle"
              onClick={() => { void handlePickIcon(name); }}
              aria-label={name}
            >
              <Icon name={name} />
            </Button>
          ))}
        </Box>
      </Dialog>

      <Dialog
        open={dialog === 'delete'}
        onOpenChange={(o) => { if (!o) setDialog(null); }}
        title={t('srs.notes.deleteTitle')}
      >
        <Box className={styles.confirmBody}>
          <Box className={styles.confirmRow}>
            <Button variant="ghost" onClick={() => { setDialog(null); }}>{t('srs.edit.cancel')}</Button>
            <Button variant="destructive" onClick={() => { void handleDeleteSelected(); }}>{t('srs.manage.delete')}</Button>
          </Box>
          <Text className={styles.markAsLabel}>{t('srs.notes.deleteMarkAs')}</Text>
          <Box className={styles.markAsGrid}>
            {MARK_STATUSES.map((status) => (
              <Button
                key={status}
                variant="secondary"
                size="sm"
                className={styles.markAsPill}
                onClick={() => { void handleDeleteSelected(status); }}
              >
                {t(`vocabulary.status.${status}`)}
              </Button>
            ))}
          </Box>
        </Box>
      </Dialog>

      <Dialog
        open={dialog === 'reset'}
        onOpenChange={(o) => { if (!o) setDialog(null); }}
        title={t('srs.notes.resetTitle')}
      >
        <Box className={styles.resetOptions}>
          <Button variant="secondary" onClick={() => { void handleResetSelected(false); }}>
            {t('srs.notes.resetKeepStatus')}
          </Button>
          <Button variant="destructive" onClick={() => { void handleResetSelected(true); }}>
            {t('srs.notes.resetUnknown')}
          </Button>
          <Button variant="ghost" onClick={() => { setDialog(null); }}>
            {t('srs.edit.cancel')}
          </Button>
        </Box>
      </Dialog>

      <Dialog open={dialog === 'type'} onOpenChange={(o) => { if (!o) setDialog(null); }} title={t('srs.notes.pickType')}>
        <Box className={styles.pickList}>
          {notetypeList.map((nt) => (
            <Button key={nt.id} variant="secondary" onClick={() => { void handleChangeType(nt.id); }} className={styles.pickItem}>
              {nt.name}
            </Button>
          ))}
        </Box>
      </Dialog>

      <Dialog open={dialog === 'move'} onOpenChange={(o) => { if (!o) setDialog(null); }} title={t('srs.notes.pickDeck')}>
        <Box className={styles.pickList}>
          {decks.filter((d) => d.id !== deck.id).map((d) => (
            <Button key={d.id} variant="secondary" onClick={() => { void handleMove(d.id); }} className={styles.pickItem}>
              <Icon name={deckIconName(d)} /> {d.name}
            </Button>
          ))}
          {decks.filter((d) => d.id !== deck.id).length === 0 && (
            <Text className={styles.empty}>{t('srs.manage.noDecks')}</Text>
          )}
        </Box>
      </Dialog>

      <ConfirmDialog
        open={dialog === 'deleteDeck'}
        onOpenChange={(o) => { if (!o) setDialog(null); }}
        title={t('srs.deck.deleteTitle', [deck.name])}
        description={t('srs.deck.deleteDesc')}
        cancelLabel={t('srs.edit.cancel')}
        confirmLabel={t('srs.manage.delete')}
        onConfirm={() => { void handleDeleteDeck(); }}
      />
    </Box>
  );
}
