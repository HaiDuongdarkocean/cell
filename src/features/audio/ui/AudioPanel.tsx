// AudioPanel — the unified "Audio" settings card body
// (spec fnc_audio-settings-pipeline, Concept H "Audio Pipeline").
//
// Merges the old Pronunciation / Local Pronunciation / TTS Voices cards into a
// single pipeline-centric panel:
//   1. Enable audio toggle (tts.enabled)
//   2. Output mode segmented control — a UI-only preset that overwrites
//      pronunciation.fallbackEngines with the mode's engine chain
//   3. Compact audio tester (text input + Play + status)
//   4. Voice settings row (voice character + autoplay count)
//   5. AudioPipeline — horizontal engine chain with status dots
//   6. SourceDetailPanel — per-engine config for the selected pipeline step
//
// This component renders plain content — no nested Card — because it lives
// inside the Audio card rendered by SettingsDialogContent.

import { useMemo, useState, type ReactElement } from 'react';
import { Button, Icon, Input, Select, SettingsRow, Text, Toggle } from '@/shared/ui';
import type {
  AudioEngineKind,
  PronunciationSettings,
  TtsSettings,
} from '@/entities/settings/types';
import { PronunciationAudioOrchestrator } from '@/features/pronunciation/services/pronunciationAudioOrchestrator';
import {
  OUTPUT_MODES,
  getEngineStatus,
  getOutputModeChain,
  type EngineStatus,
  type OutputMode,
} from '../lib/outputMode';
import { AudioPipeline } from './AudioPipeline';
import { SourceDetailPanel } from './SourceDetailPanel';
import styles from './AudioPanel.module.css';

export interface AudioPanelProps {
  readonly pronunciation: PronunciationSettings;
  readonly tts: TtsSettings;
  readonly onPronunciationChange: (next: PronunciationSettings) => void;
  readonly onTtsChange: (next: TtsSettings) => void;
}

/** Every known engine — statuses are computed for all, not just the active chain. */
const ALL_ENGINES: readonly AudioEngineKind[] = [
  'localFile',
  'native',
  'supertonic',
  'browserTts',
  'espeak',
];

/** Autoplay count options (matches DEFAULT_TTS_SETTINGS range 0–3). */
const AUTOPLAY_OPTIONS = [
  { value: '0', label: '0' },
  { value: '1', label: '1' },
  { value: '2', label: '2' },
  { value: '3', label: '3' },
];

/** Voice character is a UI-only concept for now (no persisted field). */
/** Language used by the compact tester. */
const TEST_LANG_CODE = 'en';

/** Returns the output mode whose chain exactly matches the fallback order. */
function detectMode(engines: readonly AudioEngineKind[]): OutputMode | null {
  for (const mode of OUTPUT_MODES) {
    const chain = getOutputModeChain(mode.value);
    if (chain.length === engines.length && chain.every((e, i) => e === engines[i])) {
      return mode.value;
    }
  }
  return null;
}

