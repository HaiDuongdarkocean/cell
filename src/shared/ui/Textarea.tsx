import type { Ref, TextareaHTMLAttributes } from 'react';
import styles from './Textarea.module.css';

type TextareaResize = 'none' | 'vertical' | 'horizontal' | 'both';
type TextareaVariant = 'default' | 'unstyled';

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  /** Error state. */
  error?: boolean;
  /** Resize direction. Default: vertical. */
  resize?: TextareaResize;
  /** `unstyled` renders the bare element — consumer className only, no chrome. */
  variant?: TextareaVariant;
  /** Ref to the underlying textarea (React 19 ref-as-prop). */
  ref?: Ref<HTMLTextAreaElement>;
}

/**
 * Textarea — styled multiline input with resize, error, and disabled states.
 */
export function Textarea({ error, resize = 'vertical', variant = 'default', className, ref, ...rest }: TextareaProps): React.JSX.Element {
  if (variant === 'unstyled') {
    return (
      <textarea
        ref={ref}
        className={className}
        aria-invalid={error || undefined}
        {...rest}
      />
    );
  }

  const cls = [styles.textarea, styles[resize], error ? styles.error : '', className ?? ''].filter(Boolean).join(' ');

  return (
    <textarea
      ref={ref}
      className={cls}
      aria-invalid={error || undefined}
      {...rest}
    />
  );
}
