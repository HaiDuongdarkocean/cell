import { createElement, type HTMLAttributes, type ReactNode } from 'react';
import styles from './Heading.module.css';

type HeadingLevel = 1 | 2 | 3 | 4 | 5 | 6;
type HeadingSize = 1 | 2 | 3 | 4 | 5 | 6;
type HeadingDisplay = 'display-1' | 'display-2' | 'display-3';

export interface HeadingProps extends HTMLAttributes<HTMLHeadingElement> {
  /** Semantic heading level — controls the tag (h1–h6). Default: 1. */
  level?: HeadingLevel;
  /** Visual size — decoupled from level. Defaults to `level`. Ignored when `display` is set. */
  size?: HeadingSize;
  /** Display variant — overrides `size` with a larger display style. */
  display?: HeadingDisplay;
  /** Heading content. */
  children: ReactNode;
}

const TAGS: Record<HeadingLevel, 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6'> = {
  1: 'h1',
  2: 'h2',
  3: 'h3',
  4: 'h4',
  5: 'h5',
  6: 'h6',
};

/**
 * Heading — semantic `<h1>`–`<h6>` with decoupled visual size.
 * `level` controls the HTML tag for correct document outline;
 * `size` controls the visual appearance independently.
 */
export function Heading({
  level = 1,
  size,
  display,
  children,
  className,
  ...rest
}: HeadingProps): React.JSX.Element {
  const tag = TAGS[level];
  const visualSize = size ?? level;
  const cls = [
    styles.heading,
    display ? styles[display] : styles[`size-${visualSize}`],
    className ?? '',
  ]
    .filter(Boolean)
    .join(' ');

  return createElement(tag, { className: cls, ...rest }, children);
}
