import type { HTMLAttributes, ReactNode } from 'react';
import styles from './PhoneticText.module.css';

export interface PhoneticTextProps extends HTMLAttributes<HTMLSpanElement> {
  children: ReactNode;
}

/**
 * PhoneticText — inline IPA notation for a dictionary entry.
 * Renders a `<span>` with code font family and secondary text color.
 */
export function PhoneticText({ children, className, ...rest }: PhoneticTextProps): React.JSX.Element {
  const cls = [styles.phonetic, className ?? ''].filter(Boolean).join(' ');
  return (
    <span className={cls} {...rest}>
      {children}
    </span>
  );
}
