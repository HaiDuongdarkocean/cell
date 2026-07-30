import type { CSSProperties, ReactNode } from 'react';
import styles from './Grid.module.css';

type SpacingToken = '0' | '0-5' | '1' | '1-5' | '2' | '2-5' | '3' | '3-5' | '4' | '4-5' | '5' | '6' | '7' | '8' | '9' | '10' | '12' | '16' | '20' | '24';

export interface GridProps {
  children?: ReactNode;
  columns?: number | string;
  rows?: number | string;
  gap?: SpacingToken;
  columnGap?: SpacingToken;
  rowGap?: SpacingToken;
  areas?: string;
  inline?: boolean;
  className?: string;
  style?: CSSProperties;
}

function resolveTemplate(value: number | string | undefined): string | undefined {
  if (value === undefined) return undefined;
  if (typeof value === 'number') return `repeat(${value}, 1fr)`;
  return value;
}

/**
 * Grid — neutral CSS Grid layout primitive. No opinionated padding/gap.
 * Props control columns, rows, gap, columnGap, rowGap, areas, and inline mode.
 */
export function Grid({
  columns,
  rows,
  gap,
  columnGap,
  rowGap,
  areas,
  inline = false,
  className,
  style,
  children,
}: GridProps): React.JSX.Element {
  const cls = [
    styles.grid,
    inline ? styles.inline : '',
    className ?? '',
  ].filter(Boolean).join(' ');

  const gridStyle: CSSProperties = {
    ...style,
    gridTemplateColumns: resolveTemplate(columns),
    gridTemplateRows: resolveTemplate(rows),
    gridTemplateAreas: areas,
  };

  if (gap) (gridStyle as Record<string, string>).gap = `var(--space-${gap})`;
  if (columnGap) (gridStyle as Record<string, string>).columnGap = `var(--space-${columnGap})`;
  if (rowGap) (gridStyle as Record<string, string>).rowGap = `var(--space-${rowGap})`;

  return (
    <div className={cls} style={gridStyle}>
      {children}
    </div>
  );
}
