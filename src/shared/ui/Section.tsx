import type { ReactNode } from 'react';
import styles from './Section.module.css';

type SpacingToken = '0' | '0-5' | '1' | '1-5' | '2' | '2-5' | '3' | '3-5' | '4' | '4-5' | '5' | '6' | '7' | '8' | '9' | '10' | '12' | '16' | '20' | '24';
type SectionTag = 'section' | 'article' | 'main' | 'aside' | 'header' | 'footer' | 'nav';

interface SectionProps {
  /** Semantic HTML tag to render. Default: section. */
  as?: SectionTag;
  /** Vertical padding size. Default: 6. */
  padding?: SpacingToken;
  /** Gap between children (flex layout). */
  gap?: SpacingToken;
  /** Accessible label. */
  ariaLabel?: string;
  /** ID of the element that labels this section. */
  ariaLabelledBy?: string;
  /** Section content. */
  children?: ReactNode;
  /** Extra class names. */
  className?: string;
}

/**
 * Section — semantic vertical-content grouping with consistent padding.
 * Renders a configurable semantic element (default `<section>`). Use to
 * separate page regions.
 */
export function Section({
  as = 'section',
  padding = '6',
  gap,
  ariaLabel,
  ariaLabelledBy,
  children,
  className,
}: SectionProps): React.JSX.Element {
  const Tag = as;
  const cls = [
    styles.section,
    padding ? styles[`padding${padding}`] : '',
    gap ? styles[`gap${gap}`] : '',
    className ?? '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <Tag
      className={cls}
      aria-label={ariaLabel}
      aria-labelledby={ariaLabelledBy}
    >
      {children}
    </Tag>
  );
}
