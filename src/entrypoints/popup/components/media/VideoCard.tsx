import { useState, useRef, useEffect } from 'react';
import type { DetectedVideo, VideoQuality } from '@/entities/media';
import { IconButton } from '@/shared/ui/IconButton';
import { Icon } from '@/shared/icons/Icon';
import styles from './VideoCard.module.css';

interface VideoCardProps {
  video: DetectedVideo;
  displayTitle?: string;
  selected: boolean;
  downloading: boolean;
  onToggleSelect: (videoId: string) => void;
  onDownload: (videoId: string) => void;
  onSelectQuality: (videoId: string, quality: VideoQuality) => void;
}

function formatFileSize(bytes?: number): string {
  if (!bytes) return 'Unknown';
  const units = ['B', 'KB', 'MB', 'GB'];
  let size = bytes;
  let unitIndex = 0;
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }
  return `${size.toFixed(1)} ${units[unitIndex]}`;
}

export function VideoCard({
  video,
  displayTitle,
  selected,
  downloading,
  onToggleSelect,
  onDownload,
  onSelectQuality,
}: VideoCardProps): React.JSX.Element {
  const hasMultipleVariants = video.variants.length > 1;
  const selectedVariant = video.variants[0];

  const [qualityOpen, setQualityOpen] = useState(false);
  const [urlExpanded, setUrlExpanded] = useState(false);
  const [copied, setCopied] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const copiedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (copiedTimerRef.current) clearTimeout(copiedTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (!qualityOpen) return;
    const handleClickOutside = (e: MouseEvent): void => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setQualityOpen(false);
      }
    };
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [qualityOpen]);

  const handleQualitySelect = (quality: VideoQuality): void => {
    onSelectQuality(video.id, quality);
    setQualityOpen(false);
  };

  const handleCardClick = (): void => {
    if (downloading) return;
    onToggleSelect(video.id);
  };

  const handleActionClick = (e: React.MouseEvent): void => {
    e.stopPropagation();
    if (!downloading) onDownload(video.id);
  };

  const handleExpandClick = (e: React.MouseEvent): void => {
    e.stopPropagation();
    setUrlExpanded((prev) => !prev);
  };

  const handleUrlClick = async (e: React.MouseEvent): Promise<void> => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(video.url);
      setCopied(true);
      if (copiedTimerRef.current) clearTimeout(copiedTimerRef.current);
      copiedTimerRef.current = setTimeout(() => setCopied(false), 2000);
    } catch {
      const range = document.createRange();
      const target = e.target as HTMLElement;
      range.selectNode(target);
      window.getSelection()?.removeAllRanges();
      window.getSelection()?.addRange(range);
    }
  };

  return (
    <article
      className={`${styles.card} ${selected ? styles.selected : ''} ${downloading ? styles.downloading : ''}`}
      data-testid="video-card"
      data-id={video.id}
    >
      {/* === Main row — icon | body | actions === */}
      <div className={styles.mainRow} onClick={handleCardClick}>
        {/* Icon */}
        <div className={`${styles.icon} ${styles.videoIcon}`} aria-hidden="true">
          <Icon name="play" />
        </div>

        {/* Body */}
        <div className={styles.body}>
          <div className={styles.title} data-testid="video-title">{displayTitle ?? video.title}</div>
          <div className={styles.tagRow}>
            <span className={styles.formatTag} data-testid="video-format">{video.format}</span>
            {selectedVariant?.quality && selectedVariant.quality !== 'auto' && (
              <span className={styles.qualityTag} data-testid="video-quality">{selectedVariant.quality}</span>
            )}
            {downloading ? (
              <span className={styles.meta}>Downloading…</span>
            ) : (
              <>
                {selectedVariant?.size && (
                  <span className={styles.meta} data-testid="video-size">
                    {formatFileSize(selectedVariant.size)}
                  </span>
                )}

                {hasMultipleVariants && (
                  <div className={styles.qualityWrapper} ref={wrapperRef}>
                    <button
                      type="button"
                      className={styles.qualityTrigger}
                      onClick={(e) => { e.stopPropagation(); setQualityOpen((open) => !open); }}
                      aria-label="Select quality"
                      aria-expanded={qualityOpen}
                    >
                      {selectedVariant?.quality ?? 'Quality'}
                      <Icon name="chevronDown" className={styles.chevron} />
                    </button>

                    {qualityOpen && (
                      <div className={styles.qualityMenu} role="listbox">
                        {video.variants.map((variant) => (
                          <div
                            key={variant.url}
                            className={`${styles.qualityOption} ${variant.quality === selectedVariant?.quality ? styles.qualitySelected : ''}`}
                            role="option"
                            aria-selected={variant.quality === selectedVariant?.quality}
                            onClick={(e) => { e.stopPropagation(); handleQualitySelect(variant.quality); }}
                          >
                            <span>{variant.quality}</span>
                            {variant.size && (
                              <span className={styles.qualitySize}>{formatFileSize(variant.size)}</span>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* Actions — expand chevron + download button */}
        <div className={styles.actions}>
          <IconButton
            size="sm"
            onClick={handleExpandClick}
            aria-label={urlExpanded ? 'Collapse URL' : 'Expand URL'}
            aria-expanded={urlExpanded}
            data-testid="expand-url-btn"
          >
            <Icon
              name="chevronDown"
              className={`${styles.expandChevron} ${urlExpanded ? styles.expandChevronOpen : ''}`}
            />
          </IconButton>
          <div className={styles.action} onClick={handleActionClick}>
            {downloading ? (
              <span className={styles.downloadingIndicator} aria-label="Downloading">
                <Icon name="loader" />
              </span>
            ) : (
              <IconButton
                size="sm"
                variant="ghost"
                onClick={handleActionClick}
                aria-label="Download"
                data-testid="download-button"
              >
                <Icon name="download" size={16} />
              </IconButton>
            )}
          </div>
        </div>
      </div>

      {/* === URL panel — only when expanded === */}
      {urlExpanded && (
        <div className={styles.urlPanel} data-testid="url-row">
          <button
            type="button"
            className={styles.copyBtn}
            onClick={handleUrlClick}
            data-testid="video-url"
            title="Click to copy URL"
          >
            <Icon name="copy" />
            <span className={styles.urlText}>{video.url}</span>
          </button>
          {copied && <span className={styles.copiedBadge} data-testid="copied-toast">Copied</span>}
        </div>
      )}
    </article>
  );
}
