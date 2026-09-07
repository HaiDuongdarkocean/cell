import { useMemo, useState, type ReactElement } from 'react';
import {
  Button,
  Card,
  Heading,
  Icon,
  Select,
  SettingsRow,
  Text,
  Toggle,
  VStack,
} from '@/shared/ui';
import type { AudioEngineKind } from '@/entities/settings/types';
import {
  AudioTester,
  LocalPackagePanel,
  PriorityChain,
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

interface ConceptGProps {
  readonly controls: UseMockAudioReturn;
}

interface MagicChip {
  readonly id: string;
  readonly label: string;
  readonly action: () => void;
}

function getMagicChips(mode: OutputMode, state: AudioMockState, controls: UseMockAudioReturn): MagicChip[] {
  const chips: MagicChip[] = [];
  const { pronunciation, tts } = state;

  if (!tts.enabled) {
    chips.push({
      id: 'enable-tts',
      label: 'Enable audio',
      action: () => controls.setTtsEnabled(true),
    });
    return chips;
  }

  if (mode === 'offline' || mode === 'natural') {
    if (!pronunciation.localFile.dslFileHandleId) {
      chips.push({
        id: 'choose-dsl',
        label: 'Choose .dsl file',
        action: () => controls.pickDsl(),
      });
    } else if (!pronunciation.localFile.lastIndexedAt) {
      chips.push({
        id: 'build-index',
        label: 'Build index',
        action: () => controls.buildIndex(),
      });
    }
    if (!tts.downloadedLanguages.includes('en')) {
      chips.push({
        id: 'download-supertonic',
        label: 'Download English pack',
        action: () => controls.downloadLanguage('en'),
      });
    }
  }

  if (
    (mode === 'offline' || mode === 'auto') &&
    pronunciation.fallbackEngines.includes('espeak') &&
    !pronunciation.downloadEspeakTtsData
  ) {
    chips.push({
      id: 'download-espeak',
      label: 'Download eSpeak data',
      action: () => controls.setDownloadEspeak(true),
    });
  }

  return chips;
}

function LocalStatus({ state }: { readonly state: AudioMockState }): ReactElement {
  const { localFile } = state.pronunciation;
  const { tts } = state;

  return (
    <div className={styles.maGStatusList}>
      <div className={styles.maGStatusItem}>
        <Icon name="folderOpen" size="sm" />
        <span className={styles.maGStatusLabel}>Forvo package:</span>
        <Text as="span" color="secondary" className={styles.maGStatusValue}>
          {localFile.dslFileHandleId
            ? localFile.lastIndexedAt
              ? 'Indexed'
              : 'Needs rebuild'
            : 'Not set'}
        </Text>
      </div>
      <div className={styles.maGStatusItem}>
        <Icon name="download" size="sm" />
        <span className={styles.maGStatusLabel}>Supertonic:</span>
        <Text as="span" color="secondary" className={styles.maGStatusValue}>
          {tts.downloadedLanguages.includes('en') ? 'English ready' : 'Not downloaded'}
        </Text>
      </div>
    </div>
  );
}

interface AdvancedSectionProps {
  readonly id: string;
  readonly title: string;
  readonly open: readonly string[];
  readonly toggle: (id: string) => void;
  readonly children: React.ReactNode;
}

function AdvancedSection({ id, title, open, toggle, children }: AdvancedSectionProps): ReactElement {
  const isOpen = open.includes(id);
  return (
    <div className={styles.maGAdvancedSection}>
      <button type="button" className={styles.maGSectionTrigger} onClick={() => toggle(id)}>
        <span>{title}</span>
        <Icon
          name="chevronDown"
          size="sm"
          style={{ transform: isOpen ? 'rotate(180deg)' : undefined }}
        />
      </button>
      {isOpen && <div className={styles.maGSectionContent}>{children}</div>}
    </div>
  );
}

export function ConceptG({ controls }: ConceptGProps): ReactElement {
  const [mode, setMode] = useState<OutputMode>('auto');
  const [openSections, setOpenSections] = useState<readonly string[]>([]);
  const [voiceCharacter, setVoiceCharacter] = useState('natural');
  const { state } = controls;

  const magicChips = useMemo(() => getMagicChips(mode, state, controls), [mode, state, controls]);

  const currentChain = useMemo(() => {
    const base = MODE_CHAINS[mode];
    return base.filter((e) => state.pronunciation.fallbackEngines.includes(e));
  }, [mode, state.pronunciation.fallbackEngines]);

  const toggleSection = (id: string) => {
    setOpenSections((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  return (
    <Card className={styles.maGFrame}>
      <div className={styles.maGHeader}>
        <Heading level={4} size={4}>
          Audio
        </Heading>
        <Text as="p" color="secondary">
          Choose how words and sentences sound. Advanced controls are below.
        </Text>
      </div>

      <VStack gap="4" className={styles.maGBody}>
        <SettingsRow dense>
          <span className={styles.maGLabel}>Enable audio</span>
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

        <div className={styles.maGChainHint}>
          <Text as="span" color="secondary" className={styles.maGChainLabel}>
            Priority:
          </Text>
          <Text as="span" color="secondary">
            {currentChain.map((e) => ENGINE_LABELS[e]).join(' → ')}
          </Text>
        </div>

        <AudioTester controls={controls} compact />

        <div className={styles.maGRow}>
          <SettingsRow dense className={styles.maGRowItem}>
            <span className={styles.maGLabel}>Voice character</span>
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
          <SettingsRow dense className={styles.maGRowItem}>
            <span className={styles.maGLabel}>Autoplay</span>
            <Select
              value={String(state.tts.autoplayCount)}
              options={AUTOPLAY_OPTIONS}
              onChange={(v) => controls.setAutoplayCount(Number(v))}
            />
          </SettingsRow>
        </div>

        <div className={styles.maGLocal}>
          <Text as="h5" className={styles.maGLocalTitle}>
            Local content
          </Text>
          <LocalStatus state={state} />
        </div>

        {magicChips.length > 0 && (
          <div className={styles.maGChips}>
            {magicChips.map((chip) => (
              <Button
                key={chip.id}
                variant="outline"
                size="sm"
                onClick={chip.action}
              >
                {chip.label}
              </Button>
            ))}
          </div>
        )}

        <div className={styles.maGAdvanced}>
          <button
            type="button"
            className={styles.maGAdvancedTrigger}
            onClick={() => toggleSection('advanced')}
          >
            <span className={styles.maGAdvancedLabel}>Advanced</span>
            <Icon
              name="chevronDown"
              size="sm"
              style={{ transform: openSections.includes('advanced') ? 'rotate(180deg)' : undefined }}
            />
          </button>
          {openSections.includes('advanced') && (
            <div className={styles.maGAdvancedContent}>
              <AdvancedSection
                id="priority"
                title="Source priority"
                open={openSections}
                toggle={toggleSection}
              >
                <PriorityChain controls={controls} />
              </AdvancedSection>
              <AdvancedSection
                id="local"
                title="Local package"
                open={openSections}
                toggle={toggleSection}
              >
                <LocalPackagePanel controls={controls} />
              </AdvancedSection>
              <AdvancedSection id="tts" title="TTS voices" open={openSections} toggle={toggleSection}>
                <TtsSettingsPanel controls={controls} />
                <TtsTesterPanel controls={controls} />
              </AdvancedSection>
              <AdvancedSection
                id="packs"
                title="Local speech packs"
                open={openSections}
                toggle={toggleSection}
              >
                <TtsLocalPacksPanel controls={controls} />
              </AdvancedSection>
            </div>
          )}
        </div>
      </VStack>
    </Card>
  );
}