export function AudioPanel({
  pronunciation,
  tts,
  onPronunciationChange,
  onTtsChange,
}: AudioPanelProps): ReactElement {
  const engines = pronunciation.fallbackEngines;
  const [selected, setSelected] = useState<AudioEngineKind | null>(null);
  const [testText, setTestText] = useState('');
  const [testStatus, setTestStatus] = useState<string | null>(null);
  const [testing, setTesting] = useState(false);

  // The selected engine defaults to the first step of the current chain; a
  // stale selection (e.g. after a mode switch removed it) falls back likewise.
  const selectedEngine: AudioEngineKind | null =
    selected && engines.includes(selected) ? selected : (engines[0] ?? null);

  const activeMode = detectMode(engines);

  const statuses = useMemo(() => {
    const map = {} as Record<AudioEngineKind, EngineStatus>;
    for (const engine of ALL_ENGINES) {
      map[engine] = getEngineStatus(engine, pronunciation, tts);
    }
    return map;
  }, [pronunciation, tts]);

  const handleModeChange = (mode: OutputMode): void => {
    const chain = getOutputModeChain(mode);
    onPronunciationChange({ ...pronunciation, fallbackEngines: chain });
    setSelected(chain[0] ?? null);
  };

  const handlePlay = async (): Promise<void> => {
    const term = testText.trim();
    if (!term) {
      setTestStatus('Enter a word or phrase to test.');
      return;
    }
    setTesting(true);
    setTestStatus('Resolving audio…');
    try {
      const orchestrator = new PronunciationAudioOrchestrator(pronunciation);
      const items = await orchestrator.resolve(term, TEST_LANG_CODE);
      const item = items.find((i) => i.url || i.audioBytes);
      if (!item) {
        setTestStatus('No audio found in the current pipeline.');
        return;
      }
      const url =
        item.url ??
        (item.audioBytes
          ? URL.createObjectURL(new Blob([new Uint8Array(item.audioBytes)]))
          : undefined);
      if (!url) {
        setTestStatus('No playable audio.');
        return;
      }
      const audio = new Audio(url);
      audio.addEventListener('ended', () => {
        if (!item.url) URL.revokeObjectURL(url);
      });
      await audio.play();
      setTestStatus(`Playing: ${item.label}`);
    } catch (e) {
      setTestStatus(`Audio test failed: ${String(e)}`);
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className={styles.panel} data-cell-id="audio-panel">
      {/* 1. Master toggle */}
      <SettingsRow dense>
        <span className={styles.rowLabel}>Enable audio</span>
        <Toggle
          checked={tts.enabled}
          onChange={(next) => onTtsChange({ ...tts, enabled: next })}
          ariaLabel="Enable audio"
          dataTestId="audio-enable-toggle"
        />
      </SettingsRow>

      {/* 2. Output mode segmented control */}
      <div className={styles.section}>
        <span className={styles.rowLabel}>Output mode</span>
        <div className={styles.segmented} role="group" aria-label="Output mode">
          {OUTPUT_MODES.map((mode) => (
            <Button
              key={mode.value}
              variant="transparent"
              className={`${styles.mode} ${activeMode === mode.value ? styles.modeActive : ''}`}
              onClick={() => handleModeChange(mode.value)}
              aria-pressed={activeMode === mode.value}
              title={mode.desc}
              data-cell-id={`audio-mode-${mode.value}`}
            >
              {mode.label}
            </Button>
          ))}
        </div>
        <Text as="p" color="secondary" className={styles.hint}>
          Switching mode replaces the source priority order below.
        </Text>
      </div>

      {/* 3. Compact audio tester */}
      <div className={styles.tester}>
        <Input
          value={testText}
          onChange={(e) => setTestText(e.target.value)}
          placeholder="Type a word to test"
          aria-label="Test text"
          data-cell-id="audio-tester-input"
          size="sm"
        />
        <Button
          variant="primary"
          size="sm"
          onClick={() => void handlePlay()}
          loading={testing}
          leadingIcon={<Icon name="play" size="sm" />}
          data-cell-id="audio-tester-play"
        >
          Play
        </Button>
      </div>
      {testStatus && (
        <p className={styles.status} role="status" data-cell-id="audio-tester-status">
          {testStatus}
        </p>
      )}

      {/* 4. Autoplay */}
      <SettingsRow dense>
        <span className={styles.rowLabel}>Autoplay</span>
        <Select
          value={String(tts.autoplayCount)}
          options={AUTOPLAY_OPTIONS}
          onChange={(v) => onTtsChange({ ...tts, autoplayCount: Number(v) })}
          data-cell-id="audio-autoplay"
          aria-label="Autoplay count"
        />
      </SettingsRow>

      {/* 5. Pipeline */}
      <div className={styles.section}>
        <Text as="h5" className={styles.sectionTitle}>
          Audio pipeline
        </Text>
        <AudioPipeline
          engines={[...engines]}
          selected={selectedEngine}
          statuses={statuses}
          onSelect={setSelected}
        />
      </div>

      {/* 6. Per-engine detail pane */}
      {selectedEngine && (
        <SourceDetailPanel
          engine={selectedEngine}
          pronunciation={pronunciation}
          tts={tts}
          onPronunciationChange={onPronunciationChange}
          onTtsChange={onTtsChange}
        />
      )}
    </div>
  );
}
