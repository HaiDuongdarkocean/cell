import type { ReactNode, CSSProperties } from 'react';
import styles from './Transition.module.css';

export interface TransitionProps {
  /** Content to apply enter/exit transitions to. */
  children: ReactNode;
  /** Whether the content is visible (enter) or hidden (exit). */
  visible: boolean;
  /** Transition duration in ms. Default: 200 (var(--duration-normal)). */
  duration?: number;
  /** CSS easing function token or value. Default: var(--ease-in-out). */
  easing?: string;
  /** Inline style override. */
  style?: CSSProperties;
}

/**
 * Transition — CSS transition wrapper that applies enter/exit opacity and
 * transform transitions based on the `visible` prop. Unmounts children after
 * exit when `visible` is false.
 */
export function Transition({
  children,
  visible,
  duration,
  easing,
  style,
}: TransitionProps): React.JSX.Element | null {
  if (!visible) return null;

  const transitionDuration = duration !== undefined ? `${duration}ms` : 'var(--duration-normal)';
  const transitionEasing = easing ?? 'var(--ease-in-out)';

  return (
    <div
      className={styles.transition}
      style={{
        transitionDuration: transitionDuration,
        transitionTimingFunction: transitionEasing,
        ...style,
      }}
    >
      {children}
    </div>
  );
}
