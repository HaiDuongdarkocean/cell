import { type ReactElement } from 'react';
import { t, type MessageKey } from '@/shared/i18n';
import type { AudioEngineKind } from '@/entities/settings/types';
import { Button } from '@/shared/ui/Button';
import styles from './AudioOrderList.module.css';

export interface AudioOrderListProps {
  readonly engines: AudioEngineKind[];
  readonly selected: AudioEngineKind | null;
  readonly statuses: Record<AudioEngineKind, 'ready' | 'missing' | 'disabled'>;
  readonly onSelect: (engine: AudioEngineKind) => void;
}

const ENGINE_LABEL_KEYS: Record<AudioEngineKind, MessageKey> = {
  localFile: 'audio.engine.localFile',
  native: 'audio.engine.native',
  supertonic: 'audio.engine.supertonic',
  browserTts: 'audio.engine.browserTts',
  espeak: 'audio.engine.espeak',
};

const STATUS_LABEL_KEYS: Record<'ready' | 'missing' | 'disabled', MessageKey> = {
  ready: 'audio.engine.status.ready',
  missing: 'audio.engine.status.missing',
  disabled: 'audio.engine.status.disabled',
};

export function AudioOrderList({
  engines,
  selected,
  statuses,
  onSelect,
}: AudioOrderListProps): ReactElement {
  return (
    <div className={styles.list} role="list" aria-label={t('audio.pipeline.aria')}>
      {engines.map((engine, index) => {
        const status = statuses[engine] ?? 'disabled';
        const isSelected = selected === engine;
        const label = t(ENGINE_LABEL_KEYS[engine]);
        return (
          <div key={engine} role="listitem">
            <Button
              variant="unstyled"
              className={`${styles.row} ${isSelected ? styles.selected : ''}`}
              onClick={() => onSelect(engine)}
              aria-pressed={isSelected}
              aria-label={`${index + 1}. ${label} (${t(STATUS_LABEL_KEYS[status])})`}
              data-cell-id={`audio-order-${engine}`}
            >
              <span className={styles.num} aria-hidden="true">
                {index + 1}
              </span>
              <span className={styles.name}>{label}</span>
              <span className={`${styles.status} ${styles[status]}`}>
                {t(STATUS_LABEL_KEYS[status])}
              </span>
            </Button>
          </div>
        );
      })}
    </div>
  );
}
