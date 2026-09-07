import { Card, Heading, Icon, Tabs, Text } from '@/shared/ui';
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

interface ConceptBProps {
  controls: UseMockAudioReturn;
}

export function ConceptB({ controls }: ConceptBProps): React.JSX.Element {
  return (
    <Card className={styles.maBFrame}>
      <div className={styles.maBHeader}>
        <Heading level={4} size={4}>Audio</Heading>
        <Text as="p" color="secondary">
          Choose and reorder audio sources for word playback.
        </Text>
      </div>

      <div className={styles.maBTesterWrap}>
        <AudioTester controls={controls} />
      </div>

      <Tabs defaultValue="priority">
        <Tabs.List className={styles.maBTabsList}>
          <Tabs.Trigger value="priority" className={styles.maBTabTrigger}>
            <Icon name="moveVertical" size="xs" /> Source priority
          </Tabs.Trigger>
          <Tabs.Trigger value="local" className={styles.maBTabTrigger}>
            <Icon name="folderOpen" size="xs" /> Local package
          </Tabs.Trigger>
          <Tabs.Trigger value="tts" className={styles.maBTabTrigger}>
            <Icon name="volumeHigh" size="xs" /> TTS voices
          </Tabs.Trigger>
        </Tabs.List>

        <Tabs.Content value="priority" className={styles.maBTabContent}>
          <Text as="p" color="secondary" className={styles.maGroupDesc}>
            Audio sources are tried from top to bottom. Use the buttons to change the order.
          </Text>
          <PriorityChain controls={controls} />
        </Tabs.Content>

        <Tabs.Content value="local" className={styles.maBTabContent}>
          <LocalPackagePanel controls={controls} />
        </Tabs.Content>

        <Tabs.Content value="tts" className={styles.maBTabContent}>
          <TtsSettingsPanel controls={controls} />
          <TtsTesterPanel controls={controls} />
          <TtsLocalPacksPanel controls={controls} />
        </Tabs.Content>
      </Tabs>
    </Card>
  );
}
