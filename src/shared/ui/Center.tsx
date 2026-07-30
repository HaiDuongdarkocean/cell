import type { ElementType, HTMLAttributes, ReactNode } from 'react';
import styles from './Center.module.css';

interface CenterProps extends HTMLAttributes<HTMLElement> {
  /** Render as an inline-flex container instead of block flex. */
  inline?: boolean;
  /** Element type to render. Default: div. */
  as?: ElementType;
  /** Content to center. */
  children?: ReactNode;
}

/**
 * Center — flex container that centers its children on both axes.
 * Renders `<div>` with `display: flex; align-items: center; justify-content: center`.
 * Use `inline` for an inline-flex variant.
 */
export function Center({
  inline = false,
  as: Component = 'div',
  children,
  className,
  ...rest
}: CenterProps): React.JSX.Element {
  const cls = [styles.center, inline ? styles.inline : '', className ?? '']
    .filter(Boolean)
    .join(' ');

  return (
    <Component className={cls} {...rest}>
      {children}
    </Component>
  );
}
