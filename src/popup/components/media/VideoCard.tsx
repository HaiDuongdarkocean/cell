import type { DetectedVideo, VideoQuality } from '@/types/media';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import styles from './VideoCard.module.css';

interface VideoCardProps {
  video: DetectedVideo;
  onDownload: (videoId: string) => void;
  onSelectQuality: (videoId: string, quality: VideoQuality) => void;
}

export function VideoCard({
  video,
  onDownload,
  onSelectQuality,
}: VideoCardProps): React.JSX.Element {
  const hasMultipleVariants = video.variants.length > 1;
  const selectedVariant = video.variants[0];

  const handleQualityChange = (event: React.ChangeEvent<HTMLSelectElement>): void => {
    onSelectQuality(video.id, event.target.value as VideoQuality);
  };

  const handleDownloadClick = (): void => {
    onDownload(video.id);
  };

  const formatFileSize = (bytes?: number): string => {
    if (!bytes) return 'Unknown size';
    const units = ['B', 'KB', 'MB', 'GB'];
    let size = bytes;
    let unitIndex = 0;
    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }
    return `${size.toFixed(1)} ${units[unitIndex]}`;
  };

  return (
    <article className={styles.card} data-testid="video-card">
      <div className={styles.cardHeader}>
        <div className={styles.cardTitle}>
          <svg
            className={styles.videoIcon}
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
            <polygon points="5 3 19 12 5 21 5 3" />
          </svg>
          <h3 className={styles.title} data-testid="video-title">
            {video.title}
          </h3>
        </div>
        {selectedVariant && (
          <Badge variant="info" size="sm">
            {selectedVariant.quality}
          </Badge>
        )}
      </div>

      <div className={styles.cardBody}>
        <div className={styles.metadata}>
          <span className={styles.metadataItem}>
            {video.variants.length} variant{video.variants.length !== 1 ? 's' : ''}
          </span>
          {selectedVariant?.size && (
            <span className={styles.metadataItem}>
              {formatFileSize(selectedVariant.size)}
            </span>
          )}
        </div>

        {hasMultipleVariants && (
          <div className={styles.qualitySelector}>
            <label htmlFor={`quality-${video.id}`} className={styles.qualityLabel}>
              Quality:
            </label>
            <select
              id={`quality-${video.id}`}
              className={styles.qualitySelect}
              data-testid="quality-select"
              defaultValue={selectedVariant?.quality}
              onChange={handleQualityChange}
              aria-label="Select video quality"
            >
              {video.variants.map((variant) => (
                <option key={variant.url} value={variant.quality}>
                  {variant.quality} {variant.size ? `(${formatFileSize(variant.size)})` : ''}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      <div className={styles.cardFooter}>
        <Button
          variant="primary"
          size="sm"
          onClick={handleDownloadClick}
          className={styles.downloadButton}
          data-testid="download-button"
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