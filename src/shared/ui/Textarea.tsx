import type { TextareaHTMLAttributes } from 'react';
import styles from './Textarea.module.css';

type TextareaResize = 'none' | 'vertical' | 'horizontal' | 'both';

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  /** Error state. */
  error?: boolean;
  /** Resize direction. Default: vertical. */
  resize?: TextareaResize;
}

/**
 * Textarea — styled multiline input with resize, error, and disabled states.
 */
export function Textarea({ error, resize = 'vertical', className, ...rest }: TextareaProps): React.JSX.Element {
  const cls = [styles.textarea, styles[resize], error ? styles.error : '', className ?? ''].filter(Boolean).join(' ');

  return (
    <textarea
      className={cls}
      aria-invalid={error || undefined}
      {...rest}
    />
  );
}
