import type { HTMLAttributes, ReactNode } from 'react';
import styles from './Header.module.css';

export interface HeaderProps extends Omit<HTMLAttributes<HTMLElement>, 'title'> {
  /** Header title. */
  title?: ReactNode;
  /** Leading action(s). */
  leading?: ReactNode;
  /** Trailing action(s). */
  trailing?: ReactNode;
  children?: ReactNode;
}

/**
 * Header — top chrome for popup/options with title and actions.
 */
export function Header({ title, leading, trailing, children, className, ...rest }: HeaderProps): React.JSX.Element {
  const cls = [styles.header, className ?? ''].filter(Boolean).join(' ');

  return (
    <header className={cls} {...rest}>
      <div className={styles.leading}>{leading}</div>
      <div className={styles.title}>{title ?? children}</div>
      <div className={styles.trailing}>{trailing}</div>
    </header>
  );
}
