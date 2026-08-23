import { memo } from 'react';
import type { SubtitleMatch } from '@/features/local-player/logic/subtitleMatch';
import { Icon } from '@/shared/icons/Icon';
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
    <div className={styles.panel} data-cell-id="track-selector">
      <div className={styles.header}>
        <Icon name="captions" size={18} />
        <span className={styles.title}>Subtitle tracks</span>
      </div>
      <div className={styles.list}>
        {options.map((opt) => {
          const isActive = opt.filename === currentTarget || opt.filename === currentNative;
          return (
            <button
              key={opt.filename}
              type="button"
              className={`${styles.item} ${isActive ? styles.active : ''}`}
              onClick={() => onSelectTrack(opt)}
              aria-pressed={isActive}
            >
              <Icon name={isActive ? 'check' : 'captions'} size={16} />
              <span className={styles.filename}>{opt.filename}</span>
              {opt.languageCode && <span className={styles.lang}>{opt.languageCode}</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export const TrackSelector = memo(TrackSelectorInner);
