import { useState } from 'react';
import { Box, Button, Heading, Text } from '@/shared/ui';
import { t } from '@/shared/i18n';
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
            {t('srs.title')}
          </Heading>
          <Text className={styles.error}>{error}</Text>
          <Button variant="secondary" onClick={dismissError}>
            {t('ui.back')}
          </Button>
        </Box>
      ) : session ? (
        <SrsReviewCard />
      ) : view === 'manage' ? (
        <SrsManagePanel onBack={() => { setView('study'); }} />
      ) : (
        <Box className={styles.card}>
          <Heading level={1} className={styles.title}>
            {t('srs.title')}
          </Heading>
          <Text className={styles.subtitle}>
            {t('srs.app.desc')}
          </Text>
          {stats && (
            <Box className={styles.stats}>
              <Text className={styles.statLabel}>{t('srs.stats.dueNow')} <span className={styles.statValue}>{stats.dueNow}</span></Text>
              <Text className={styles.statLabel}>{t('srs.stats.due24h')} <span className={styles.statValue}>{stats.dueNext24h}</span></Text>
              <Text className={styles.statLabel}>{t('srs.stats.totalLabel')} <span className={styles.statValue}>{t('srs.stats.totalCounts', [stats.totalCards, stats.totalNotes])}</span></Text>
              <Text className={styles.statLabel}>{t('srs.stats.studiedToday')} <span className={styles.statValue}>{stats.studiedToday}</span></Text>
            </Box>
          )}
          <Button
            className={styles.studyButton}
            onClick={() => { void start(); }}
            disabled={loading}
          >
            {loading ? t('srs.action.loading') : t('srs.action.study')}
          </Button>
          <Button
            className={styles.manageButton}
            variant="secondary"
            onClick={() => { setView('manage'); }}
          >
            {t('srs.manage.title')}
          </Button>
          {finished && (
            <Text className={styles.finishedText}>{t('srs.finished')}</Text>
          )}
          <UserCssPanel />
        </Box>
      )}
    </Box>
  );
}
