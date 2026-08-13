import { useState, useRef, useEffect } from 'react';
import type { DetectedVideo, VideoQuality } from '@/entities/media';
import { Card } from '@/shared/ui/Card';
import { Center } from '@/shared/ui/Center';
import { Flex, HStack, VStack } from '@/shared/ui';
import { IconButton } from '@/shared/ui/IconButton';
import { Spinner } from '@/shared/ui/Spinner';
import cardAnimations from '@/shared/ui/CardAnimations.module.css';
import { Icon } from '@/shared/icons/Icon';
import { COPY_FEEDBACK_DURATION_MS } from '@/shared/config/config';
import { formatFileSizeOrUnknown } from '@/entrypoints/popup/utils/format';
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

  const handleCardKeyDown = (e: React.KeyboardEvent<HTMLDivElement>): void => {
    if (e.target !== e.currentTarget) return; // nested buttons handle their own keys
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleCardClick();
    }
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
      copiedTimerRef.current = setTimeout(() => setCopied(false), COPY_FEEDBACK_DURATION_MS);
    } catch {
      const range = document.createRange();
      const target = e.target as HTMLElement;
      range.selectNode(target);
      window.getSelection()?.removeAllRanges();
      window.getSelection()?.addRange(range);
    }
  };

  return (
    <Card
      variant={selected ? 'selected' : downloading ? 'default' : 'interactive'}
      className={`${styles.card} ${cardAnimations.fadeIn} ${downloading ? styles.downloading : ''}`}
      data-cell-id="video-card"
      data-id={video.id}
    >
      <VStack>
        {/* === Main row — icon | body | actions === */}
        <HStack
          align="center"
          gap="3"
          className={styles.mainRow}
          onClick={handleCardClick}
          onKeyDown={handleCardKeyDown}
          role="button"
          tabIndex={0}
          aria-label={`Select ${displayTitle ?? video.title}`}
        >
          {/* Icon */}
          <Center className={`${styles.icon} ${styles.videoIcon}`} aria-hidden="true">
            <Icon name="play" size={16} />
          </Center>

        {/* Body */}
        <div className={styles.body}>
          <div className={styles.title} data-cell-id="video-title">{displayTitle ?? video.title}</div>
          <Flex align="center" gap="1" wrap="wrap" className={styles.tagRow}>
            <span className={styles.formatTag} data-cell-id="video-format">{video.format}</span>
            {selectedVariant?.quality && selectedVariant.quality !== 'auto' && (
              <span className={styles.qualityTag} data-cell-id="video-quality">{selectedVariant.quality}</span>
            )}
            {downloading ? (
              <span className={styles.meta}>Downloading…</span>
            ) : (
              <>
                {selectedVariant?.size && (
                  <span className={styles.meta} data-cell-id="video-size">
                    {formatFileSizeOrUnknown(selectedVariant.size)}
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
                      <VStack gap="0-5" className={styles.qualityMenu} role="listbox">
                        {video.variants.map((variant) => (
                          <HStack
                            key={variant.url}
                            align="center"
                            justify="between"
                            gap="3"
                            className={`${styles.qualityOption} ${variant.quality === selectedVariant?.quality ? styles.qualitySelected : ''}`}
                            role="option"
                            aria-selected={variant.quality === selectedVariant?.quality}
                            onClick={(e) => { e.stopPropagation(); handleQualitySelect(variant.quality); }}
                          >
                            <span>{variant.quality}</span>
                            {variant.size && (
                              <span className={styles.qualitySize}>{formatFileSizeOrUnknown(variant.size)}</span>
                            )}
                          </HStack>
                        ))}
                      </VStack>
                    )}
                  </div>
                )}
              </>
            )}
          </Flex>
        </div>

        {/* Actions — expand chevron + download button */}
        <HStack align="center" gap="1" className={styles.actions}>
          <IconButton
            size="sm"
            onClick={handleExpandClick}
            aria-label={urlExpanded ? 'Collapse URL' : 'Expand URL'}
            aria-expanded={urlExpanded}
            data-cell-id="expand-url-btn"
          >
            <Icon
              name="chevronDown"
              className={`${styles.expandChevron} ${urlExpanded ? styles.expandChevronOpen : ''}`}
            />
          </IconButton>
          <div className={styles.action}>
            {downloading ? (
              <Center as="span" className={styles.downloadingIndicator} aria-label="Downloading">
                <Spinner size="md" color="secondary" aria-hidden="true" />
              </Center>
            ) : (
              <IconButton
                size="sm"
                variant="ghost"
                onClick={handleActionClick}
                aria-label="Download"
                data-cell-id="download-button"
              >
                <Icon name="download" size={16} />
              </IconButton>
            )}
          </div>
        </HStack>
      </HStack>

      {/* === URL panel — only when expanded === */}
      {urlExpanded && (
        <HStack align="center" gap="2" className={`${styles.urlPanel} ${cardAnimations.urlPanel}`} data-cell-id="url-row">
          <button
            type="button"
            className={styles.copyBtn}
            onClick={handleUrlClick}
            data-cell-id="video-url"
            title="Click to copy URL"
          >
            <Icon name="copy" size={14} />
            <span className={styles.urlText}>{video.url}</span>
          </button>
          {copied && <span className={`${styles.copiedBadge} ${cardAnimations.copiedBadge}`} data-cell-id="copied-toast">Copied</span>}
        </HStack>
      )}
      </VStack>
    </Card>
  );
}
