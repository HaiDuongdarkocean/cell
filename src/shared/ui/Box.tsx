import type { ReactNode } from 'react';
import styles from './Box.module.css';

type BoxAs = 'div' | 'section' | 'article' | 'main' | 'aside' | 'header' | 'footer' | 'nav';
type BoxBg = 'surface' | 'body' | 'muted' | 'card' | 'popover' | 'inverted' | 'transparent';
type BoxRadius = 'none' | 'inner' | 'element' | 'container' | 'page' | 'full';
type BoxElevation = 'none' | 'low' | 'med' | 'high';

export interface BoxProps {
  children?: ReactNode;
  as?: BoxAs;
  padding?: '0' | '0-5' | '1' | '1-5' | '2' | '2-5' | '3' | '3-5' | '4' | '4-5' | '5' | '6' | '7' | '8' | '9' | '10' | '12' | '16' | '20' | '24';
  bg?: BoxBg;
  radius?: BoxRadius;
  elevation?: BoxElevation;
  border?: boolean;
  id?: string;
  className?: string;
}

const bgMap: Record<BoxBg, string> = {
  surface: styles.bgSurface,
  body: styles.bgBody,
  muted: styles.bgMuted,
  card: styles.bgCard,
  popover: styles.bgPopover,
  inverted: styles.bgInverted,
  transparent: styles.bgTransparent,
};

const radiusMap: Record<BoxRadius, string> = {
  none: styles.radiusNone,
  inner: styles.radiusInner,
  element: styles.radiusElement,
  container: styles.radiusContainer,
  page: styles.radiusPage,
  full: styles.radiusFull,
};

const elevationMap: Record<BoxElevation, string> = {
  none: '',
  low: styles.elevationLow,
  med: styles.elevationMed,
  high: styles.elevationHigh,
};

/**
 * Box — neutral frame-first layout primitive. No opinionated padding/gap.
 * Wraps a single HTML element; `as` controls semantic tag.
 */
export function Box({
  as: Tag = 'div',
  padding,
  bg = 'transparent',
  radius,
  elevation = 'none',
  border = false,
  id,
  className,
  children,
}: BoxProps): React.JSX.Element {
  const cls = [
    styles.box,
    padding ? styles[`padding${padding}`] : '',
    bgMap[bg],
    radius ? radiusMap[radius] : '',
    elevationMap[elevation],
    border ? styles.border : '',
    className ?? '',
  ].filter(Boolean).join(' ');

  return (
    <Tag id={id} className={cls}>
      {children}
    </Tag>
  );
}
