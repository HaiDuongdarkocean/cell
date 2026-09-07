import { Card, Heading, Icon, Text } from '@/shared/ui';
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

interface ConceptCProps {
  controls: UseMockAudioReturn;
}

export function ConceptC({ controls }: ConceptCProps): React.JSX.Element {
  return (
    <Card className={styles.maCFrame}>
      <div className={styles.maCHeader}>
        <Heading level={4} size={4}>Audio</Heading>
        <Text as="p" color="secondary">
          All audio sources flow into one output. Reorder the chain and tune each channel.
        </Text>
      </div>

      <div className={styles.maCRail}>
        <PriorityChain controls={controls} variant="rail" />
        <AudioTester controls={controls} compact className={styles.maCTester} />
      </div>

      <div className={styles.maCChannels}>
        <Card className={styles.maCChannel}>
          <div className={styles.maCChannelHeader}>
            <Icon name="folderOpen" size="sm" />
            <Heading level={5} size={5}>Local package</Heading>
          </div>
          <LocalPackagePanel controls={controls} />
        </Card>

        <Card className={styles.maCChannel}>
          <div className={styles.maCChannelHeader}>
            <Icon name="volumeHigh" size="sm" />
            <Heading level={5} size={5}>TTS voices</Heading>
          </div>
          <TtsSettingsPanel controls={controls} />
          <TtsTesterPanel controls={controls} />
          <TtsLocalPacksPanel controls={controls} />
        </Card>
      </div>
    </Card>
  );
}
