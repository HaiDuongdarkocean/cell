import type { HTMLAttributes, ReactNode } from 'react';
import styles from './PhoneticText.module.css';

export interface PhoneticTextProps extends HTMLAttributes<HTMLSpanElement> {
  children: ReactNode;
  /** Text size. sm uses --font-size-sm, md uses --font-size-base, lg uses --font-size-lg. */
  size?: 'sm' | 'md' | 'lg';
}

/**
 * PhoneticText — inline IPA notation for a dictionary entry.
 * Renders a `<span>` with code font family and secondary text color.
 */
export function PhoneticText({ children, className, size = 'md', ...rest }: PhoneticTextProps): React.JSX.Element {
  const cls = [styles.phonetic, styles[size], className ?? ''].filter(Boolean).join(' ');
  return (
    <span className={cls} {...rest}>
      {children}
    </span>
  );
}
