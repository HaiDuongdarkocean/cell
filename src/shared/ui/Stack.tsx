import { forwardRef } from 'react';
import type { CSSProperties, HTMLAttributes, ReactNode, Ref } from 'react';
import styles from './Stack.module.css';

type StackDirection = 'vertical' | 'horizontal';
type StackAlign = 'start' | 'center' | 'end' | 'stretch';
type StackJustify = 'start' | 'center' | 'end' | 'between';
type SpacingToken = '0' | '0-5' | '1' | '1-5' | '2' | '2-5' | '3' | '3-5' | '4' | '4-5' | '5' | '6' | '7' | '8' | '9' | '10' | '12' | '16' | '20' | '24';
type ColumnCount = 1 | 2 | 3 | 4;

export interface StackProps extends Omit<HTMLAttributes<HTMLDivElement>, 'children' | 'className' | 'style'> {
  children?: ReactNode;
  direction?: StackDirection;
  gap?: SpacingToken;
  /** Responsive gap: gapMobile on mobile, gapDesktop at 480px+. Overrides `gap`. */
  gapResponsive?: { mobile: SpacingToken; desktop: SpacingToken };
  align?: StackAlign;
  justify?: StackJustify;
  divider?: boolean;
  /** Grid columns. When set, switches from flex to grid. Default: undefined (flex). */
  columns?: ColumnCount;
  /** When true + columns set: 1 column mobile → N columns at 480px+. Default: false. */
  responsive?: boolean;
  className?: string;
  style?: CSSProperties;
}

const directionMap: Record<StackDirection, string> = {
  vertical: styles.vertical,
  horizontal: styles.horizontal,
};

const alignMap: Record<StackAlign, string> = {
  start: styles.alignStart,
  center: styles.alignCenter,
  end: styles.alignEnd,
  stretch: styles.alignStretch,
};

const justifyMap: Record<StackJustify, string> = {
  start: styles.justifyStart,
  center: styles.justifyCenter,
  end: styles.justifyEnd,
  between: styles.justifyBetween,
};

const columnMap: Record<ColumnCount, string> = {
  1: styles.cols1,
  2: styles.cols2,
  3: styles.cols3,
  4: styles.cols4,
};

const StackBase = forwardRef<HTMLDivElement, StackProps>(function StackBase(
  {
    direction = 'vertical',
    gap,
    gapResponsive,
    align = 'stretch',
    justify = 'start',
    divider = false,
    columns,
    responsive = false,
    className,
    style,
    children,
    ...rest
  }: StackProps,
  ref: Ref<HTMLDivElement>,
): React.JSX.Element {
  const gapClass = gapResponsive
    ? `${styles[`gap${gapResponsive.mobile}`]} ${styles[`gapDesktop${gapResponsive.desktop}`]}`
    : gap ? styles[`gap${gap}`] : '';

  const cls = [
    styles.stack,
    columns ? styles.grid : directionMap[direction],
    columns ? columnMap[columns] : '',
    columns && responsive ? styles.responsive : '',
    alignMap[align],
    justifyMap[justify],
    gapClass,
    divider ? styles.divider : '',
    className ?? '',
  ].filter(Boolean).join(' ');

  return <div ref={ref} className={cls} style={style} {...rest}>{children}</div>;
});

/**
 * VStack — vertical stack layout primitive. direction defaults to 'vertical'.
 * Neutral: no opinionated padding/gap. Props control spacing, align, justify, divider.
 * Set `columns` to switch to grid mode (1-N columns, `responsive` for mobile-first).
 */
export const VStack = forwardRef<HTMLDivElement, Omit<StackProps, 'direction'>>(function VStack(props, ref) {
  return <StackBase ref={ref} direction="vertical" {...props} />;
});

/**
 * HStack — horizontal stack layout primitive. direction defaults to 'horizontal'.
 * Neutral: no opinionated padding/gap. Props control spacing, align, justify, divider.
 */
export const HStack = forwardRef<HTMLDivElement, Omit<StackProps, 'direction'>>(function HStack(props, ref) {
  return <StackBase ref={ref} direction="horizontal" {...props} />;
});
