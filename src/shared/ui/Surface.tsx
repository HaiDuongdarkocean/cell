import { forwardRef, useCallback, type HTMLAttributes, type KeyboardEvent, type ReactNode, type Ref } from 'react';
import styles from './Surface.module.css';

type SurfaceVariant = 'panel' | 'dialog' | 'popover' | 'card';
type SurfaceAs = 'div' | 'section' | 'article' | 'aside' | 'main' | 'header' | 'footer' | 'nav';
type SurfacePadding =
  | '0'
  | '0-5'
  | '1'
  | '1-5'
  | '2'
  | '2-5'
  | '3'
  | '3-5'
  | '4'
  | '4-5'
  | '5'
  | '6'
  | '7'
  | '8'
  | '9'
  | '10'
  | '12'
  | '16'
  | '20'
  | '24';

export interface SurfaceProps extends Omit<HTMLAttributes<HTMLDivElement>, 'as'> {
  /** Visual surface variant. Default: card. */
  readonly variant?: SurfaceVariant;
  /** Semantic element. Default: div. */
  readonly as?: SurfaceAs;
  /** Padding from the spacing scale. */
  readonly padding?: SurfacePadding;
  /** Surface content. */
  readonly children?: ReactNode;
}

const variantClass: Record<SurfaceVariant, string> = {
  panel: styles.panel,
  dialog: styles.dialog,
  popover: styles.popover,
  card: styles.card,
};

/**
 * Surface — SSOT visual shell for panels, dialogs, popovers, and cards.
 * Owns background, border, border-radius, and shadow.
 * Use `Card` for padded content cards with hover/interactive states.
 */
export const Surface = forwardRef<HTMLDivElement, SurfaceProps>(function Surface(
  {
    variant = 'card',
    as: Tag = 'div',
    padding,
    children,
    className,
    onKeyDown,
    onKeyUp,
    ...rest
  }: SurfaceProps,
  ref: Ref<HTMLDivElement>,
): React.JSX.Element {
  // Cell UI surfaces should never leak non-Escape keyboard events to the host
  // page — that breaks host shortcuts while the user is focused inside a panel,
  // dialog, or popover. Escape is left to the consumer / escape-layer stack.
  const handleKeyDown = useCallback((e: KeyboardEvent<HTMLDivElement>): void => {
    onKeyDown?.(e);
    if (e.key === 'Escape') return;
    e.stopPropagation();
  }, [onKeyDown]);

  const handleKeyUp = useCallback((e: KeyboardEvent<HTMLDivElement>): void => {
    onKeyUp?.(e);
    if (e.key === 'Escape') return;
    e.stopPropagation();
  }, [onKeyUp]);

  const cls = [
    styles.surface,
    variantClass[variant],
    padding ? styles[`padding${padding}`] : '',
    className ?? '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <Tag ref={ref} className={cls} {...rest} onKeyDown={handleKeyDown} onKeyUp={handleKeyUp}>
      {children}
    </Tag>
  );
});
