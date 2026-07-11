import { useId, useState, cloneElement, type ReactElement, type HTMLAttributes, type ReactNode } from 'react';
import styles from './Tooltip.module.css';

export interface TooltipProps {
  /** Tooltip content. */
  content: ReactNode;
  /** Trigger element. Must be a single React element that can receive mouse/focus events. */
  children: ReactElement<HTMLAttributes<HTMLElement>>;
  /** Optional placement. Default: top. */
  placement?: 'top' | 'bottom' | 'left' | 'right';
}

/**
 * Tooltip — accessible hover/focus tooltip with `aria-describedby`.
 */
export function Tooltip({ content, children, placement = 'top' }: TooltipProps): React.JSX.Element {
  const [visible, setVisible] = useState(false);
  const tooltipId = useId();

  const trigger = cloneElement(children, {
    'aria-describedby': tooltipId,
    onMouseEnter: () => setVisible(true),
    onMouseLeave: () => setVisible(false),
    onFocus: () => setVisible(true),
    onBlur: () => setVisible(false),
  });

  return (
    <span className={styles.wrapper}>
      {trigger}
      {visible && (
        <span id={tooltipId} className={[styles.tooltip, styles[placement]].join(' ')} role="tooltip">
          {content}
        </span>
      )}
    </span>
  );
}
