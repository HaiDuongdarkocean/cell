import { useEffect, type ReactElement } from 'react';
import { Icon } from '@/shared/ui/Icon';
import { Button } from '@/shared/ui/Button';
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
interface TokenizeHalfProps {
  readonly active: boolean;
  readonly disabled?: boolean;
  readonly icon: 'scanText' | 'video';
  readonly label: string;
  readonly onClick: () => void;
  readonly testId: string;
}

function TokenizeHalf({ active, disabled = false, icon, label, onClick, testId }: TokenizeHalfProps): React.JSX.Element {
  return (
    <Button
      shape="pill"
      variant={active ? 'primarySubtle' : 'ghost'}
      fullWidth
      aria-pressed={active}
      aria-label={label}
      title={disabled ? 'No video on this page' : `${label}: ${active ? 'ON' : 'OFF'}`}
      disabled={disabled}
      onClick={onClick}
      onPointerDown={(e): void => { e.currentTarget.blur(); }}
      data-pressed={String(active)}
      data-cell-id={testId}
      leadingIcon={<Icon name={icon} size="sm" />}
    />
  );
}

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
      <TokenizeHalf
        active={text}
        icon="scanText"
        label="Tokenize text"
        onClick={() => onToggle('text')}
        testId="universal-panel-header-tokenize-text"
      />
      <TokenizeHalf
        active={media}
        disabled={mediaDisabled}
        icon="video"
        label="Tokenize media"
        onClick={() => onToggle('media')}
        testId="universal-panel-header-tokenize-media"
      />
    </div>
  );
}
