import type { SubtitleRecord } from '@/features/local-player/services/mediaLibraryRepository';
import { Button } from '@/shared/ui/Button';
import { Icon } from '@/shared/icons/Icon';
import styles from './LibraryCard.module.css';

interface SubtitleCardProps {
  subtitle: SubtitleRecord;
  onClick: () => void;
}

/** SubtitleCard — single subtitle entry in the Subtitles tab. */
export function SubtitleCard({ subtitle, onClick }: SubtitleCardProps): React.JSX.Element {
  return (
    <Button material="solid" variant="secondary"
      className={styles.card}
      data-cell-id="subtitle-card"
      onClick={onClick}
    >
      <span className={styles.title} data-cell-id="subtitle-card-title">
        {subtitle.filename}
      </span>
      <span className={styles.meta}>
        <span className={styles.metaItem} data-cell-id="subtitle-card-lang">
          <Icon name="captions" size={12} className={styles.metaIcon} />
          {subtitle.languageCode ?? '—'}
        </span>
      </span>
    </Button>
  );
}
