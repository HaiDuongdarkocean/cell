import { useEffect, useMemo, useState } from 'react';
import { ensureFirstRun, type FirstRunResult } from '@/features/srs/services/firstRunService';
import { getCollection } from '@/features/srs/repositories/collectionRepository';
import { getDecksByCollection, putDeck } from '@/features/srs/repositories/deckRepository';
import { getNotesByDeck } from '@/features/srs/repositories/noteRepository';
import { getCardsByDeck } from '@/features/srs/repositories/cardRepository';
import { deleteNoteCascade, deleteCardCascade, deleteDeckCascade } from '@/features/srs/repositories/deleteCascade';
import { generateId } from '@/features/srs/lib/helpers';
import { Box } from '@/shared/ui/Box';
import { Heading } from '@/shared/ui/Heading';
import { Text } from '@/shared/ui/Text';
import { Button } from '@/shared/ui/Button';
import { Input } from '@/shared/ui/Input';
import type { SrsDeck, SrsNote, SrsCard } from '@/entities/srs/types';
import styles from './SrsManagePanel.module.css';

type DeckTree = {
  readonly deck: SrsDeck;
  readonly children: readonly DeckTree[];
};

function buildDeckTree(decks: readonly SrsDeck[]): DeckTree[] {
  const byParent = new Map<string | null, SrsDeck[]>();
  for (const deck of decks) {
    const list = byParent.get(deck.parentId) ?? [];
    list.push(deck);
    byParent.set(deck.parentId, list);
  }

  function build(parentId: string | null): DeckTree[] {
    const children = byParent.get(parentId) ?? [];
    return children.map((deck) => ({
      deck,
      children: build(deck.id),
    }));
  }

  return build(null);
}

function formatProgress(card: SrsCard | undefined): string {
  if (!card) return 'no card';
  const parts = ['sound', 'meaning', 'spelling'] as const;
  return parts.map((t) => `${t[0].toUpperCase()}:${card.components[t].progress}`).join(' ');
}

export interface SrsManagePanelProps {
  readonly onBack?: () => void;
}

