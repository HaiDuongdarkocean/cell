// SourceDetailPanel — per-engine detail pane for the Audio settings card
// (spec fnc_audio-settings-pipeline, Concept H "Audio Pipeline").
//
// Renders the configuration UI for the audio source currently selected in the
// pipeline. Reuses the existing standalone panels instead of duplicating logic:
//   localFile   → LocalPronunciationSettingsPanel (Forvo/Lingvo package setup)
//   native      → info text only (community audio needs no configuration)
//   supertonic  → TtsLanguagePanel (local voice-pack downloads)
//   browserTts  → TtsVoiceManagerPanel (voice selection + tester)
//   espeak      → downloadEspeakTtsData toggle
//
// This panel renders plain content (no Card) because it lives inside the
// Audio card. TtsVoiceManagerPanel ships its own Cards, so the browserTts
// branch wraps it in `.flatten` which strips the nested card chrome via CSS.

import type { ReactElement, ReactNode } from 'react';
import { Icon, SettingsRow, Text, Toggle } from '@/shared/ui';
import type { ICON_CATALOG } from '@/shared/icons';
import type { AudioEngineKind, PronunciationSettings, TtsSettings } from '@/entities/settings/types';
import { LocalPronunciationSettingsPanel } from '@/features/settings/ui/LocalPronunciationSettingsPanel';
import { TtsLanguagePanel } from '@/features/tts/ui/TtsLanguagePanel';
import { TtsVoiceManagerPanel } from '@/features/tts/ui/TtsVoiceManagerPanel';
import styles from './SourceDetailPanel.module.css';

export interface SourceDetailPanelProps {
  readonly engine: AudioEngineKind;
  readonly pronunciation: PronunciationSettings;
  readonly tts: TtsSettings;
  readonly onPronunciationChange: (next: PronunciationSettings) => void;
  readonly onTtsChange: (next: TtsSettings) => void;
}

const ENGINE_LABELS: Record<AudioEngineKind, string> = {
  localFile: 'Local Forvo package',
  native: 'Community audio (Wikimedia)',
  supertonic: 'Supertonic local TTS',
  browserTts: 'Browser / Google TTS',
  espeak: 'eSpeak on-device TTS',
};

const ENGINE_ICONS = {
  localFile: 'folderOpen',
  native: 'audioWave',
  supertonic: 'download',
  browserTts: 'play',
  espeak: 'settings',
} as const satisfies Record<AudioEngineKind, keyof typeof ICON_CATALOG>;

export function SourceDetailPanel({
  engine,
  pronunciation,
  tts,
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
          Community audio from Wikimedia. No configuration needed — it is used
          automatically when present in the pipeline.
        </Text>
      );
      break;
    case 'supertonic':
      detail = <TtsLanguagePanel settings={tts} onSave={onTtsChange} />;
      break;
    case 'browserTts':
      detail = (
        <div className={styles.flatten}>
          <TtsVoiceManagerPanel
            settings={tts}
            onSave={onTtsChange}
            showLocalTtsCard={false}
          />
        </div>
      );
      break;
    case 'espeak':
      detail = (
        <SettingsRow dense>
          <span className={styles.rowLabel}>Download eSpeak TTS data</span>
          <Toggle
            checked={pronunciation.downloadEspeakTtsData}
            onChange={(next) =>
              onPronunciationChange({ ...pronunciation, downloadEspeakTtsData: next })
            }
            ariaLabel="Download eSpeak TTS data on demand"
            dataTestId="espeak-data-toggle"
          />
        </SettingsRow>
      );
      break;
    default:
      detail = null;
  }

  return (
    <div className={styles.panel} data-engine={engine} data-cell-id="source-detail-panel">
      <div className={styles.header}>
        <Icon name={ENGINE_ICONS[engine]} size="sm" color="secondary" />
        <Text as="h5" className={styles.title}>
          {ENGINE_LABELS[engine]}
        </Text>
      </div>
      {detail}
    </div>
  );
}
