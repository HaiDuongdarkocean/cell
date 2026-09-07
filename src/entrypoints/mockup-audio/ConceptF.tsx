import { useState, type ReactElement } from 'react';
import { Card, Heading, Icon, Text, VStack } from '@/shared/ui';
import {
  AudioTester,
  LocalPackagePanel,
  PriorityChain,
  TtsLocalPacksPanel,
  TtsSettingsPanel,
  TtsTesterPanel,
} from './common';
import { ENGINE_LABELS } from './mockData';
import type { UseMockAudioReturn } from './state';
import styles from './mockup.module.css';

interface ConceptFProps {
  controls: UseMockAudioReturn;
}

type DetailId = 'priority' | 'local' | 'tts';
type SelectedId = DetailId | string;

const DETAIL_FOR_ENGINE: Record<string, DetailId> = {
  localFile: 'local',
  native: 'local',
  supertonic: 'tts',
  browserTts: 'tts',
  espeak: 'tts',
};

export function ConceptF({ controls }: ConceptFProps): ReactElement {
  const [detail, setDetail] = useState<DetailId>('priority');
  const [selected, setSelected] = useState<SelectedId>('priority');
  const list = controls.state.pronunciation.fallbackEngines;

  return (
    <Card className={styles.maFFrame}>
      <div className={styles.maFHeader}>
        <Heading level={4} size={4}>Audio</Heading>
        <Text as="p" color="secondary">
          Pick a source on the left to inspect and tune it. Test at the top.
        </Text>
      </div>

      <div className={styles.maFTester}>
        <AudioTester controls={controls} />
      </div>

      <div className={styles.maFSplit}>
        <aside className={styles.maFRail} role="tablist" aria-label="Audio source inspector">
          <button
            type="button"
            className={[styles.maFRailItem, selected === 'priority' ? styles.maFRailActive : ''].join(' ')}
            aria-selected={selected === 'priority'}
            onClick={() => { setDetail('priority'); setSelected('priority'); }}
          >
            <Icon name="moveVertical" size="sm" />
            <span className={styles.maFRailLabel}>Priority chain</span>
            <span className={styles.maFRailHint}>All sources</span>
          </button>

          {list.map((engine) => (
            <button
              key={engine}
              type="button"
              className={[styles.maFRailItem, selected === engine ? styles.maFRailActive : ''].join(' ')}
              aria-selected={selected === engine}
              onClick={() => { setDetail(DETAIL_FOR_ENGINE[engine] ?? 'priority'); setSelected(engine); }}
            >
              <Icon name={engine === 'localFile' ? 'folderOpen' : engine === 'native' ? 'languages' : 'volumeHigh'} size="sm" />
              <span className={styles.maFRailLabel}>{ENGINE_LABELS[engine]}</span>
              <span className={styles.maFRailHint}>{engine}</span>
            </button>
          ))}
        </aside>

        <section className={styles.maFDetail}>
          {detail === 'priority' && (
            <>
              <div className={styles.maGroupHeader}>
                <Icon name="moveVertical" size="sm" />
                <Heading level={5} size={5}>Source priority</Heading>
              </div>
              <Text as="p" color="secondary" className={styles.maGroupDesc}>
                Reorder sources by dragging or using the buttons.
              </Text>
              <PriorityChain controls={controls} />
            </>
          )}

          {detail === 'local' && (
            <>
              <div className={styles.maGroupHeader}>
                <Icon name="folderOpen" size="sm" />
                <Heading level={5} size={5}>Local package</Heading>
              </div>
              <LocalPackagePanel controls={controls} />
            </>
          )}

          {detail === 'tts' && (
            <VStack gap="4">
              <div className={styles.maGroupHeader}>
                <Icon name="volumeHigh" size="sm" />
                <Heading level={5} size={5}>TTS voices</Heading>
              </div>
              <TtsSettingsPanel controls={controls} />
              <TtsTesterPanel controls={controls} />
              <TtsLocalPacksPanel controls={controls} />
            </VStack>
          )}
        </section>
      </div>
    </Card>
  );
}
