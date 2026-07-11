import { useState } from 'react';
import type { DetectedSubtitle } from '@/entities/media';
import { IconButton } from '@/shared/ui/IconButton';
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

export function SubtitleCard({ subtitle, displayTitle, languageLabel, selected, downloading, onToggleSelect, onDownload }: SubtitleCardProps): React.JSX.Element {
  const [urlExpanded, setUrlExpanded] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleCardClick = (): void => {
    if (downloading) return;
    onToggleSelect(subtitle.id);
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
      setTimeout(() => setCopied(false), 2000);
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
    <article
      className={`${styles.card} ${selected ? styles.selected : ''} ${downloading ? styles.downloading : ''}`}
      data-testid="subtitle-item"
      data-id={subtitle.id}
    >
      {/* === Main row — icon | body | actions === */}
      <div className={styles.mainRow} onClick={handleCardClick}>
        {/* Icon — subtitle (amber) */}
        <div className={`${styles.icon} ${styles.subtitleIcon}`} aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" />
            <line x1="4" y1="22" x2="4" y2="15" />
          </svg>
        </div>

        {/* Body */}
        <div className={styles.body}>
          <div className={styles.title} data-testid="subtitle-title">{displayTitle ?? displayLanguage}</div>
          <div className={styles.tagRow}>
            <span className={styles.languageTag} data-testid="subtitle-language">{displayLanguage}</span>
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
            data-testid="subtitle-expand-url-btn"
          >
            <svg
              className={`${styles.expandChevron} ${urlExpanded ? styles.expandChevronOpen : ''}`}
              viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
            >
              <path d="M6 9l6 6 6-6" />
            </svg>
          </IconButton>
          <div className={styles.action} onClick={handleActionClick}>
            {downloading ? (
              <span className={styles.downloadingIndicator} aria-label="Downloading">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                </svg>
              </span>
            ) : (
              <IconButton
                variant="ghost"
                onClick={handleActionClick}
                aria-label="Download"
                data-testid="subtitle-download"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" />
                </svg>
              </IconButton>
            )}
          </div>
        </div>
      </div>

      {/* === URL panel — only when expanded === */}
      {urlExpanded && (
        <div className={styles.urlPanel} data-testid="subtitle-url-row">
          <button
            type="button"
            className={styles.copyBtn}
            onClick={handleUrlClick}
            data-testid="subtitle-url"
            title="Click to copy URL"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
            </svg>
            <span className={styles.urlText}>{subtitle.url}</span>
          </button>
          {copied && <span className={styles.copiedBadge} data-testid="subtitle-copied-toast">Copied</span>}
        </div>
      )}
    </article>
  );
}
