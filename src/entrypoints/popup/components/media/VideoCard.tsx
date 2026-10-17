import { useState } from 'react';
import type { DetectedVideo, VideoQuality } from '@/entities/media';
import { Card } from '@/shared/ui/Card';
import { Center } from '@/shared/ui/Center';
import { Button, Flex, HStack, VStack, Select } from '@/shared/ui';
import { Spinner } from '@/shared/ui/Spinner';
import cardAnimations from '@/shared/ui/CardAnimations.module.css';
import { Icon } from '@/shared/ui/Icon';
import { useCopyFlash } from '@/entrypoints/popup/hooks/useCopyFlash';
import { t } from '@/shared/i18n';
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

  const [urlExpanded, setUrlExpanded] = useState(false);
  const { copied, copy } = useCopyFlash();

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

  const handleUrlClick = (e: React.MouseEvent): void => {
    e.stopPropagation();
    void copy(video.url, e.target as HTMLElement);
  };

  return (
    <Card
      variant={selected ? 'selected' : downloading ? 'default' : 'interactive'}
      className={`${styles.card} ${cardAnimations.fadeIn} ${downloading ? styles.downloading : ''}`}
      data-tihoka-id="video-card"
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
          aria-label={t('downloads.media.select', [displayTitle ?? video.title])}
        >
          {/* Icon */}
          <Center className={`${styles.icon} ${styles.videoIcon}`} aria-hidden="true">
            <Icon name="play" size={18}  />
          </Center>

        {/* Body */}
        <div className={styles.body}>
          <div className={styles.title} data-tihoka-id="video-title">{displayTitle ?? video.title}</div>
          <Flex align="center" gap="1" wrap="wrap" className={styles.tagRow}>
            <span className={styles.formatTag} data-tihoka-id="video-format">{video.format}</span>
            {selectedVariant?.quality && selectedVariant.quality !== 'auto' && (
              <span className={styles.qualityTag} data-tihoka-id="video-quality">{selectedVariant.quality}</span>
            )}
            {downloading ? (
              <span className={styles.meta}>{t('downloads.media.downloading')}</span>
            ) : (
              <>
                {selectedVariant?.size && (
                  <span className={styles.meta} data-tihoka-id="video-size">
                    {formatFileSizeOrUnknown(selectedVariant.size)}
                  </span>
                )}

                {hasMultipleVariants && (
                  <span onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
                    <Select
                      size="sm"
                      variant="ghost"
                      value={selectedVariant?.quality}
                      options={video.variants.map((variant) => ({
                        value: variant.quality,
                        label: (
                          <HStack align="center" justify="between" gap="3">
                            <span>{variant.quality}</span>
                            {variant.size && (
                              <span className={styles.qualitySize}>{formatFileSizeOrUnknown(variant.size)}</span>
                            )}
                          </HStack>
                        ),
                      }))}
                      onChange={(quality) => onSelectQuality(video.id, quality as VideoQuality)}
                      aria-label={t('downloads.media.selectQuality')}
                    />
                  </span>
                )}
              </>
            )}
          </Flex>
        </div>

        {/* Actions — expand chevron + download button */}
        <HStack align="center" gap="1" className={styles.actions}>
          <Button shape="circle"
            size="sm"
            variant="ghost"
            onClick={handleExpandClick}
            aria-label={urlExpanded ? t('downloads.media.hideUrl') : t('downloads.media.showUrl')}
            aria-expanded={urlExpanded}
            data-tihoka-id="expand-url-btn"
          >
            <Icon
              name="chevronDown"
              size={18}
              className={`${styles.expandChevron} ${urlExpanded ? styles.expandChevronOpen : ''}`}
            />
          </Button>
          <div className={styles.action}>
            {downloading ? (
              <Center as="span" className={styles.downloadingIndicator} aria-label={t('downloads.media.downloading')}>
                <Spinner size="md" color="secondary" aria-hidden="true" />
              </Center>
            ) : (
              <Button shape="circle"
                size="sm"
                variant="ghost"
                onClick={handleActionClick}
                aria-label={t('downloads.action.download')}
                data-tihoka-id="download-button"
              >
                <Icon name="download" size={18}  />
              </Button>
            )}
          </div>
        </HStack>
      </HStack>

      {/* === URL panel — only when expanded === */}
      {urlExpanded && (
        <HStack align="center" gap="2" className={`${styles.urlPanel} ${cardAnimations.urlPanel}`} data-tihoka-id="url-row">
          <Button
            variant="ghost"
            size="xs"
            className={styles.copyBtn}
            trailingIcon={<Icon name="copy" size={18}  />}
            onClick={(e) => { void handleUrlClick(e); }}
            data-tihoka-id="video-url"
            title={t('downloads.media.copyUrl')}
            aria-label={t('downloads.media.copyUrl')}
          >
            <span className={styles.urlText}>{video.url}</span>
          </Button>
          {copied && <span className={`${styles.copiedBadge} ${cardAnimations.copiedBadge}`} data-tihoka-id="copied-toast">{t('downloads.media.copied')}</span>}
        </HStack>
      )}
      </VStack>
    </Card>
  );
}
