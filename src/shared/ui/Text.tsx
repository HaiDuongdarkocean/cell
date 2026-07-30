import type { ReactNode, ElementType } from 'react';
import styles from './Text.module.css';

type TextVariant =
  | 'body'
  | 'label'
  | 'heading-1'
  | 'heading-2'
  | 'heading-3'
  | 'supporting';

type TextColor = 'primary' | 'secondary' | 'disabled' | 'inverse';

interface TextProps {
  /** Typography preset. Default: body. */
  variant?: TextVariant;
  /** Text color. Default: primary. */
  color?: TextColor;
  /** Truncate to a single line with ellipsis. */
  truncate?: boolean;
  /** Render as a different element (e.g. 'span', 'p', 'h1'). Default: span. */
  as?: ElementType;
  /** Optional child content. */
  children?: ReactNode;
  /** Extra class names. */
  className?: string;
}

/**
 * Text — typography atom that maps semantic variants to design-system text tokens.
 *
 * Variants: body, label, heading-1, heading-2, heading-3, supporting.
 * Colors: primary, secondary, disabled, inverse.
 */
export function Text({
  variant = 'body',
  color = 'primary',
  truncate = false,
  as: Tag = 'span',
  children,
  className,
}: TextProps): React.JSX.Element {
  const cls = [
    styles.text,
    styles[variant],
    styles[color],
    truncate ? styles.truncate : '',
    className ?? '',
  ]
    .filter(Boolean)
    .join(' ');

  return <Tag className={cls}>{children}</Tag>;
}
