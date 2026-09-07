import { useCallback, useRef, useState } from 'react';
import { Button } from '@/shared/ui/Button';
import type { ButtonHTMLAttributes } from 'react';
import { Icon } from '@/shared/icons/Icon';
import { Spinner } from '@/shared/ui';
import styles from './PronunciationButton.module.css';

export interface PronunciationButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'aria-label'> {
  /** The word to pronounce — used for aria-label and TTS fallback. */
  word: string;
  /** Optional audio URL. If provided, plays via Audio; otherwise falls back to speechSynthesis TTS. */
  audioUrl?: string;
  /** Show loading spinner and disable interactions. */
  loading?: boolean;
}

/**
 * PronunciationButton — plays audio pronunciation for a dictionary word.
 * Uses `Audio.play()` when `audioUrl` is provided, otherwise falls back to
 * `speechSynthesis.speak()` (TTS). Shows a Spinner while loading.
 */
export function PronunciationButton({
  word,
  audioUrl,
  loading = false,
  disabled,
  className,
  ...rest
}: PronunciationButtonProps): React.JSX.Element {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [busy, setBusy] = useState(false);

  const handleClick = useCallback(() => {
    if (loading || busy) return;
    if (audioUrl) {
      if (!audioRef.current) {
        audioRef.current = new Audio(audioUrl);
      } else {
        audioRef.current.src = audioUrl;
      }
      setBusy(true);
      audioRef.current.play().finally(() => setBusy(false));
      return;
    }
    if (typeof speechSynthesis !== 'undefined') {
      const utterance = new SpeechSynthesisUtterance(word);
      speechSynthesis.speak(utterance);
    }
  }, [audioUrl, word, loading, busy]);

  const isLoading = loading || busy;
  const cls = [styles.btn, className ?? ''].filter(Boolean).join(' ');

  return (
    <Button variant="secondary"
      className={cls}
      disabled={disabled || isLoading}
      aria-busy={isLoading || undefined}
      aria-label={`Pronounce ${word}`}
      onClick={handleClick}
      {...rest}
    >
      {isLoading ? (
        <Spinner size="sm" />
      ) : (
        <Icon name="volumeHigh"  />
      )}
    </Button>
  );
}
