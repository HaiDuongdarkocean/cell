import { useState } from 'react';
import { Box, Button, Heading, Text } from '@/shared/ui';
import { t } from '@/shared/i18n';
import { useSrsStudy } from '@/features/srs/ui/SrsStudyProvider';
import { SrsManagePanel } from './SrsManagePanel';
import { SrsReviewCard } from './SrsReviewCard';
import { SrsHome } from './SrsHome';
import { SrsStudySettings } from './SrsStudySettings';
import styles from './App.module.css';

export function App() {
  const { loading, error, session, dismissError } = useSrsStudy();
  const [view, setView] = useState<'home' | 'manage'>('home');
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
        <SrsReviewCard onManage={() => { setView('manage'); }} />
      ) : view === 'manage' ? (
        <SrsManagePanel onBack={() => { setView('home'); }} />
      ) : (
        <SrsHome
          onManage={() => { setView('manage'); }}
          onOpenSettings={() => { setSettingsOpen(true); }}
        />
      )}
      {settingsOpen && !loading && (
        <SrsStudySettings onClose={() => { setSettingsOpen(false); }} />
      )}
    </Box>
  );
}
