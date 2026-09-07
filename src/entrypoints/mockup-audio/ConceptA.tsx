import { Card, Heading, Icon, Text, VStack } from '@/shared/ui';
import {
  AudioTester,
  LocalPackagePanel,
  PriorityChain,
  TtsLocalPacksPanel,
  TtsSettingsPanel,
  TtsTesterPanel,
} from './common';
import type { UseMockAudioReturn } from './state';
import styles from './mockup.module.css';

interface ConceptAProps {
  controls: UseMockAudioReturn;
}

export function ConceptA({ controls }: ConceptAProps): React.JSX.Element {
  return (
    <Card className={styles.maAFrame}>
      <div className={styles.maAHeader}>
        <Heading level={4} size={4}>Audio</Heading>
        <Text as="p" color="secondary">
          Choose and reorder audio sources for word playback.
        </Text>
      </div>

      <AudioTester controls={controls} />

      <section className={styles.maAGroup}>
        <div className={styles.maGroupHeader}>
          <Icon name="moveVertical" size="sm" />
          <Heading level={5} size={5}>Source priority</Heading>
        </div>
        <Text as="p" color="secondary" className={styles.maGroupDesc}>
          Audio sources are tried from top to bottom. Use the buttons to change the order.
        </Text>
        <PriorityChain controls={controls} />
      </section>

      <section className={styles.maAGroup}>
        <div className={styles.maGroupHeader}>
          <Icon name="folderOpen" size="sm" />
          <Heading level={5} size={5}>Local package</Heading>
        </div>
        <LocalPackagePanel controls={controls} />
      </section>

      <section className={styles.maAGroup}>
        <div className={styles.maGroupHeader}>
          <Icon name="volumeHigh" size="sm" />
          <Heading level={5} size={5}>TTS voices</Heading>
        </div>
        <VStack gap="4">
          <TtsSettingsPanel controls={controls} />
          <TtsTesterPanel controls={controls} />
          <TtsLocalPacksPanel controls={controls} />
        </VStack>
      </section>
    </Card>
  );
}
