import { Button } from '@/shared/ui/Button';
import { SettingsRow } from '@/shared/ui/SettingsRow';
import { Toggle } from '@/shared/ui/Toggle';
import { VStack } from '@/shared/ui/Stack';
import type { AudioEngineKind, PronunciationSettings } from '@/entities/settings/types';
import styles from './SettingsDialog.module.css';

interface PronunciationSettingsPanelProps {
  settings: PronunciationSettings;
  onChange: (settings: PronunciationSettings) => void;
}

const ENGINE_LABELS: Record<AudioEngineKind, string> = {
  localFile: 'Local Forvo package',
  native: 'Community audio (Wikimedia)',
  supertonic: 'Supertonic cloud TTS',
  browserTts: 'Browser / Google TTS',
  espeak: 'eSpeak on-device TTS',
};

function moveItem<T>(arr: readonly T[], from: number, to: number): T[] {
  const copy = [...arr];
  const [removed] = copy.splice(from, 1);
  copy.splice(to, 0, removed);
  return copy;
}

export function PronunciationSettingsPanel({
  settings,
  onChange,
}: PronunciationSettingsPanelProps): React.JSX.Element {
  const { fallbackEngines, downloadEspeakTtsData } = settings;

  const updateEngines = (next: AudioEngineKind[]): void => {
    onChange({ ...settings, fallbackEngines: next });
  };

  return (
    <VStack gap="0">
      <SettingsRow dense stacked>
        <span className={styles.rowLabel}>Audio source priority</span>
        <span className={styles.cardDesc}>
          Engines are tried in order. Drag is not supported; use the up/down buttons to reorder.
        </span>
      </SettingsRow>

      <ol className={styles.engineList}>
        {fallbackEngines.map((engine, index) => (
          <li key={engine} className={styles.engineItem} data-engine={engine}>
            <span className={styles.engineLabel}>{ENGINE_LABELS[engine]}</span>
            <div className={styles.engineActions}>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => updateEngines(moveItem(fallbackEngines, index, index - 1))}
                disabled={index === 0}
                aria-label={`Move ${ENGINE_LABELS[engine]} up`}
              >
                Up
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => updateEngines(moveItem(fallbackEngines, index, index + 1))}
                disabled={index === fallbackEngines.length - 1}
                aria-label={`Move ${ENGINE_LABELS[engine]} down`}
              >
                Down
              </Button>
            </div>
          </li>
        ))}
      </ol>

      <SettingsRow dense>
        <span className={styles.rowLabel}>Download eSpeak TTS data</span>
        <Toggle
          checked={downloadEspeakTtsData}
          onChange={(next) => onChange({ ...settings, downloadEspeakTtsData: next })}
          ariaLabel="Download eSpeak TTS data on demand"
        />
      </SettingsRow>
    </VStack>
  );
}
