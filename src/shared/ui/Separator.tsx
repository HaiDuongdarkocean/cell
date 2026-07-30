import type { HTMLAttributes } from 'react';
import styles from './Separator.module.css';

type SeparatorOrientation = 'horizontal' | 'vertical';
type SeparatorVariant = 'solid' | 'dashed';

interface SeparatorProps extends HTMLAttributes<HTMLDivElement> {
  /** Orientation. Default: horizontal. */
  orientation?: SeparatorOrientation;
  /** Line style. Default: solid. */
  variant?: SeparatorVariant;
  /** Decorative (no semantic role) vs semantic separator. Default: true. */
  decorative?: boolean;
  /** Extra class names. */
  className?: string;
}

/**
 * Separator — visual divider between content sections.
 *
 * Orientations: horizontal, vertical.
 * Variants: solid, dashed.
 * By default decorative (aria-hidden); pass `decorative={false}` for semantic role="separator".
 */
export function Separator({
  orientation = 'horizontal',
  variant = 'solid',
  decorative = true,
  className,
  ...rest
}: SeparatorProps): React.JSX.Element {
  const cls = [
    styles.separator,
    styles[orientation],
    styles[variant],
    className ?? '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div
      className={cls}
      role={decorative ? 'none' : 'separator'}
      aria-orientation={decorative ? undefined : orientation}
      aria-hidden={decorative ? 'true' : undefined}
      {...rest}
    />
  );
}
