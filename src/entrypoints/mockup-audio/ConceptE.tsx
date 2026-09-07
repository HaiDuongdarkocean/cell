import { Card, Heading, Icon, Text, Accordion } from '@/shared/ui';
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

interface ConceptEProps {
  controls: UseMockAudioReturn;
}

export function ConceptE({ controls }: ConceptEProps): React.JSX.Element {
  return (
    <Card className={styles.maEFrame}>
      <div className={styles.maEHeader}>
        <Heading level={4} size={4}>Audio</Heading>
        <Text as="p" color="secondary">
          Open the channels you want to tune, then use the tester to hear your setup.
        </Text>
      </div>

      <div className={styles.maETesterWrap}>
        <AudioTester controls={controls} />
      </div>

      <div className={styles.maEAccordion}>
        <Accordion type="multiple" defaultValue={['priority']}>
          <Accordion.Item value="priority">
            <Accordion.Trigger className={styles.maETrigger}>
              <span className={styles.maETriggerInner}>
                <Icon name="moveVertical" size="sm" />
                <span className={styles.maETriggerLabel}>Source priority</span>
                <span className={styles.maETriggerHint}>Which source plays first</span>
              </span>
            </Accordion.Trigger>
            <Accordion.Content className={styles.maEContent}>
              <Text as="p" color="secondary" className={styles.maGroupDesc}>
                Audio sources are tried from top to bottom. Use the buttons to change the order.
              </Text>
              <PriorityChain controls={controls} />
            </Accordion.Content>
          </Accordion.Item>

          <Accordion.Item value="local">
            <Accordion.Trigger className={styles.maETrigger}>
              <span className={styles.maETriggerInner}>
                <Icon name="folderOpen" size="sm" />
                <span className={styles.maETriggerLabel}>Local package</span>
                <span className={styles.maETriggerHint}>Offline audio files</span>
              </span>
            </Accordion.Trigger>
            <Accordion.Content className={styles.maEContent}>
              <LocalPackagePanel controls={controls} />
            </Accordion.Content>
          </Accordion.Item>

          <Accordion.Item value="tts">
            <Accordion.Trigger className={styles.maETrigger}>
              <span className={styles.maETriggerInner}>
                <Icon name="volumeHigh" size="sm" />
                <span className={styles.maETriggerLabel}>TTS voices</span>
                <span className={styles.maETriggerHint}>Read-aloud fallback</span>
              </span>
            </Accordion.Trigger>
            <Accordion.Content className={styles.maEContent}>
              <TtsSettingsPanel controls={controls} />
              <TtsTesterPanel controls={controls} />
            </Accordion.Content>
          </Accordion.Item>

          <Accordion.Item value="local-tts">
            <Accordion.Trigger className={styles.maETrigger}>
              <span className={styles.maETriggerInner}>
                <Icon name="download" size="sm" />
                <span className={styles.maETriggerLabel}>Local speech packs</span>
                <span className={styles.maETriggerHint}>Supertonic v3 offline voices</span>
              </span>
            </Accordion.Trigger>
            <Accordion.Content className={styles.maEContent}>
              <TtsLocalPacksPanel controls={controls} />
            </Accordion.Content>
          </Accordion.Item>
        </Accordion>
      </div>
    </Card>
  );
}
