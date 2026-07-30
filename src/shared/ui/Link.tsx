import type { AnchorHTMLAttributes, ReactNode } from 'react';
import { Icon } from './Icon';
import styles from './Link.module.css';

type LinkVariant = 'inline' | 'standalone' | 'destructive';
type LinkSize = 'sm' | 'md' | 'lg';

interface LinkProps extends Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> {
  /** Destination URL. */
  href: string;
  /** Visual style. Default: inline. */
  variant?: LinkVariant;
  /** Size. Default: md. */
  size?: LinkSize;
  /** Open in new tab with rel="noopener noreferrer". */
  external?: boolean;
  /** Disabled state — dims the link and removes pointer interaction. */
  disabled?: boolean;
  /** Optional child content. */
  children?: ReactNode;
  /** Extra class names. */
  className?: string;
}

/**
 * Link — navigation atom with consistent color, hover, and focus states.
 *
 * Variants: inline (always underlined), standalone (underline on hover),
 * destructive (error color, underline on hover).
 * Sizes: sm, md, lg.
 *
 * NOTE: Currently renders a native `<a>`. When a router framework is integrated,
 * replace with `useLinkComponent()` so consumers can plug their router
 * (see docs/design-system/daft.md §2.3 rule 8).
 */
export function Link({
  href,
  variant = 'inline',
  size = 'md',
  external = false,
  disabled = false,
  children,
  className,
  ...rest
}: LinkProps): React.JSX.Element {
  const cls = [
    styles.link,
    styles[variant],
    styles[size],
    disabled ? styles.disabled : '',
    className ?? '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <a
      href={disabled ? undefined : href}
      className={cls}
      target={external ? '_blank' : undefined}
      rel={external ? 'noopener noreferrer' : undefined}
      aria-disabled={disabled || undefined}
      {...rest}
    >
      {children}
      {external && <Icon name="externalLink" size="xs" className={styles.externalIcon} />}
    </a>
  );
}
