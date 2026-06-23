import type { DetectedVideo, VideoQuality } from '@/types/media';
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

  const handleQualityChange = (event: React.ChangeEvent<HTMLSelectElement>): void => {
    onSelectQuality(video.id, event.target.value as VideoQuality);
  };

  const handleDownloadClick = (): void => {
    onDownload(video.id);
  };

  return (
    <div className={styles.card} data-testid="video-card">
      <h3 className={styles.title} data-testid="video-title">
        {video.title}
      </h3>

      {hasMultipleVariants && (
        <select
          className={styles.qualitySelect}
          data-testid="quality-select"
          defaultValue={video.variants[0]?.quality}
          onChange={handleQualityChange}
          aria-label="Select video quality"
        >
          {video.variants.map((variant) => (
            <option key={variant.url} value={variant.quality}>
              {variant.quality}
            </option>
          ))}
        </select>
      )}

      <button
        className={styles.downloadButton}
        data-testid="download-button"
        type="button"
        onClick={handleDownloadClick}
      >
        Download
      </button>
    </div>
  );
}
