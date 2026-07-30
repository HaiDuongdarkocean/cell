import type { HTMLAttributes, ReactNode } from 'react';
import styles from './Kbd.module.css';

export interface KbdProps extends HTMLAttributes<HTMLElement> {
  /** The key label, e.g. "Ctrl", "Enter", "⌘". */
  children: ReactNode;
}

/**
 * Kbd — semantic `<kbd>` element for displaying keyboard keys with inset
 * shadow for depth. Uses the code/mono font family.
 */
export function Kbd({ children, className, ...rest }: KbdProps): React.JSX.Element {
  const cls = [styles.kbd, className ?? ''].filter(Boolean).join(' ');

  return (
    <kbd className={cls} {...rest}>
      {children}
    </kbd>
  );
}
