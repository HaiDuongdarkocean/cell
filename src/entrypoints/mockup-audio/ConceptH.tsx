import { useMemo, useState, type ReactElement } from 'react';
import { Card, Heading, Icon, Select, SettingsRow, Text, Toggle, VStack } from '@/shared/ui';
import { ICON_CATALOG } from '@/shared/icons';
import type { AudioEngineKind } from '@/entities/settings/types';
import {
  AudioTester,
  LocalPackagePanel,
  TtsLocalPacksPanel,
  TtsSettingsPanel,
  TtsTesterPanel,
} from './common';
import { AUTOPLAY_OPTIONS, ENGINE_LABELS } from './mockData';
import type { AudioMockState, UseMockAudioReturn } from './state';
import styles from './mockup.module.css';

type OutputMode = 'auto' | 'natural' | 'fast' | 'offline' | 'minimal';

const MODES: { value: OutputMode; label: string; desc: string }[] = [
  { value: 'auto', label: 'Auto', desc: 'Best source for current context' },
  { value: 'natural', label: 'Natural', desc: 'Human-like audio first' },
  { value: 'fast', label: 'Fast', desc: 'Low latency, no download' },
  { value: 'offline', label: 'Offline', desc: 'Local files and downloaded packs' },
  { value: 'minimal', label: 'Min data', desc: 'No large downloads' },
];

const MODE_CHAINS: Record<OutputMode, AudioEngineKind[]> = {
  auto: ['localFile', 'native', 'supertonic', 'browserTts', 'espeak'],
  natural: ['native', 'localFile', 'browserTts', 'supertonic', 'espeak'],
  fast: ['browserTts', 'native', 'localFile', 'espeak'],
  offline: ['localFile', 'espeak', 'supertonic'],
  minimal: ['browserTts', 'espeak'],
};

const ENGINE_ICONS = {
  localFile: 'folderOpen',
  native: 'audioWave',
  supertonic: 'download',
  browserTts: 'play',
  espeak: 'settings',
} as const satisfies Record<AudioEngineKind, keyof typeof ICON_CATALOG>;

interface ConceptHProps {
  readonly controls: UseMockAudioReturn;
}

function getEngineStatus(engine: AudioEngineKind, state: AudioMockState): 'ready' | 'missing' | 'disabled' {
  const { pronunciation, tts } = state;
  if (!pronunciation.fallbackEngines.includes(engine)) return 'disabled';

  switch (engine) {
    case 'localFile':
      return pronunciation.localFile.dslFileHandleId && pronunciation.localFile.lastIndexedAt ? 'ready' : 'missing';
    case 'supertonic':
      return tts.downloadedLanguages.includes('en') ? 'ready' : 'missing';
    case 'espeak':
      return pronunciation.downloadEspeakTtsData ? 'ready' : 'missing';
    default:
      return 'ready';
  }
}

interface DetailPanelProps {
  readonly engine: AudioEngineKind | null;
  readonly controls: UseMockAudioReturn;
}

function DetailPanel({ engine, controls }: DetailPanelProps): ReactElement | null {
  if (!engine) {
    return (
      <div className={styles.maHDetailEmpty}>
        <Text as="p" color="secondary">
          Tap a source in the pipeline to inspect or tune it.
        </Text>
      </div>
    );
  }

  return (
    <div className={styles.maHDetail} data-engine={engine}>
      <div className={styles.maHDetailHeader}>
        <Icon name={ENGINE_ICONS[engine]} size="sm" />
        <Text as="h5" className={styles.maHDetailTitle}>
          {ENGINE_LABELS[engine]}
        </Text>
      </div>
      {engine === 'localFile' && <LocalPackagePanel controls={controls} />}
      {engine === 'native' && (
        <Text as="p" color="secondary">Community audio from Wikimedia. No configuration needed.</Text>
      )}
      {engine === 'supertonic' && <TtsLocalPacksPanel controls={controls} />}
      {engine === 'browserTts' && (
        <>
          <TtsSettingsPanel controls={controls} />
          <TtsTesterPanel controls={controls} />
        </>
      )}
      {engine === 'espeak' && (
        <SettingsRow dense>
          <span>Download eSpeak data</span>
          <Toggle
            checked={controls.state.pronunciation.downloadEspeakTtsData}
            onChange={controls.setDownloadEspeak}
            ariaLabel="Download eSpeak data"
          />
        </SettingsRow>
      )}
    </div>
  );
}

