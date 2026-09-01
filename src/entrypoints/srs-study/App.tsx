import { useState } from 'react';
import { Box, Button, Heading, InputField, Text } from '@/shared/ui';
import { useSrsStudy } from '@/features/srs/ui/SrsStudyProvider';
import { normalizeSpelling } from '@/features/srs/lib/helpers';
import type { SrsFieldValue, SrsStimulus } from '@/entities/srs/types';
import { UserCssPanel } from './UserCssPanel';
import { SrsManagePanel } from './SrsManagePanel';
import styles from './App.module.css';

function formatFieldValue(value: SrsFieldValue): string {
  if (value.kind === 'list') return value.value.join(', ');
  return value.value;
}

function StimulusView({ stimulus }: { stimulus: SrsStimulus }) {
  const entries = Object.entries(stimulus.payload);

  return (
    <Box className={styles.stimulus}>
      <Text className={styles.stimulusType}>{stimulus.type}</Text>
      {entries.map(([fieldId, value]) => (
        <Box key={fieldId} className={styles.stimulusField}>
          {value.kind === 'image' ? (
            <img src={value.value} alt="" className={styles.stimulusImage} />
          ) : value.kind === 'audio' ? (
            <audio controls src={value.value} className={styles.stimulusAudio} />
          ) : (
            <Text className={styles.stimulusText}>{formatFieldValue(value)}</Text>
          )}
        </Box>
      ))}
    </Box>
  );
}

function SrsReviewCard() {
  const { session, submit, markStudyAgain, resetCurrentComponent, resetCurrentCard } = useSrsStudy();
  const [typedInput, setTypedInput] = useState('');

  if (!session) return null;

  const isSpelling = session.componentType === 'spelling';
  const inputMatches =
    !isSpelling || normalizeSpelling(typedInput) === normalizeSpelling(session.note.targetWord);

  return (
    <Box className={styles.card}>
      <Heading level={2} className={styles.title}>
        {session.note.targetWord}
      </Heading>
      <Text className={styles.componentType}>{session.componentType}</Text>
      <StimulusView stimulus={session.stimulus} />
      {isSpelling && (
        <InputField
          id="spelling-input"
          label="Type the word"
          value={typedInput}
          onChange={(e) => setTypedInput(e.currentTarget.value)}
          className={styles.spellingInput}
        />
      )}
      <Box className={styles.actions}>
        <Button
          className={styles.forgetButton}
          onClick={() => {
            setTypedInput('');
            void submit('forget', typedInput || undefined);
          }}
        >
          Forget
        </Button>
        <Button
          className={styles.studyButton}
          disabled={!inputMatches}
          onClick={() => {
            setTypedInput('');
            void submit('remember', typedInput || undefined);
          }}
        >
          Remember
        </Button>
      </Box>
      <Box className={styles.actions}>
        <Button
          variant="ghost"
          onClick={() => markStudyAgain(session.componentType)}
        >
          Study again
        </Button>
        <Button
          variant="ghost"
          onClick={() => {
            if (window.confirm(`Reset progress for ${session.componentType}?`)) {
              void resetCurrentComponent();
            }
          }}
        >
          Reset component
        </Button>
        <Button
          variant="ghost"
          onClick={() => {
            if (window.confirm('Reset all components for this card?')) {
              void resetCurrentCard();
            }
          }}
        >
          Reset card
        </Button>
      </Box>
    </Box>
  );
}

export function App() {
  const { loading, error, finished, start, session, stats } = useSrsStudy();
  const [view, setView] = useState<'study' | 'manage'>('study');

  return (
    <Box className={styles.page}>
      {error ? (
        <Box className={styles.card}>
          <Text className={styles.error}>{error}</Text>
        </Box>
      ) : session ? (
        <SrsReviewCard />
      ) : view === 'manage' ? (
        <SrsManagePanel onBack={() => { setView('study'); }} />
      ) : (
        <Box className={styles.card}>
          <Heading level={1} className={styles.title}>
            Ocean SRS
          </Heading>
          <Text className={styles.subtitle}>
            Spaced repetition for language acquisition. Data is stored locally in this
            browser — uninstalling the extension will delete it.
          </Text>
          {stats && (
            <Box className={styles.stats}>
              <Text className={styles.statLabel}>Due now: <span className={styles.statValue}>{stats.dueNow}</span></Text>
              <Text className={styles.statLabel}>Due in 24h: <span className={styles.statValue}>{stats.dueNext24h}</span></Text>
              <Text className={styles.statLabel}>Total: <span className={styles.statValue}>{stats.totalCards}</span> cards / {stats.totalNotes} notes</Text>
              <Text className={styles.statLabel}>Studied today: <span className={styles.statValue}>{stats.studiedToday}</span></Text>
            </Box>
          )}
          <Button
            className={styles.studyButton}
            onClick={start}
            disabled={loading}
            aria-label="Start study session"
          >
            {loading ? 'Loading…' : 'Study'}
          </Button>
          <Button
            className={styles.manageButton}
            variant="secondary"
            material="solid"
            onClick={() => { setView('manage'); }}
            aria-label="Open SRS management"
          >
            Manage
          </Button>
          {finished && (
            <Text className={styles.finishedText}>All caught up for now.</Text>
          )}
          <UserCssPanel />
        </Box>
      )}
    </Box>
  );
}
