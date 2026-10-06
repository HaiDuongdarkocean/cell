// AudioPanel — the unified "Audio" settings card body
// (spec fnc_audio-settings-pipeline, Concept H "Audio Pipeline").
//
// Merges the old Pronunciation / Local Pronunciation / TTS Voices cards into a
// single pipeline-centric panel, grouped by proximity:
//   Sources group:
//   1. Output mode segmented control — a UI-only preset that overwrites
//      pronunciation.fallbackEngines with the mode's engine chain (hint
//      popover explains the replace behavior)
//   2. AudioPipeline — horizontal engine chain with status dots
//   3. SourceDetailPanel — per-engine config for the selected pipeline step
//   Playback group:
//   4. Compact audio tester (40px input + round play button inside)
//   5. Autoplay count (stacked label + select)
//
// This component renders plain content — no nested Card — because it lives
// inside the Audio card rendered by SettingsDialogContent.

import { useMemo, useState, type ReactElement } from 'react';
import { t } from '@/shared/i18n';
import { Button, HintIcon, Icon, Input, SegmentedControl, Select, SettingsRow, Text } from '@/shared/ui';
import type {
  AudioEngineKind,
  PronunciationSettings,
  TtsSettings,
} from '@/entities/settings/types';
import { PronunciationAudioOrchestrator } from '@/features/pronunciation';
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
  readonly targetLang: string;
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
  targetLang,
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
      setTestStatus(t('audio.tester.empty'));
      return;
    }
    setTesting(true);
    setTestStatus(t('audio.tester.resolving'));
    try {
      const orchestrator = new PronunciationAudioOrchestrator(pronunciation);
      const items = await orchestrator.resolve(term, TEST_LANG_CODE);
      const item = items.find((i) => i.url || i.audioBytes);
      if (!item) {
        setTestStatus(t('audio.tester.none'));
        return;
      }
      const url =
        item.url ??
        (item.audioBytes
          ? URL.createObjectURL(new Blob([new Uint8Array(item.audioBytes)]))
          : undefined);
      if (!url) {
        setTestStatus(t('audio.tester.unplayable'));
        return;
      }
      const audio = new Audio(url);
      audio.addEventListener('ended', () => {
        if (!item.url) URL.revokeObjectURL(url);
      });
      await audio.play();
      setTestStatus(t('audio.tester.playing', [item.label]));
    } catch (e) {
      setTestStatus(t('audio.tester.failed', [String(e)]));
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className={styles.panel} data-cell-id="audio-panel">
      {/* Sources group: output mode → pipeline → selected source detail. */}
      <div className={styles.group}>
        <div className={styles.section}>
          <span className={styles.rowLabel}>
            {t('audio.outputMode')}
            <HintIcon
              hint={t('audio.outputMode.hint')}
              ariaLabel={t('audio.outputMode.aria')}
              dataTestId="audio-mode-hint"
            />
          </span>
          <SegmentedControl
            variant="filled"
            ariaLabel={t('audio.outputMode.aria')}
            options={OUTPUT_MODES.map((mode) => ({
              value: mode.value,
              label: t(mode.label),
              title: t(mode.desc),
              testId: `audio-mode-${mode.value}`,
            }))}
            value={activeMode}
            onChange={handleModeChange}
          />
        </div>

        <div className={styles.section}>
          <Text as="h5" className={styles.sectionTitle}>
            {t('audio.pipeline.title')}
          </Text>
          <AudioPipeline
            engines={[...engines]}
            selected={selectedEngine}
            statuses={statuses}
            onSelect={setSelected}
          />
        </div>

        {selectedEngine && (
          <SourceDetailPanel
            engine={selectedEngine}
            pronunciation={pronunciation}
            tts={tts}
            targetLang={targetLang}
            onPronunciationChange={onPronunciationChange}
            onTtsChange={onTtsChange}
          />
        )}
      </div>

      {/* Playback group: tester + autoplay. */}
      <div className={styles.group}>
        <div className={styles.section}>
          <label className={styles.rowLabel} htmlFor="audio-tester-input">
            {t('audio.tester.label')}
          </label>
          <Input
            id="audio-tester-input"
            value={testText}
            onChange={(e) => setTestText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void handlePlay();
            }}
            placeholder={t('audio.tester.placeholder')}
            aria-label={t('audio.tester.inputAria')}
            data-cell-id="audio-tester-input"
            size="lg"
            suffix={
              <Button
                variant="primary"
                shape="circle"
                size="xs"
                className={styles.testerPlay}
                onClick={() => void handlePlay()}
                loading={testing}
                aria-label={t('audio.tester.playAria')}
                data-cell-id="audio-tester-play"
              >
                <Icon name="play" size="sm" />
              </Button>
            }
          />
          {testStatus && (
            <p className={styles.status} role="status" data-cell-id="audio-tester-status">
              {testStatus}
            </p>
          )}
        </div>

        <SettingsRow dense stacked>
          <label className={styles.rowLabel} htmlFor="audio-autoplay">
            {t('audio.autoplay.label')}
          </label>
          <Select
            id="audio-autoplay"
            value={String(tts.autoplayCount)}
            options={AUTOPLAY_OPTIONS}
            onChange={(v) => onTtsChange({ ...tts, autoplayCount: Number(v) })}
            data-cell-id="audio-autoplay"
            aria-label={t('audio.autoplay.aria')}
          />
        </SettingsRow>
      </div>
    </div>
  );
}
