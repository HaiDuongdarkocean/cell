import { useEffect, useState } from 'react';
import { Box, Button, Heading, Spinner, Text } from '@/shared/ui';
import { t } from '@/shared/i18n';
import { useSrsStudy } from '@/features/srs/ui/SrsStudyProvider';
import { normalizeTerm } from '@/features/dictionary';
import { ensureFirstRun } from '@/features/srs/services/firstRunService';
import { getDecksByCollection } from '@/features/srs/repositories/deckRepository';
import { getNotesByDeck } from '@/features/srs/repositories/noteRepository';
import { PumpView } from '@/features/phrasePump';
import { SrsReviewCard } from './SrsReviewCard';
import { SrsHome } from './SrsHome';
import { SrsStudySettings } from './SrsStudySettings';
import { SrsStreaksView } from './SrsStreaksView';
import { SrsVocabularyView } from './SrsVocabularyView';
import { SrsDeckDetail } from './SrsDeckDetail';
import type { SrsDeck } from '@/entities/srs/types';
import styles from './App.module.css';

type SrsView = 'home' | 'deck' | 'streaks' | 'vocabulary' | 'pump';

interface TermDeckMatch {
  readonly deck: SrsDeck;
  readonly count: number;
}

function initialSearch(): { view: SrsView; deckId: string | undefined; term: string | undefined } {
  const params = new URLSearchParams(location.search);
  return {
    view: params.get('view') === 'pump' ? 'pump' : 'home',
    deckId: params.get('deckId') ?? undefined,
    term: params.get('term') ?? undefined,
  };
}

function TermDeckPicker({
  term,
  matches,
  onPick,
  onBack,
}: {
  readonly term: string;
  readonly matches: readonly TermDeckMatch[];
  readonly onPick: (deck: SrsDeck) => void;
  readonly onBack: () => void;
}): React.JSX.Element {
  return (
    <Box className={styles.card}>
      <Heading level={1} className={styles.title}>{t('srs.termPicker.title')}</Heading>
      <Text className={styles.subtitle}>{term}</Text>
      {matches.map((match) => (
        <Button key={match.deck.id} variant="secondary" fullWidth onClick={() => { onPick(match.deck); }}>
          {match.deck.name} · {t('srs.deck.cardsCount', [match.count])}
        </Button>
      ))}
      <Button variant="ghost" onClick={onBack}>{t('ui.back')}</Button>
    </Box>
  );
}

export function App() {
  const { loading, error, session, dismissError } = useSrsStudy();
  const [initial] = useState(initialSearch);
  const [view, setView] = useState<SrsView>(initial.view);
  const [deckTarget, setDeckTarget] = useState<{ deck: SrsDeck; decks: readonly SrsDeck[]; mode: 'view' | 'change'; initialQuery?: string } | null>(null);
  const [decksVersion, setDecksVersion] = useState(0);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [termMatches, setTermMatches] = useState<readonly TermDeckMatch[] | 'loading' | null>(initial.term ? 'loading' : null);
  const [termDecks, setTermDecks] = useState<readonly SrsDeck[]>([]);

  useEffect(() => {
    const term = initial.term;
    if (!term) return;
    let alive = true;
    const needle = normalizeTerm(term);
    void (async () => {
      const { collectionId } = await ensureFirstRun();
      const decks = await getDecksByCollection(collectionId);
      const matches: TermDeckMatch[] = [];
      for (const deck of decks) {
        const count = (await getNotesByDeck(deck.id)).filter(
          (note) => normalizeTerm(note.targetWord) === needle,
        ).length;
        if (count > 0) matches.push({ deck, count });
      }
      if (!alive) return;
      setTermDecks(decks);
      if (matches.length === 1) {
        setDeckTarget({ deck: matches[0]!.deck, decks, mode: 'view', initialQuery: term });
        setView('deck');
        setTermMatches(null);
      } else {
        setTermMatches(matches);
      }
    })().catch(() => { if (alive) setTermMatches(null); });
    return () => { alive = false; };
  }, [initial.term]);

  return (
    <Box className={styles.page}>
      {error ? (
        <Box className={styles.card}>
          <Heading level={1} className={styles.title}>
            {t('srs.title')}
          </Heading>
          <Text className={styles.error}>{error}</Text>
          <Button variant="secondary" onClick={dismissError}>
            {t('ui.back')}
          </Button>
        </Box>
      ) : session ? (
        <SrsReviewCard />
      ) : termMatches === 'loading' ? (
        <Box className={styles.card}>
          <Spinner />
        </Box>
      ) : termMatches && termMatches.length > 1 ? (
        <TermDeckPicker
          term={initial.term ?? ''}
          matches={termMatches}
          onPick={(deck) => {
            setDeckTarget({ deck, decks: termDecks, mode: 'view', initialQuery: initial.term });
            setView('deck');
            setTermMatches(null);
          }}
          onBack={() => { setTermMatches(null); }}
        />
      ) : view === 'deck' && deckTarget ? (
        <SrsDeckDetail
          key={`${deckTarget.deck.id}-${decksVersion}`}
          deck={deckTarget.deck}
          decks={deckTarget.decks}
          initialMode={deckTarget.mode}
          initialQuery={deckTarget.initialQuery}
          onBack={() => { setView('home'); }}
          onChanged={() => { setDecksVersion((v) => v + 1); }}
        />
      ) : view === 'streaks' ? (
        <SrsStreaksView onBack={() => { setView('home'); }} />
      ) : view === 'vocabulary' ? (
        <SrsVocabularyView onBack={() => { setView('home'); }} />
      ) : view === 'pump' ? (
        <PumpView onBack={() => { setView('home'); }} initialDeckId={initial.deckId} />
      ) : (
        <SrsHome
          onOpenSettings={() => { setSettingsOpen(true); }}
          onOpenStreaks={() => { setView('streaks'); }}
          onOpenVocabulary={() => { setView('vocabulary'); }}
          onOpenPump={() => { setView('pump'); }}
          onOpenDeck={(deck, mode, decks) => {
            setDeckTarget({ deck, decks, mode });
            setView('deck');
          }}
        />
      )}
      {settingsOpen && !loading && (
        <SrsStudySettings onClose={() => { setSettingsOpen(false); }} />
      )}
    </Box>
  );
}
