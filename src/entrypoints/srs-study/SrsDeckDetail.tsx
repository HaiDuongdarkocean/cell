import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Box, Button, Heading, Input, Menu, MenuItem, Text } from '@/shared/ui';
import { Icon } from '@/shared/ui/Icon';
import type { ICON_CATALOG } from '@/shared/icons';
import { t } from '@/shared/i18n';
import { useSrsStudy } from '@/features/srs/ui/SrsStudyProvider';
import { putDeck } from '@/features/srs/repositories/deckRepository';
import { getNotesByDeck } from '@/features/srs/repositories/noteRepository';
import { getCardsByDeck } from '@/features/srs/repositories/cardRepository';
import { getNotetype } from '@/features/srs/repositories/notetypeRepository';
import { deleteNoteCascade, deleteCardCascade, deleteDeckCascade } from '@/features/srs/repositories/deleteCascade';
import type { SrsCard, SrsDeck, SrsNote, SrsNotetype } from '@/entities/srs/types';
import { componentLabel } from './srsLabels';
import { SrsNoteEditorPanel } from './SrsNoteEditorPanel';
import styles from './SrsDeckDetail.module.css';

const DECK_ICONS = ['library', 'bookOpen', 'folderOpen', 'star', 'zap', 'languages', 'flag', 'clock'] as const satisfies readonly (keyof typeof ICON_CATALOG)[];

export function deckIconName(deck: SrsDeck): keyof typeof ICON_CATALOG {
  return deck.icon && (DECK_ICONS as readonly string[]).includes(deck.icon) ? deck.icon as keyof typeof ICON_CATALOG : 'library';
}

function formatProgress(card: SrsCard | undefined): string {
  if (!card) return t('srs.manage.noCard');
  const parts = ['sound', 'meaning', 'spelling'] as const;
  return parts
    .map((c) => t('srs.manage.progressPart', [componentLabel(c), card.components[c].progress]))
    .join(' ');
}

export interface SrsDeckDetailProps {
  readonly deck: SrsDeck;
  readonly decks: readonly SrsDeck[];
  readonly initialMode?: 'view' | 'change';
  readonly onBack: () => void;
  readonly onChanged: () => void;
}