export function SrsManagePanel({ onBack }: SrsManagePanelProps): React.JSX.Element {
  const [firstRun, setFirstRun] = useState<FirstRunResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [decks, setDecks] = useState<readonly SrsDeck[]>([]);
  const [selectedDeckId, setSelectedDeckId] = useState<string | null>(null);
  const [newDeckName, setNewDeckName] = useState('');
  const [notes, setNotes] = useState<readonly SrsNote[]>([]);
  const [cards, setCards] = useState<readonly SrsCard[]>([]);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    ensureFirstRun()
      .then((result) => {
        if (!mounted) return;
        setFirstRun(result);
        setSelectedDeckId(result.deckId);
        return loadDecks(result.collectionId);
      })
      .catch((err) => {
        if (!mounted) return;
        setError(err instanceof Error ? err.message : String(err));
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    if (!selectedDeckId) return;
    let mounted = true;
    Promise.all([getNotesByDeck(selectedDeckId), getCardsByDeck(selectedDeckId)])
      .then(([n, c]) => {
        if (!mounted) return;
        setNotes(n);
        setCards(c);
      })
      .catch((err) => {
        if (!mounted) return;
        setError(err instanceof Error ? err.message : String(err));
      });
    return () => { mounted = false; };
  }, [selectedDeckId]);

  async function loadDecks(collectionId: string): Promise<void> {
    const list = await getDecksByCollection(collectionId);
    setDecks(list);
  }

  async function handleCreateDeck(parentId: string | null): Promise<void> {
    if (!firstRun || !newDeckName.trim()) return;
    const collection = await getCollection(firstRun.collectionId);
    const studyConfigId = collection.defaultStudyConfigId;
    const siblings = decks.filter((d) => d.parentId === parentId);
    const newDeck: SrsDeck = {
      id: generateId(),
      collectionId: firstRun.collectionId,
      parentId,
      name: newDeckName.trim(),
      order: siblings.length,
      studyConfigId,
    };
    await putDeck(newDeck);
    setNewDeckName('');
    await loadDecks(firstRun.collectionId);
    setSelectedDeckId(newDeck.id);
  }

  async function handleDeleteDeck(deckId: string): Promise<void> {
    if (!window.confirm('Delete this deck and all its cards?')) return;
    await deleteDeckCascade(deckId);
    if (firstRun) await loadDecks(firstRun.collectionId);
    if (selectedDeckId === deckId) setSelectedDeckId(firstRun?.deckId ?? null);
  }

  async function handleDeleteNote(noteId: string): Promise<void> {
    if (!window.confirm('Delete this note and its card?')) return;
    await deleteNoteCascade(noteId);
    if (selectedDeckId) {
      const [n, c] = await Promise.all([getNotesByDeck(selectedDeckId), getCardsByDeck(selectedDeckId)]);
      setNotes(n);
      setCards(c);
    }
  }

  async function handleDeleteCard(cardId: string): Promise<void> {
    if (!window.confirm('Delete this card?')) return;
    await deleteCardCascade(cardId);
    if (selectedDeckId) {
      const c = await getCardsByDeck(selectedDeckId);
      setCards(c);
    }
  }

  const deckTree = useMemo(() => buildDeckTree(decks), [decks]);

  function renderDeckTree(nodes: readonly DeckTree[], depth = 0): React.ReactNode {
    return nodes.map(({ deck, children }) => (
      <Box key={deck.id} className={styles.deckRow}>
        <Button
          variant={selectedDeckId === deck.id ? 'primary' : 'ghost'}
          size="sm"
          onClick={() => { setSelectedDeckId(deck.id); }}
          className={styles.deckButton}
        >
          {deck.name}
        </Button>
        <Button
          variant="destructive"
          size="sm"
          onClick={() => { void handleDeleteDeck(deck.id); }}
          className={styles.deckDelete}
        >
          Delete
        </Button>
        {children.length > 0 && <Box className={styles.deckChildren}>{renderDeckTree(children, depth + 1)}</Box>}
      </Box>
    ));
  }

  const selectedDeck = decks.find((d) => d.id === selectedDeckId);

  return (
    <Box className={styles.panel}>
      <Box className={styles.header}>
        <Heading level={2} className={styles.title}>Manage</Heading>
        {onBack && (
          <Button variant="ghost" size="sm" onClick={onBack}>
            Back to Study
          </Button>
        )}
      </Box>
      {error && <Text className={styles.error}>{error}</Text>}
      {loading && <Text className={styles.loading}>Loading…</Text>}

      <Box className={styles.section}>
        <Heading level={3} className={styles.sectionTitle}>Decks</Heading>
        <Box className={styles.createRow}>
          <Input
            value={newDeckName}
            onChange={(e) => { setNewDeckName(e.target.value); }}
            placeholder="New deck name"
            aria-label="New deck name"
          />
          <Button
            variant="secondary"
            size="sm"
            onClick={() => { void handleCreateDeck(null); }}
            disabled={!newDeckName.trim()}
          >
            Create deck
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => { void handleCreateDeck(selectedDeckId ?? null); }}
            disabled={!newDeckName.trim()}
          >
            Create subdeck
          </Button>
        </Box>
        <Box className={styles.deckList}>
          {deckTree.length === 0 ? (
            <Text className={styles.empty}>No decks found.</Text>
          ) : (
            renderDeckTree(deckTree)
          )}
        </Box>
      </Box>

      {selectedDeck && (
        <Box className={styles.section}>
          <Heading level={3} className={styles.sectionTitle}>{selectedDeck.name} — Notes</Heading>
          <Box className={styles.noteList}>
            {notes.length === 0 ? (
              <Text className={styles.empty}>No notes in this deck.</Text>
            ) : (
              notes.map((note) => {
                const card = cards.find((c) => c.noteId === note.id);
                return (
                  <Box key={note.id} className={styles.noteRow}>
                    <Box className={styles.noteInfo}>
                      <Text className={styles.targetWord}>{note.targetWord}</Text>
                      <Text className={styles.progress}>{formatProgress(card)}</Text>
                    </Box>
                    <Box className={styles.noteActions}>
                      {card && (
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => { void handleDeleteCard(card.id); }}
                        >
                          Delete card
                        </Button>
                      )}
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => { void handleDeleteNote(note.id); }}
                      >
                        Delete note
                      </Button>
                    </Box>
                  </Box>
                );
              })
            )}
          </Box>
        </Box>
      )}
    </Box>
  );
}
