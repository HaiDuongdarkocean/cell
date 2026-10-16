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
import { t, type MessageKey } from '@/shared/i18n';
import { Button, HintIcon, Icon, Input, SegmentedControl, Select, SettingsGroup, SettingsPanel, SettingsRow } from '@/shared/ui';
import type {
  AudioEngineKind,
  PronunciationSettings,
  TtsSettings,
} from '@/entities/settings/types';
import { PronunciationAudioOrchestrator, audioItemUrl, PhonemePacksPanel } from '@/features/pronunciation';
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
const AUTOPLAY_OPTION_KEYS = [
  { value: '0', label: 'audio.autoplay.option.off' },
  { value: '1', label: 'audio.autoplay.option.one' },
  { value: '2', label: 'audio.autoplay.option.two' },
  { value: '3', label: 'audio.autoplay.option.three' },
] as const satisfies readonly { value: string; label: MessageKey }[];

const AUTO_MODE = OUTPUT_MODES.find((m) => m.value === 'auto')!;
const ADVANCED_MODES = OUTPUT_MODES.filter((m) => m.value !== 'auto');

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
  const [modesOpen, setModesOpen] = useState(false);
  const [testText, setTestText] = useState('');
  const [testStatus, setTestStatus] = useState<string | null>(null);
  const [testing, setTesting] = useState(false);

  // The selected engine defaults to the first step of the current chain; a
  // stale selection (e.g. after a mode switch removed it) falls back likewise.
  const selectedEngine: AudioEngineKind | null =
    selected && engines.includes(selected) ? selected : (engines[0] ?? null);

  const activeMode = detectMode(engines);
  const advancedActive = activeMode !== null && activeMode !== 'auto';
  const advancedVisible = modesOpen || advancedActive;

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
      const url = item ? audioItemUrl(item) : undefined;
      if (!item) {
        setTestStatus(t('audio.tester.none'));
        return;
      }
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
    <SettingsPanel data-tihoka-id="audio-panel">
      {/* Sources: pick a mode → see the order → configure a source → hear it. */}
      <SettingsGroup>
        <SettingsRow dense stacked>
          <div className={styles.modeHead}>
            <span className={styles.modeTitle}>
              {t('audio.outputMode')}
              <HintIcon
                hint={t('audio.outputMode.hint')}
                ariaLabel={t('audio.outputMode.aria')}
                dataTestId="audio-mode-hint"
              />
            </span>
            <button
              type="button"
              className={styles.advancedToggle}
              onClick={() => setModesOpen((o) => !o)}
              aria-expanded={advancedVisible}
              data-open={advancedVisible}
              data-tihoka-id="audio-advanced-toggle"
            >
              <span className={styles.advancedLabel}>{t('audio.modes.advanced')}</span>
              <Icon name="chevronDown" size={16} />
            </button>
          </div>
          <div className={styles.modeRow}>
            <SegmentedControl
              variant="chips"
              size="md"
              ariaLabel={t('audio.outputMode.aria')}
              options={[
                {
                  value: AUTO_MODE.value,
                  label: t(AUTO_MODE.label),
                  title: t(AUTO_MODE.desc),
                  testId: `audio-mode-${AUTO_MODE.value}`,
                },
              ]}
              value={activeMode === 'auto' ? 'auto' : null}
              onChange={handleModeChange}
            />
            {advancedVisible && (
              <SegmentedControl
                variant="chips"
                size="md"
                ariaLabel={t('audio.modes.advanced.aria')}
                options={ADVANCED_MODES.map((mode) => ({
                  value: mode.value,
                  label: t(mode.label),
                  title: t(mode.desc),
                  testId: `audio-mode-${mode.value}`,
                }))}
                value={advancedActive ? activeMode : null}
                onChange={handleModeChange}
              />
            )}
          </div>
        </SettingsRow>

        <AudioPipeline
          engines={[...engines]}
          selected={selectedEngine}
          statuses={statuses}
          onSelect={setSelected}
        />

        {selectedEngine && (
          <SourceDetailPanel
            engine={selectedEngine}
            status={statuses[selectedEngine]}
            pronunciation={pronunciation}
            tts={tts}
            targetLang={targetLang}
            onPronunciationChange={onPronunciationChange}
            onTtsChange={onTtsChange}
          />
        )}

        {/* Try it closes the pick→hear loop; it sits right after the source
            detail so the user does not scroll past it to test a change. */}
        <SettingsRow dense stacked title={t('audio.tester.label')} labelFor="audio-tester-input">
          <Input
            id="audio-tester-input"
            value={testText}
            onChange={(e) => setTestText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void handlePlay();
            }}
            placeholder={t('audio.tester.placeholder')}
            aria-label={t('audio.tester.inputAria')}
            data-tihoka-id="audio-tester-input"
            size="md"
            className={styles.testerInput}
            suffix={
              <Button
                variant="primary"
                shape="circle"
                size="xs"
                className={styles.testerPlay}
                onClick={() => void handlePlay()}
                loading={testing}
                aria-label={t('audio.tester.playAria')}
                data-tihoka-id="audio-tester-play"
              >
                <Icon name="play" size="sm" />
              </Button>
            }
          />
          {testStatus && (
            <p className={styles.status} role="status" data-tihoka-id="audio-tester-status">
              {testStatus}
            </p>
          )}
        </SettingsRow>
      </SettingsGroup>

      {/* Phoneme chips: bundled recordings + user-imported plugin packs. */}
      <PhonemePacksPanel />

      {/* Playback: behaviour applied after the sources are decided. */}
      <SettingsGroup label={<span className={styles.groupLabel}>{t('audio.group.playback')}</span>}>
        <SettingsRow dense stacked title={t('audio.autoplay.label')} labelFor="audio-autoplay">
          <Select
            id="audio-autoplay"
            value={String(tts.autoplayCount)}
            options={AUTOPLAY_OPTION_KEYS.map((o) => ({ value: o.value, label: t(o.label) }))}
            onChange={(v) => onTtsChange({ ...tts, autoplayCount: Number(v) })}
            data-tihoka-id="audio-autoplay"
            aria-label={t('audio.autoplay.aria')}
          />
        </SettingsRow>
      </SettingsGroup>
    </SettingsPanel>
  );
}
