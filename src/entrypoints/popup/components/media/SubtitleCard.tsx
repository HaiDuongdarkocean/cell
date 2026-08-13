import { useState, useRef, useEffect } from 'react';
import type { DetectedSubtitle } from '@/entities/media';
import { Card } from '@/shared/ui/Card';
import { IconButton } from '@/shared/ui/IconButton';
import { Spinner } from '@/shared/ui/Spinner';
import { Icon } from '@/shared/icons/Icon';
import { COPY_FEEDBACK_DURATION_MS } from '@/shared/config/config';
import { formatFileSize } from '@/entrypoints/popup/utils/format';
import styles from './SubtitleCard.module.css';

interface SubtitleCardProps {
  subtitle: DetectedSubtitle;
  displayTitle?: string;
  /** Detected language label (e.g. "English"), overriding subtitle.language when set. */
  languageLabel?: string;
  selected: boolean;
  downloading: boolean;
  onToggleSelect: (subtitleId: string) => void;
  onDownload: (subtitleId: string) => void;
}

export function SubtitleCard({ subtitle, displayTitle, languageLabel, selected, downloading, onToggleSelect, onDownload }: SubtitleCardProps): React.JSX.Element {
  const [urlExpanded, setUrlExpanded] = useState(false);
  const [copied, setCopied] = useState(false);
  const copiedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (copiedTimerRef.current) clearTimeout(copiedTimerRef.current);
    };
  }, []);

  const handleCardClick = (): void => {
    if (downloading) return;
    onToggleSelect(subtitle.id);
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
    if (!downloading) onDownload(subtitle.id);
  };

  const handleExpandClick = (e: React.MouseEvent): void => {
    e.stopPropagation();
    setUrlExpanded((prev) => !prev);
  };

  const handleUrlClick = async (e: React.MouseEvent): Promise<void> => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(subtitle.url);
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

  const displayLanguage = languageLabel ?? subtitle.language;

  return (
    <Card
      variant={selected ? 'selected' : downloading ? 'default' : 'interactive'}
      className={`${styles.card} ${downloading ? styles.downloading : ''}`}
      data-cell-id="subtitle-item"
      data-id={subtitle.id}
    >
      {/* === Main row — icon | body | actions === */}
      <div
        className={styles.mainRow}
        onClick={handleCardClick}
        onKeyDown={handleCardKeyDown}
        role="button"
        tabIndex={0}
        aria-label={`Select ${displayTitle ?? displayLanguage}`}
      >
        {/* Icon — subtitle (amber) */}
        <div className={`${styles.icon} ${styles.subtitleIcon}`} aria-hidden="true">
          <Icon name="flag" size={16} />
        </div>

        {/* Body */}
        <div className={styles.body}>
          <div className={styles.title} data-cell-id="subtitle-title">{displayTitle ?? displayLanguage}</div>
          <div className={styles.tagRow}>
            <span className={styles.languageTag} data-cell-id="subtitle-language">{displayLanguage}</span>
            <span className={styles.meta}>
              {downloading ? 'Downloading…' : `${subtitle.format}${subtitle.size ? ` · ${formatFileSize(subtitle.size)}` : ''}`}
            </span>
          </div>
        </div>

        {/* Actions — expand chevron + download button */}
        <div className={styles.actions}>
          <IconButton
            size="sm"
            onClick={handleExpandClick}
            aria-label={urlExpanded ? 'Collapse URL' : 'Expand URL'}
            aria-expanded={urlExpanded}
            data-cell-id="subtitle-expand-url-btn"
          >
            <Icon
              name="chevronDown"
              className={`${styles.expandChevron} ${urlExpanded ? styles.expandChevronOpen : ''}`}
            />
          </IconButton>
          <div className={styles.action}>
            {downloading ? (
              <span className={styles.downloadingIndicator} aria-label="Downloading">
                <Spinner size="md" color="secondary" aria-hidden="true" />
              </span>
            ) : (
              <IconButton
                size="sm"
                variant="ghost"
                onClick={handleActionClick}
                aria-label="Download"
                data-cell-id="subtitle-download"
              >
                <Icon name="download" size={16} />
              </IconButton>
            )}
          </div>
        </div>
      </div>

      {/* === URL panel — only when expanded === */}
      {urlExpanded && (
        <div className={styles.urlPanel} data-cell-id="subtitle-url-row">
          <button
            type="button"
            className={styles.copyBtn}
            onClick={handleUrlClick}
            data-cell-id="subtitle-url"
            title="Click to copy URL"
          >
            <Icon name="copy" size={14} />
            <span className={styles.urlText}>{subtitle.url}</span>
          </button>
          {copied && <span className={styles.copiedBadge} data-cell-id="subtitle-copied-toast">Copied</span>}
        </div>
      )}
    </Card>
  );
}
