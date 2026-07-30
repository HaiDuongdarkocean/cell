import type { HTMLAttributes, ReactNode } from 'react';
import styles from './Kbd.module.css';

type KbdSize = 'sm' | 'md';

export interface KbdProps extends HTMLAttributes<HTMLElement> {
  /** The key label, e.g. "Ctrl", "Enter", "⌘". */
  children: ReactNode;
  /** Size. Default: md. */
  size?: KbdSize;
}

/**
 * Kbd — semantic `<kbd>` element for displaying keyboard keys with inset
 * shadow for depth. Uses the code/mono font family.
 */
export function Kbd({ size = 'md', children, className, ...rest }: KbdProps): React.JSX.Element {
  const cls = [styles.kbd, styles[size], className ?? ''].filter(Boolean).join(' ');

  return (
    <kbd className={cls} {...rest}>
      {children}
    </kbd>
  );
}
