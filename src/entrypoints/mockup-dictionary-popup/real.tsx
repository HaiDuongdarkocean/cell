import type React from 'react';
import { DictionaryPopupSettingsPanel } from '@/features/settings/ui/DictionaryPopupSettingsPanel';
import { Heading, Text, Card, VStack } from '@/shared/ui';
import type { DictionaryPopupSettings } from '@/entities/settings/types';
import styles from './mockup.module.css';

interface RealPanelProps {
  settings: DictionaryPopupSettings;
  onChange: (settings: DictionaryPopupSettings) => void;
}

export function RealPanel({ settings, onChange }: RealPanelProps): React.JSX.Element {
  return (
    <Card className={styles.realCard}>
      <div className={styles.realHeader}>
        <Heading level={4} size={4} className={styles.realTitle}>
          Dictionary Popup
        </Heading>
        <Text as="p" color="secondary" className={styles.realDesc}>
          Hover or click words in subtitles to see definitions, audio, images, and Quick Add to Anki.
        </Text>
      </div>
      <VStack gap="0" className={styles.realBody}>
        <DictionaryPopupSettingsPanel settings={settings} onChange={onChange} />
      </VStack>
    </Card>
  );
}
