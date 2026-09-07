import { useState } from 'react';
import { Box, Button, Heading, Text } from '@/shared/ui';
import { useSrsStudy } from '@/features/srs/ui/SrsStudyProvider';
import { UserCssPanel } from './UserCssPanel';
import { SrsManagePanel } from './SrsManagePanel';
import { SrsReviewCard } from './SrsReviewCard';
import styles from './App.module.css';

export function App() {
  const { loading, error, finished, start, session, stats, dismissError } = useSrsStudy();
  const [view, setView] = useState<'study' | 'manage'>('study');

  return (
    <Box className={styles.page}>
      {error ? (
        <Box className={styles.card}>
          <Heading level={1} className={styles.title}>
            Ocean SRS
          </Heading>
          <Text className={styles.error}>{error}</Text>
          <Button variant="secondary" onClick={dismissError}>
            Back
          </Button>
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
          >
            {loading ? 'Loading…' : 'Study'}
          </Button>
          <Button
            className={styles.manageButton}
            variant="secondary"
            onClick={() => { setView('manage'); }}
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
