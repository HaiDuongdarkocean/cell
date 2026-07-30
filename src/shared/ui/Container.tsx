import type { CSSProperties, ReactNode } from 'react';
import styles from './Container.module.css';

type ContainerMaxWidth = 'sm' | 'md' | 'lg' | 'xl' | 'full';
type SpacingToken = '0' | '0-5' | '1' | '1-5' | '2' | '2-5' | '3' | '3-5' | '4' | '4-5' | '5' | '6' | '7' | '8' | '9' | '10' | '12' | '16' | '20' | '24';

export interface ContainerProps {
  children?: ReactNode;
  maxWidth?: ContainerMaxWidth | number;
  padding?: SpacingToken;
  center?: boolean;
  className?: string;
  style?: CSSProperties;
}

const maxWidthMap: Record<ContainerMaxWidth, string> = {
  sm: styles.maxWidthSm,
  md: styles.maxWidthMd,
  lg: styles.maxWidthLg,
  xl: styles.maxWidthXl,
  full: styles.maxWidthFull,
};

/**
 * Container — page content wrapper with maxWidth constraint.
 * Default: maxWidth='lg', padding='4', center=true.
 */
export function Container({
  maxWidth = 'lg',
  padding = '4',
  center = true,
  className,
  style,
  children,
}: ContainerProps): React.JSX.Element {
  const isPreset = typeof maxWidth === 'string' && maxWidth in maxWidthMap;

  const cls = [
    styles.container,
    isPreset ? maxWidthMap[maxWidth as ContainerMaxWidth] : '',
    padding ? styles[`padding${padding}`] : '',
    center ? styles.center : '',
    className ?? '',
  ].filter(Boolean).join(' ');

  const mergedStyle: CSSProperties = { ...style };
  if (!isPreset && typeof maxWidth === 'number') {
    mergedStyle.maxWidth = `${maxWidth}px`;
  }

  return (
    <div className={cls} style={mergedStyle}>
      {children}
    </div>
  );
}
