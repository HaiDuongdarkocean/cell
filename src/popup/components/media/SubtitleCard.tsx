import type { DetectedSubtitle } from '@/types/media';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import styles from './SubtitleCard.module.css';

interface SubtitleCardProps {
  subtitle: DetectedSubtitle;
  onDownload: (subtitleId: string) => void;
}

export function SubtitleCard({
  subtitle,
  onDownload,
}: SubtitleCardProps): React.JSX.Element {
  const handleDownloadClick = (): void => {
    onDownload(subtitle.id);
  };

  return (
    <article className={styles.card} data-testid="subtitle-item">
      <div className={styles.cardHeader}>
        <div className={styles.cardTitle}>
          <svg
            className={styles.subtitleIcon}
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" />
            <line x1="4" y1="22" x2="4" y2="15" />
          </svg>
          <h3 className={styles.title} data-testid="subtitle-language">
            {subtitle.language}
          </h3>
        </div>
        <Badge variant="default" size="sm">
          {subtitle.format}
        </Badge>
      </div>

      <div className={styles.cardBody}>
        <div className={styles.metadata}>
          <span className={styles.metadataItem}>Subtitle file</span>
          {subtitle.size && (
            <span className={styles.metadataItem}>
              {formatFileSize(subtitle.size)}
            </span>
          )}
        </div>
      </div>

      <div className={styles.cardFooter}>
        <Button
          variant="primary"
          size="sm"
          onClick={handleDownloadClick}
          className={styles.downloadButton}
          data-testid="subtitle-download"
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="7 10 12 15 17 10" />
            <line x1="12" y1="15" x2="12" y2="3" />
          </svg>
          Download
        </Button>
      </div>
    </article>
  );
}

function formatFileSize(bytes?: number): string {
  if (!bytes) return 'Unknown size';
  const units = ['B', 'KB', 'MB', 'GB'];
  let size = bytes;
  let unitIndex = 0;
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }
  return `${size.toFixed(1)} ${units[unitIndex]}`;
}