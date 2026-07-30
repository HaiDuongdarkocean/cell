import type { HTMLAttributes, ReactNode } from 'react';
import styles from './Code.module.css';

export interface CodeProps extends HTMLAttributes<HTMLElement> {
  /** Inline code content. For multi-line code blocks, use the CodeBlock molecule. */
  children: ReactNode;
}

/**
 * Code — inline `<code>` element with monospace font.
 * Inline only; for block-level code with syntax highlighting, use CodeBlock (molecule).
 */
export function Code({ children, className, ...rest }: CodeProps): React.JSX.Element {
  const cls = [styles.code, className ?? ''].filter(Boolean).join(' ');

  return (
    <code className={cls} {...rest}>
      {children}
    </code>
  );
}
