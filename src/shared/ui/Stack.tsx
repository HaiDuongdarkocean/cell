import { forwardRef } from 'react';
import type { CSSProperties, HTMLAttributes, ReactNode, Ref } from 'react';
import styles from './Stack.module.css';

type StackDirection = 'vertical' | 'horizontal';
type StackAlign = 'start' | 'center' | 'end' | 'stretch';
type StackJustify = 'start' | 'center' | 'end' | 'between';
type SpacingToken = '0' | '0-5' | '1' | '1-5' | '2' | '2-5' | '3' | '3-5' | '4' | '4-5' | '5' | '6' | '7' | '8' | '9' | '10' | '12' | '16' | '20' | '24';

export interface StackProps extends Omit<HTMLAttributes<HTMLDivElement>, 'children' | 'className' | 'style'> {
  children?: ReactNode;
  direction?: StackDirection;
  gap?: SpacingToken;
  align?: StackAlign;
  justify?: StackJustify;
  divider?: boolean;
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

const StackBase = forwardRef<HTMLDivElement, StackProps>(function StackBase(
  {
    direction = 'vertical',
    gap,
    align = 'stretch',
    justify = 'start',
    divider = false,
    className,
    style,
    children,
    ...rest
  }: StackProps,
  ref: Ref<HTMLDivElement>,
): React.JSX.Element {
  const cls = [
    styles.stack,
    directionMap[direction],
    alignMap[align],
    justifyMap[justify],
    gap ? styles[`gap${gap}`] : '',
    divider ? styles.divider : '',
    className ?? '',
  ].filter(Boolean).join(' ');

  return <div ref={ref} className={cls} style={style} {...rest}>{children}</div>;
});

/**
 * VStack — vertical stack layout primitive. direction defaults to 'vertical'.
 * Neutral: no opinionated padding/gap. Props control spacing, align, justify, divider.
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
