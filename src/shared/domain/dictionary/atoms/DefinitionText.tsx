import type { HTMLAttributes, ReactNode } from 'react';
import styles from './DefinitionText.module.css';

export interface DefinitionTextProps extends HTMLAttributes<HTMLElement> {
  /** When provided, renders a numbered `<li>` with this index. Otherwise renders a `<p>`. */
  index?: number;
  children: ReactNode;
}

/**
 * DefinitionText — renders a dictionary definition as a `<p>` or numbered `<li>`.
 * Uses `--color-text-primary` with structured formatting.
 */
export function DefinitionText({ index, children, className, ...rest }: DefinitionTextProps): React.JSX.Element {
  const cls = [styles.definition, className ?? ''].filter(Boolean).join(' ');

  if (index !== undefined) {
    return (
      <li className={cls} {...(rest as HTMLAttributes<HTMLLIElement>)}>
        <span className={styles.number}>{index}.</span>
        <span className={styles.text}>{children}</span>
      </li>
    );
  }

  return (
    <p className={cls} {...(rest as HTMLAttributes<HTMLParagraphElement>)}>
      {children}
    </p>
  );
}
