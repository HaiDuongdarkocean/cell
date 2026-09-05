import { memo } from 'react';
import { Button } from '@/shared/ui/Button';
import type { SubtitleMatch } from '@/features/local-player/logic/subtitleMatch';
import { Icon } from '@/shared/ui/Icon';
import styles from './TrackSelector.module.css';

interface TrackSelectorProps {
  /** Currently selected target subtitle filename. */
  currentTarget: string | null;
  /** Currently selected native subtitle filename (null if none). */
  currentNative: string | null;
  /** All available subtitle matches (target + native + others). */
  options: SubtitleMatch[];
  /** Called when user selects a new subtitle track. */
  onSelectTrack: (match: SubtitleMatch) => void;
}

function TrackSelectorInner({
  currentTarget,
  currentNative,
  options,
  onSelectTrack,
}: TrackSelectorProps): React.JSX.Element {
  return (
    <div
      className={styles.panel}
      data-cell-id="track-selector"
      role="dialog"
      aria-modal="true"
      aria-label="Subtitle tracks"
    >
      <div className={styles.header}>
        <Icon name="captions" size="sm" />
        <span className={styles.title}>Subtitle tracks</span>
      </div>
      <div className={styles.list} role="radiogroup" aria-label="Subtitle tracks">
        {options.map((opt) => {
          const isActive = opt.filename === currentTarget || opt.filename === currentNative;
          return (
            <Button material="solid" variant="secondary"
              key={opt.filename}
              className={`${styles.item} ${isActive ? styles.active : ''}`}
              onClick={() => onSelectTrack(opt)}
              role="radio"
              aria-checked={isActive}
            >
              <Icon name={isActive ? 'check' : 'captions'} size="xs" />
              <span className={styles.filename}>{opt.filename}</span>
              {opt.languageCode && <span className={styles.lang}>{opt.languageCode}</span>}
            </Button>
          );
        })}
      </div>
    </div>
  );
}

export const TrackSelector = memo(TrackSelectorInner);
