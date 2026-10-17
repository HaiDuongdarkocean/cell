// SourceDetailPanel — per-engine detail pane for the Audio settings card
// (spec fnc_audio-settings-pipeline, Concept H "Audio Pipeline").
//
// Renders the configuration UI for the audio source currently selected in the
// pipeline. Reuses the existing standalone panels instead of duplicating logic:
//   localFile   → LocalPronunciationSettingsPanel (Forvo/Lingvo package setup)
//   native      → info text only (community audio needs no configuration)
//   supertonic  → TtsLanguagePanel (local voice-pack downloads)
//   browserTts  → BrowserVoicePanel (voice list picker for the 3 speak buttons)
//   espeak      → downloadEspeakTtsData toggle
//
// This panel renders plain content (no Card) because it lives inside the
// Audio card.

import { useState, type ReactElement, type ReactNode } from 'react';
import { t, type MessageKey } from '@/shared/i18n';
import { claimExclusiveAudio } from '@/shared/lib/exclusiveAudio';
import { Button, Chip, Icon, Input, SettingsRow, Text, Toggle } from '@/shared/ui';
import type { ChipColor } from '@/shared/ui/Chip';
import type { AudioEngineKind, PronunciationSettings, TtsSettings } from '@/entities/settings/types';
import {
  LocalPronunciationSettingsPanel,
  createEngineProvider,
  audioItemUrl,
} from '@/features/pronunciation';
import { TtsLanguagePanel } from '@/features/tts';
import type { EngineStatus } from '../lib/outputMode';
import { BrowserVoicePanel } from './BrowserVoicePanel';
import { STATUS_LABEL_KEYS } from './AudioPipeline';
import styles from './SourceDetailPanel.module.css';

export interface SourceDetailPanelProps {
  readonly engine: AudioEngineKind;
  readonly status: EngineStatus;
  readonly pronunciation: PronunciationSettings;
  readonly tts: TtsSettings;
  readonly targetLang: string;
  readonly onPronunciationChange: (next: PronunciationSettings) => void;
  readonly onTtsChange: (next: TtsSettings) => void;
}

const ENGINE_LABEL_KEYS: Record<AudioEngineKind, MessageKey> = {
  localFile: 'audio.engine.localFile',
  native: 'audio.engine.native',
  supertonic: 'audio.engine.supertonic',
  browserTts: 'audio.engine.browserTts',
  espeak: 'audio.engine.espeak',
};

const STATUS_CHIP_COLORS = {
  ready: 'success',
  missing: 'warning',
  disabled: 'muted',
} as const satisfies Record<EngineStatus, ChipColor>;

export function SourceDetailPanel({
  engine,
  status,
  pronunciation,
  tts,
  targetLang,
  onPronunciationChange,
  onTtsChange,
}: SourceDetailPanelProps): ReactElement {
  let detail: ReactNode;
  switch (engine) {
    case 'localFile':
      detail = (
        <LocalPronunciationSettingsPanel
          settings={pronunciation}
          onChange={onPronunciationChange}
        />
      );
      break;
    case 'native':
      detail = (
        <Text as="p" color="secondary" className={styles.info}>
          {t('audio.engine.native.info')}
        </Text>
      );
      break;
    case 'supertonic':
      detail = <TtsLanguagePanel settings={tts} onSave={onTtsChange} />;
      break;
    case 'browserTts':
      detail = (
        <BrowserVoicePanel
          settings={tts}
          onChange={onTtsChange}
          targetLang={targetLang}
        />
      );
      break;
    case 'espeak':
      detail = (
        <SettingsRow
          dense
          title={t('audio.engine.espeak.label')}
          description={t('audio.engine.espeak.desc')}
        >
          <Toggle
            checked={pronunciation.downloadEspeakTtsData}
            onChange={(next) =>
              onPronunciationChange({ ...pronunciation, downloadEspeakTtsData: next })
            }
            ariaLabel={t('audio.engine.espeak.aria')}
            dataTestId="espeak-data-toggle"
          />
        </SettingsRow>
      );
      break;
    default:
      detail = null;
  }

  return (
    <div className={styles.panel} data-engine={engine} data-tihoka-id="source-detail-panel">
      <div className={styles.header}>
        <Text as="h4" className={styles.title}>
          {t(ENGINE_LABEL_KEYS[engine])}
        </Text>
        <Chip size="sm" variant="outline" color={STATUS_CHIP_COLORS[status]}>
          {t(STATUS_LABEL_KEYS[status])}
        </Chip>
      </div>
      {detail}
      <SourceTester
        key={engine}
        engine={engine}
        pronunciation={pronunciation}
        targetLang={targetLang}
      />
    </div>
  );
}

interface SourceTesterProps {
  readonly engine: AudioEngineKind;
  readonly pronunciation: PronunciationSettings;
  readonly targetLang: string;
}

function SourceTester({ engine, pronunciation, targetLang }: SourceTesterProps): ReactElement {
  const [testText, setTestText] = useState('');
  const [testing, setTesting] = useState(false);
  const [testStatus, setTestStatus] = useState<string | null>(null);

  const handleTest = async (): Promise<void> => {
    const term = testText.trim();
    if (!term) {
      setTestStatus(t('audio.tester.empty'));
      return;
    }
    setTesting(true);
    setTestStatus(t('audio.tester.resolving'));
    try {
      const items = await createEngineProvider(engine, pronunciation).resolve(term, targetLang);
      const item = items.find((i) => i.url || i.audioBytes);
      const url = item ? audioItemUrl(item) : undefined;
      if (!item || !url) {
        setTestStatus(t(item ? 'audio.tester.unplayable' : 'audio.tester.none'));
        return;
      }
      const audio = new Audio(url);
      const release = claimExclusiveAudio(() => audio.pause());
      audio.addEventListener('ended', () => {
        release();
        if (!item.url) URL.revokeObjectURL(url);
      });
      await audio.play().catch((e) => { release(); throw e; });
      setTestStatus(t('audio.tester.playing', [item.label]));
    } catch (e) {
      setTestStatus(t('audio.tester.failed', [String(e)]));
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className={styles.tester}>
      <Text variant="supporting" color="secondary">
        {t('audio.tester.scope')}
      </Text>
      <Input
        value={testText}
        onChange={(e) => setTestText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') void handleTest();
        }}
        placeholder={t('audio.tester.placeholder')}
        aria-label={t('audio.tester.inputAria')}
        data-tihoka-id="audio-source-tester-input"
        size="md"
        className={styles.testerInput}
        suffix={
          <Button
            variant="primary"
            shape="circle"
            size="xs"
            className={styles.testerPlay}
            onClick={() => void handleTest()}
            loading={testing}
            aria-label={t('audio.tester.playAria')}
            data-tihoka-id="audio-source-tester-play"
          >
            <Icon name="play" size="sm" />
          </Button>
        }
      />
      {testStatus && (
        <p className={styles.status} role="status" data-tihoka-id="audio-source-tester-status">
          {testStatus}
        </p>
      )}
    </div>
  );
}