export function SrsDeckDetail({ deck, decks, initialMode = 'view', onBack, onChanged }: SrsDeckDetailProps): React.JSX.Element {
  const { start } = useSrsStudy();
  const [notes, setNotes] = useState<readonly SrsNote[]>([]);
  const [cards, setCards] = useState<readonly SrsCard[]>([]);
  const [changing, setChanging] = useState(initialMode === 'change');
  const [editName, setEditName] = useState(deck.name);
  const [editIcon, setEditIcon] = useState(deckIconName(deck));
  const [iconMenuOpen, setIconMenuOpen] = useState(false);
  const iconButtonRef = useRef<HTMLButtonElement | null>(null);
  const [editing, setEditing] = useState<{ note: SrsNote; notetype: SrsNotetype } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    const [n, c] = await Promise.all([getNotesByDeck(deck.id), getCardsByDeck(deck.id)]);
    setNotes(n);
    setCards(c);
  }, [deck.id]);

  useEffect(() => {
    void reload().catch((err) => { setError(err instanceof Error ? err.message : String(err)); });
  }, [reload]);

  const subdecks = useMemo(() => decks.filter((d) => d.parentId === deck.id), [decks, deck.id]);

  async function handleSaveChange(): Promise<void> {
    const name = editName.trim();
    if (!name) return;
    await putDeck({ ...deck, name, icon: editIcon === 'library' ? undefined : editIcon });
    setChanging(false);
    onChanged();
  }

  async function handleDeleteDeck(): Promise<void> {
    if (!window.confirm(t('srs.manage.confirmDeleteDeck'))) return;
    await deleteDeckCascade(deck.id);
    onChanged();
    onBack();
  }

  async function handleDeleteNote(noteId: string): Promise<void> {
    if (!window.confirm(t('srs.manage.confirmDeleteNote'))) return;
    await deleteNoteCascade(noteId);
    await reload();
  }

  async function handleDeleteCard(cardId: string): Promise<void> {
    if (!window.confirm(t('srs.manage.confirmDeleteCard'))) return;
    await deleteCardCascade(cardId);
    await reload();
  }

  async function handleEditNote(note: SrsNote): Promise<void> {
    const notetype = await getNotetype(note.notetypeId);
    setEditing({ note, notetype });
  }

  if (editing) {
    return (
      <Box className={styles.view}>
        <SrsNoteEditorPanel
          note={editing.note}
          notetype={editing.notetype}
          decks={decks}
          onClose={() => { setEditing(null); }}
          onSaved={() => { void reload(); onChanged(); }}
        />
      </Box>
    );
  }

  return (
    <Box className={styles.view}>
      <Box className={styles.topBar}>
        <Button variant="ghost" size="sm" shape="circle" onClick={onBack} aria-label={t('ui.back')} className={styles.chromeButton}>
          <Icon name="chevronLeft" />
        </Button>
        <Box className={styles.deckTitle}>
          <span className={styles.deckIcon}><Icon name={deckIconName(deck)} /></span>
          <Heading level={1} className={styles.title}>{deck.name}</Heading>
        </Box>
        <Button variant="ghost" size="sm" shape="circle" onClick={() => { void start(deck.id); }} aria-label={t('srs.home.studyDeck')} className={styles.chromeButton}>
          <Icon name="play" />
        </Button>
      </Box>

      <Box className={styles.actionRow}>
        <Button variant="secondary" size="sm" onClick={() => { setEditName(deck.name); setEditIcon(deckIconName(deck)); setChanging(true); }}>
          <Icon name="pencil" /> {t('srs.deck.change')}
        </Button>
        <Button variant="destructive" size="sm" onClick={() => { void handleDeleteDeck(); }}>
          <Icon name="trash" /> {t('srs.manage.delete')}
        </Button>
      </Box>

      {changing && (
        <Box className={styles.changeCard}>
          <Input
            value={editName}
            onChange={(e) => { setEditName(e.target.value); }}
            placeholder={t('srs.manage.newDeckName')}
            aria-label={t('srs.manage.newDeckName')}
            autoFocus
          />
          <Box className={styles.iconPickerRow}>
            <Button
              ref={iconButtonRef}
              variant="secondary"
              size="sm"
              onClick={() => { setIconMenuOpen(true); }}
              aria-label={t('srs.deck.icon')}
            >
              <Icon name={editIcon} /> {t('srs.deck.icon')}
            </Button>
            <Menu open={iconMenuOpen} onClose={() => { setIconMenuOpen(false); }} triggerRef={iconButtonRef} ariaLabel={t('srs.deck.icon')}>
              {DECK_ICONS.map((name) => (
                <MenuItem key={name} icon={<Icon name={name} />} onSelect={() => { setEditIcon(name); setIconMenuOpen(false); }}>
                  {name}
                </MenuItem>
              ))}
            </Menu>
          </Box>
          <Box className={styles.changeActions}>
            <Button variant="primary" size="sm" onClick={() => { void handleSaveChange(); }} disabled={!editName.trim()}>
              {t('srs.edit.save')}
            </Button>
            <Button variant="ghost" size="sm" onClick={() => { setChanging(false); }}>
              {t('srs.edit.cancel')}
            </Button>
          </Box>
        </Box>
      )}

      {subdecks.length > 0 && (
        <Text className={styles.subdeckLine}>
          {t('srs.deck.subdecks')}: {subdecks.map((d) => d.name).join(', ')}
        </Text>
      )}

      <Box className={styles.noteList}>
        {notes.length === 0 ? (
          <Text className={styles.empty}>{t('srs.manage.noNotes')}</Text>
        ) : (
          notes.map((note) => {
            const card = cards.find((c) => c.noteId === note.id);
            return (
              <Box key={note.id} className={styles.noteRow}>
                <Box className={styles.noteInfo}>
                  <Text className={styles.noteWord}>{note.targetWord}</Text>
                  <Text className={styles.noteProgress}>{formatProgress(card)}</Text>
                </Box>
                <Box className={styles.noteActions}>
                  <Button variant="ghost" size="sm" shape="circle" onClick={() => { void handleEditNote(note); }} aria-label={t('srs.review.editCard')} className={styles.chromeButton}>
                    <Icon name="pencil" />
                  </Button>
                  {card && (
                    <Button variant="ghost" size="sm" shape="circle" onClick={() => { void handleDeleteCard(card.id); }} aria-label={t('srs.manage.deleteCard')} className={styles.chromeButton}>
                      <Icon name="minus" />
                    </Button>
                  )}
                  <Button variant="ghost" size="sm" shape="circle" onClick={() => { void handleDeleteNote(note.id); }} aria-label={t('srs.manage.deleteNote')} className={styles.chromeButton}>
                    <Icon name="trash" />
                  </Button>
                </Box>
              </Box>
            );
          })
        )}
      </Box>
      {error && <Text className={styles.error}>{error}</Text>}
    </Box>
  );
}
