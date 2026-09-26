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

import type { ReactElement, ReactNode } from 'react';
import { t, type MessageKey } from '@/shared/i18n';
import { Icon, SettingsRow, Text, Toggle } from '@/shared/ui';
import type { ICON_CATALOG } from '@/shared/icons';
import type { AudioEngineKind, PronunciationSettings, TtsSettings } from '@/entities/settings/types';
import { LocalPronunciationSettingsPanel } from '@/features/pronunciation/ui/LocalPronunciationSettingsPanel';
import { TtsLanguagePanel } from '@/features/tts/ui/TtsLanguagePanel';
import { BrowserVoicePanel } from './BrowserVoicePanel';
import styles from './SourceDetailPanel.module.css';

export interface SourceDetailPanelProps {
  readonly engine: AudioEngineKind;
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
        <SettingsRow dense>
          <span className={styles.rowLabel}>{t('audio.engine.espeak.label')}</span>
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
    <div className={styles.panel} data-engine={engine} data-cell-id="source-detail-panel">
      <div className={styles.header}>
        <Icon name={ENGINE_ICONS[engine]} size="sm" color="secondary" />
        <Text as="h5" className={styles.title}>
          {t(ENGINE_LABEL_KEYS[engine])}
        </Text>
      </div>
      {detail}
    </div>
  );
}