export function ConceptH({ controls }: ConceptHProps): ReactElement {
  const [mode, setMode] = useState<OutputMode>('auto');
  const [selectedEngine, setSelectedEngine] = useState<AudioEngineKind | null>(null);
  const [voiceCharacter, setVoiceCharacter] = useState('natural');
  const { state } = controls;

  const chain = useMemo(() => {
    const base = MODE_CHAINS[mode];
    return base.filter((e) => state.pronunciation.fallbackEngines.includes(e));
  }, [mode, state.pronunciation.fallbackEngines]);

  return (
    <Card className={styles.maHFrame}>
      <div className={styles.maHHeader}>
        <Heading level={4} size={4}>
          Audio
        </Heading>
        <Text as="p" color="secondary">
          Pick an output mode, then tap any source in the pipeline to tune it.
        </Text>
      </div>

      <VStack gap="4" className={styles.maHBody}>
        <SettingsRow dense>
          <span className={styles.maHLabel}>Enable audio</span>
          <Toggle
            checked={state.tts.enabled}
            onChange={controls.setTtsEnabled}
            ariaLabel="Enable audio"
          />
        </SettingsRow>

        <div className={styles.maGSegmented} role="group" aria-label="Output mode">
          {MODES.map((m) => (
            <button
              key={m.value}
              type="button"
              className={`${styles.maGMode} ${mode === m.value ? styles.maGModeActive : ''}`}
              onClick={() => setMode(m.value)}
              aria-pressed={mode === m.value}
              title={m.desc}
            >
              {m.label}
            </button>
          ))}
        </div>

        <AudioTester controls={controls} compact />

        <div className={styles.maHRow}>
          <SettingsRow dense className={styles.maHRowItem}>
            <span className={styles.maHLabel}>Voice character</span>
            <Select
              value={voiceCharacter}
              options={[
                { value: 'natural', label: 'Natural' },
                { value: 'clear', label: 'Clear' },
                { value: 'system', label: 'System' },
              ]}
              onChange={setVoiceCharacter}
            />
          </SettingsRow>
          <SettingsRow dense className={styles.maHRowItem}>
            <span className={styles.maHLabel}>Autoplay</span>
            <Select
              value={String(state.tts.autoplayCount)}
              options={AUTOPLAY_OPTIONS}
              onChange={(v) => controls.setAutoplayCount(Number(v))}
            />
          </SettingsRow>
        </div>

        <div className={styles.maHPipeline}>
          <Text as="h5" className={styles.maHPipelineTitle}>
            Audio pipeline
          </Text>
          <div className={styles.maHPipelineTrack} role="list">
            {chain.map((engine, index) => {
              const status = getEngineStatus(engine, state);
              const isSelected = selectedEngine === engine;
              return (
                <button
                  key={engine}
                  type="button"
                  className={`${styles.maHPipelineStep} ${isSelected ? styles.maHPipelineStepActive : ''}`}
                  onClick={() => setSelectedEngine(engine)}
                  role="listitem"
                >
                  <span className={`${styles.maHPipelineDot} ${styles[`maHPipelineDot${status}`]}`} />
                  <Icon name={ENGINE_ICONS[engine]} size="sm" />
                  <span className={styles.maHPipelineLabel}>{ENGINE_LABELS[engine]}</span>
                  {index < chain.length - 1 && (
                    <span className={styles.maHPipelineArrow} aria-hidden="true">→</span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        <DetailPanel engine={selectedEngine} controls={controls} />
      </VStack>
    </Card>
  );
}
