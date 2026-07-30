import type { CSSProperties, ReactNode } from 'react';
import styles from './Flex.module.css';

type FlexDirection = 'row' | 'column' | 'row-reverse' | 'column-reverse';
type FlexJustify = 'start' | 'center' | 'end' | 'between' | 'around' | 'evenly';
type FlexAlign = 'start' | 'center' | 'end' | 'stretch' | 'baseline';
type FlexWrap = 'nowrap' | 'wrap' | 'wrap-reverse';
type SpacingToken = '0' | '0-5' | '1' | '1-5' | '2' | '2-5' | '3' | '3-5' | '4' | '4-5' | '5' | '6' | '7' | '8' | '9' | '10' | '12' | '16' | '20' | '24';

export interface FlexProps {
  children?: ReactNode;
  direction?: FlexDirection;
  justify?: FlexJustify;
  align?: FlexAlign;
  wrap?: FlexWrap;
  gap?: SpacingToken;
  inline?: boolean;
  className?: string;
  style?: CSSProperties;
}

const directionMap: Record<FlexDirection, string> = {
  row: styles.dirRow,
  column: styles.dirColumn,
  'row-reverse': styles.dirRowReverse,
  'column-reverse': styles.dirColumnReverse,
};

const justifyMap: Record<FlexJustify, string> = {
  start: styles.justifyStart,
  center: styles.justifyCenter,
  end: styles.justifyEnd,
  between: styles.justifyBetween,
  around: styles.justifyAround,
  evenly: styles.justifyEvenly,
};

const alignMap: Record<FlexAlign, string> = {
  start: styles.alignStart,
  center: styles.alignCenter,
  end: styles.alignEnd,
  stretch: styles.alignStretch,
  baseline: styles.alignBaseline,
};

const wrapMap: Record<FlexWrap, string> = {
  nowrap: styles.wrapNowrap,
  wrap: styles.wrapWrap,
  'wrap-reverse': styles.wrapWrapReverse,
};

/**
 * Flex — neutral flexbox layout primitive. No opinionated padding/gap.
 * Props control direction, justify, align, wrap, gap, and inline mode.
 */
export function Flex({
  direction = 'row',
  justify = 'start',
  align = 'stretch',
  wrap = 'nowrap',
  gap,
  inline = false,
  className,
  style,
  children,
}: FlexProps): React.JSX.Element {
  const cls = [
    styles.flex,
    directionMap[direction],
    justifyMap[justify],
    alignMap[align],
    wrapMap[wrap],
    gap ? styles[`gap${gap}`] : '',
    inline ? styles.inline : '',
    className ?? '',
  ].filter(Boolean).join(' ');

  return <div className={cls} style={style}>{children}</div>;
}
