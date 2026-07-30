import type { HTMLAttributes, ReactNode } from 'react';
import styles from './Section.module.css';

type SectionSize = 'sm' | 'md' | 'lg';

interface SectionProps extends HTMLAttributes<HTMLElement> {
  /** Vertical padding size. Default: md. */
  size?: SectionSize;
  /** Section content. */
  children?: ReactNode;
}

/**
 * Section — semantic vertical-content grouping with consistent padding.
 * Renders a `<section>` element. Use to separate page regions.
 */
export function Section({
  size = 'md',
  children,
  className,
  ...rest
}: SectionProps): React.JSX.Element {
  const cls = [styles.section, styles[size], className ?? ''].filter(Boolean).join(' ');
  return (
    <section className={cls} {...rest}>
      {children}
    </section>
  );
}
