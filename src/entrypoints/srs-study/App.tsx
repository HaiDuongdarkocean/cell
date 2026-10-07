import { useState } from 'react';
import { Box, Button, Heading, Text } from '@/shared/ui';
import { t } from '@/shared/i18n';
import { useSrsStudy } from '@/features/srs/ui/SrsStudyProvider';
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

function initialSearch(): { view: SrsView; deckId: string | undefined } {
  const params = new URLSearchParams(location.search);
  return {
    view: params.get('view') === 'pump' ? 'pump' : 'home',
    deckId: params.get('deckId') ?? undefined,
  };
}

export function App() {
  const { loading, error, session, dismissError } = useSrsStudy();
  const [initial] = useState(initialSearch);
  const [view, setView] = useState<SrsView>(initial.view);
  const [deckTarget, setDeckTarget] = useState<{ deck: SrsDeck; decks: readonly SrsDeck[]; mode: 'view' | 'change' } | null>(null);
  const [decksVersion, setDecksVersion] = useState(0);
  const [settingsOpen, setSettingsOpen] = useState(false);

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
      ) : view === 'deck' && deckTarget ? (
        <SrsDeckDetail
          key={`${deckTarget.deck.id}-${decksVersion}`}
          deck={deckTarget.deck}
          decks={deckTarget.decks}
          initialMode={deckTarget.mode}
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
