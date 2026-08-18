import { useCallback, useEffect, useRef, useState } from 'react';
import type { ButtonHTMLAttributes } from 'react';
import { Icon } from '@/shared/icons/Icon';
import styles from './CopyButton.module.css';

interface CopyButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Text to copy to clipboard when clicked. */
  value: string;
  /** Label shown next to the icon. Omit for icon-only mode. */
  label?: string;
  /** ms before reverting to copy icon after successful copy. Default 2000. */
  copiedDuration?: number;
}

/**
 * CopyButton — copies `value` to the clipboard via `navigator.clipboard.writeText`.
 *
 * Shows the `copy` icon by default and swaps to `checkDouble` after a successful
 * copy. An `aria-live="polite"` region announces "Copied" to screen readers.
 * `aria-label` defaults to "Copy to clipboard" and can be overridden.
 */
export function CopyButton({
  value,
  label,
  copiedDuration = 2000,
  className,
  'aria-label': ariaLabel = 'Copy to clipboard',
  onClick,
  ...rest
}: CopyButtonProps): React.JSX.Element {
  const [copied, setCopied] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const handleClick = useCallback(
    async (e: React.MouseEvent<HTMLButtonElement>) => {
      await onClick?.(e);
      if (e.defaultPrevented) return;
      try {
        await navigator.clipboard.writeText(value);
        setCopied(true);
        if (timerRef.current) clearTimeout(timerRef.current);
        timerRef.current = setTimeout(() => setCopied(false), copiedDuration);
      } catch {
        /* clipboard unavailable — silently ignore */
      }
    },
    [value, copiedDuration, onClick],
  );

  const cls = [styles.copyBtn, copied ? styles.copied : '', className ?? ''].filter(Boolean).join(' ');

  return (
    <button type="button" className={cls} aria-label={ariaLabel} onClick={handleClick} {...rest}>
      <span className={styles.icon}>
        <Icon name={copied ? 'checkDouble' : 'copy'} size={24} />
      </span>
      {label && <span className={styles.label}>{label}</span>}
      <span className={styles.srOnly} aria-live="polite">
        {copied ? 'Copied' : ''}
      </span>
    </button>
  );
}
