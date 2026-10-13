import { type ReactElement } from 'react';
import { t, type MessageKey } from '@/shared/i18n';
import type { AudioEngineKind } from '@/entities/settings/types';
import { Button } from '@/shared/ui/Button';
import styles from './AudioPipeline.module.css';

export interface AudioPipelineProps {
  readonly engines: AudioEngineKind[];
  readonly selected: AudioEngineKind | null;
  readonly statuses: Record<AudioEngineKind, 'ready' | 'missing' | 'disabled'>;
  readonly onSelect: (engine: AudioEngineKind) => void;
}

/** User-facing labels for each audio engine. */
const ENGINE_LABEL_KEYS: Record<AudioEngineKind, MessageKey> = {
  localFile: 'audio.engine.localFile',
  native: 'audio.engine.native',
  supertonic: 'audio.engine.supertonic',
  browserTts: 'audio.engine.browserTts',
  espeak: 'audio.engine.espeak',
};

export const STATUS_LABEL_KEYS: Record<'ready' | 'missing' | 'disabled', MessageKey> = {
  ready: 'audio.engine.status.ready',
  missing: 'audio.engine.status.missing',
  disabled: 'audio.engine.status.disabled',
};

/**
 * Renders the audio source order as a numbered rail: circles 1..n joined by a
 * line, labels alternating above/below so they never collide. The whole column
 * (label + node) is the click target; the node fill carries the status color.
 */
export function AudioPipeline({
  engines,
  selected,
  statuses,
  onSelect,
}: AudioPipelineProps): ReactElement {
  return (
    <div className={styles.pipeline} role="list" aria-label={t('audio.pipeline.aria')}>
      {engines.map((engine, index) => {
        const status = statuses[engine] ?? 'disabled';
        const isSelected = selected === engine;
        const label = t(ENGINE_LABEL_KEYS[engine]);
        const above = index % 2 === 1;
        const labelEl = (
          <span className={`${styles.label} ${isSelected ? styles.labelSelected : ''}`}>
            {label}
          </span>
        );

        return (
          <div key={engine} className={styles.stepWrapper} role="listitem">
            <Button
              variant="unstyled"
              className={`${styles.step} ${isSelected ? styles.selected : ''}`}
              onClick={() => onSelect(engine)}
              aria-pressed={isSelected}
              aria-label={`${index + 1}. ${label} (${t(STATUS_LABEL_KEYS[status])})`}
            >
              <span className={styles.slot}>{above ? labelEl : null}</span>
              <span className={styles.railRow} aria-hidden="true">
                <span
                  className={styles.lead}
                  style={{ visibility: index === 0 ? 'hidden' : undefined }}
                />
                <span className={`${styles.node} ${styles[status]}`}>{index + 1}</span>
                <span
                  className={styles.lead}
                  style={{ visibility: index === engines.length - 1 ? 'hidden' : undefined }}
                />
              </span>
              <span className={styles.slot}>{above ? null : labelEl}</span>
            </Button>
          </div>
        );
      })}
    </div>
  );
}
