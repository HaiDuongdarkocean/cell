import type { DetectedSubtitle } from '@/types/media';
import styles from './SubtitleItem.module.css';

interface SubtitleItemProps {
  subtitle: DetectedSubtitle;
  onDownload: (subtitleId: string) => void;
}

export function SubtitleItem({ subtitle, onDownload }: SubtitleItemProps): React.JSX.Element {
  return (
    <div className={styles.item} data-testid="subtitle-item">
      <span className={styles.language} data-testid="subtitle-language">
        {subtitle.language}
      </span>
      <span className={styles.format} data-testid="subtitle-format">
        {subtitle.format}
      </span>
      <button
        type="button"
        className={styles.download}
        data-testid="subtitle-download"
        onClick={() => onDownload(subtitle.id)}
      >
        Download
      </button>
    </div>
  );
}
