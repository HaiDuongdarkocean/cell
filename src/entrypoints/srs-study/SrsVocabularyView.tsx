import { useEffect, useState } from 'react';
import { Box, Button, Heading } from '@/shared/ui';
import { Icon } from '@/shared/ui/Icon';
import { t } from '@/shared/i18n';
import { VocabularyTab } from '@/features/vocabulary';
import { ensureFirstRun } from '@/features/srs/services/firstRunService';
import { getCollection } from '@/features/srs/repositories/collectionRepository';
import styles from './SrsVocabularyView.module.css';

export interface SrsVocabularyViewProps {
  readonly onBack: () => void;
}

export function SrsVocabularyView({ onBack }: SrsVocabularyViewProps): React.JSX.Element {
  const [targetLanguage, setTargetLanguage] = useState('en');

  useEffect(() => {
    void (async () => {
      const result = await ensureFirstRun();
      const collection = await getCollection(result.collectionId);
      setTargetLanguage(collection.targetLanguage || 'en');
    })().catch(() => {});
  }, []);

  return (
    <Box className={styles.view}>
      <Box className={styles.topBar}>
        <Button variant="ghost" size="sm" shape="circle" onClick={onBack} aria-label={t('ui.back')} className={styles.chromeButton}>
          <Icon name="chevronLeft" />
        </Button>
        <Heading level={1} className={styles.title}>{t('panel.tab.vocabulary')}</Heading>
      </Box>
      <VocabularyTab langCode={targetLanguage} onLookup={() => {}} />
    </Box>
  );
}
