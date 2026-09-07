import { type ReactElement } from 'react';
import type { AudioEngineKind } from '@/entities/settings/types';
import { Button } from '@/shared/ui/Button';
import { Icon } from '@/shared/ui/Icon';
import type { ICON_CATALOG } from '@/shared/icons';
import styles from './AudioPipeline.module.css';

export interface AudioPipelineProps {
  readonly engines: AudioEngineKind[];
  readonly selected: AudioEngineKind | null;
  readonly statuses: Record<AudioEngineKind, 'ready' | 'missing' | 'disabled'>;
  readonly onSelect: (engine: AudioEngineKind) => void;
}

/** User-facing labels for each audio engine. */
const ENGINE_LABELS: Record<AudioEngineKind, string> = {
  localFile: 'Forvo audio (offline)',
  native: 'Community audio (Wikimedia)',
  supertonic: 'Cloud speech (Supertonic)',
  browserTts: 'Browser speech',
  espeak: 'Device speech (eSpeak)',
};

/** Icon name from the design system catalog for each engine. */
const ENGINE_ICONS: Record<AudioEngineKind, keyof typeof ICON_CATALOG> = {
  localFile: 'folderOpen',
  native: 'audioWave',
  supertonic: 'download',
  browserTts: 'play',
  espeak: 'settings',
};

/**
 * Renders a horizontal audio source pipeline where each step is a clickable
 * pill showing an icon, label, and status dot.
 */
export function AudioPipeline({
  engines,
  selected,
  statuses,
  onSelect,
}: AudioPipelineProps): ReactElement {
  return (
    <div className={styles.pipeline} role="list" aria-label="Audio pipeline">
      {engines.map((engine, index) => {
        const status = statuses[engine] ?? 'disabled';
        const isSelected = selected === engine;

        return (
          <div key={engine} className={styles.stepWrapper} role="listitem">
            <Button
              variant="transparent"
              ripple={false}
              className={`${styles.step} ${isSelected ? styles.selected : ''}`}
              onClick={() => onSelect(engine)}
              aria-pressed={isSelected}
              aria-label={`${ENGINE_LABELS[engine]} (${status})`}
            >
              <span
                className={`${styles.dot} ${styles[status]}`}
                data-status={status}
                aria-hidden="true"
              />
              <Icon name={ENGINE_ICONS[engine]} size="sm" />
              <span className={styles.label}>{ENGINE_LABELS[engine]}</span>
            </Button>
            {index < engines.length - 1 && (
              <span className={styles.arrow} aria-hidden="true">
                →
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}
