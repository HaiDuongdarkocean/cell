import { useEffect, type ReactElement } from 'react';
import { Icon } from '@/shared/icons/Icon';
import styles from './TokenizeControls.module.css';

export interface TokenizeControlsProps {
  /** Whether text tokenization is active. */
  readonly text: boolean;
  /** Whether media (subtitle) tokenization is active. */
  readonly media: boolean;
  /** Whether the current page has a video; disables the media half when false. */
  readonly hasMedia: boolean;
  /** Called when the user toggles a half. */
  readonly onToggle: (mode: 'text' | 'media') => void;
}

/**
 * TokenizeControls — a split pill with two icon halves.
 *
 * Left half toggles web text tokenization. Right half toggles subtitle/media
 * tokenization and is disabled when the page has no video.
 */
export function TokenizeControls({
  text,
  media,
  hasMedia,
  onToggle,
}: TokenizeControlsProps): ReactElement {
  const mediaDisabled = !hasMedia;

  // If the page loses its video while media tokenize is on, turn it off.
  useEffect(() => {
    if (!hasMedia && media) {
      onToggle('media');
    }
  }, [hasMedia, media, onToggle]);

  return (
    <div
      className={styles.capsule}
      role="group"
      aria-label="Tokenize sources"
      data-cell-id="universal-panel-tokenize-controls"
    >
      <button
        type="button"
        className={`${styles.half} ${text ? styles.active : ''}`}
        aria-pressed={text}
        aria-label="Tokenize text"
        title={`Text tokenize: ${text ? 'ON' : 'OFF'}`}
        onClick={() => onToggle('text')}
        data-cell-id="universal-panel-header-tokenize-text"
      >
        <Icon name="scanText" size={18} />
      </button>
      <span className={styles.divider} aria-hidden="true" />
      <button
        type="button"
        className={`${styles.half} ${media ? styles.active : ''}`}
        aria-pressed={media}
        aria-disabled={mediaDisabled}
        aria-label="Tokenize media"
        title={mediaDisabled ? 'No video on this page' : `Media tokenize: ${media ? 'ON' : 'OFF'}`}
        onClick={() => onToggle('media')}
        disabled={mediaDisabled}
        data-cell-id="universal-panel-header-tokenize-media"
      >
        <Icon name="video" size={18} />
      </button>
    </div>
  );
}
