import type { AnchorHTMLAttributes, ReactNode } from 'react';
import styles from './Link.module.css';

type LinkVariant = 'default' | 'subtle' | 'destructive';
type LinkSize = 'sm' | 'md' | 'lg';

interface LinkProps extends Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> {
  /** Destination URL. */
  href: string;
  /** Visual style. Default: default. */
  variant?: LinkVariant;
  /** Size. Default: md. */
  size?: LinkSize;
  /** Open in new tab with rel="noopener noreferrer". */
  external?: boolean;
  /** Optional child content. */
  children?: ReactNode;
  /** Extra class names. */
  className?: string;
}

/**
 * Link — navigation atom with consistent color, hover, and focus states.
 *
 * Variants: default, subtle, destructive.
 * Sizes: sm, md, lg.
 *
 * NOTE: Currently renders a native `<a>`. When a router framework is integrated,
 * replace with `useLinkComponent()` so consumers can plug their router
 * (see docs/design-system/daft.md §2.3 rule 8).
 */
export function Link({
  href,
  variant = 'default',
  size = 'md',
  external = false,
  children,
  className,
  ...rest
}: LinkProps): React.JSX.Element {
  const cls = [
    styles.link,
    styles[variant],
    styles[size],
    className ?? '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <a
      href={href}
      className={cls}
      target={external ? '_blank' : undefined}
      rel={external ? 'noopener noreferrer' : undefined}
      {...rest}
    >
      {children}
    </a>
  );
}
