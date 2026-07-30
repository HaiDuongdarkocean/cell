import type { ElementType, ReactNode, HTMLAttributes } from 'react';
import styles from './VisuallyHidden.module.css';

export interface VisuallyHiddenProps extends HTMLAttributes<HTMLElement> {
  /** Content visually hidden but available to screen readers. */
  children: ReactNode;
  /** Rendered element type. Default: span. */
  as?: ElementType;
}

/**
 * VisuallyHidden — hides content from sighted users while keeping it
 * accessible to screen readers (sr-only pattern: absolute, clip, 1px size).
 */
export function VisuallyHidden({
  as: Tag = 'span',
  children,
  className,
  ...rest
}: VisuallyHiddenProps): React.JSX.Element {
  const cls = [styles.srOnly, className ?? ''].filter(Boolean).join(' ');

  const Component = Tag as ElementType;
  return (
    <Component className={cls} {...rest}>
      {children}
    </Component>
  );
}
