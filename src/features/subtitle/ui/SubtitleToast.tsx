import { useEffect, useState } from 'react';
import { Icon } from '@/shared/icons/Icon';
import styles from './SubtitleToast.module.css';

export type ToastVariant = 'success' | 'error' | 'warning' | 'info';

export interface ToastItem {
  id: string;
  message: string;
  variant?: ToastVariant;
  duration?: number;
}

export interface SubtitleToastProps {
  toasts: ToastItem[];
  onRemove?: (id: string) => void;
}

function Toast({ item, onRemove }: { item: ToastItem; onRemove?: (id: string) => void }): React.JSX.Element {
  const [exiting, setExiting] = useState(false);
  const duration = item.duration ?? 3000;

  useEffect(() => {
    const timer = setTimeout(() => setExiting(true), Math.max(0, duration - 300));
    const removeTimer = setTimeout(() => onRemove?.(item.id), duration);
    return () => {
      clearTimeout(timer);
      clearTimeout(removeTimer);
    };
  }, [item.id, item.duration, duration, onRemove]);

  const variant = item.variant ?? 'info';
  const iconName =
    variant === 'success' ? 'check' :
    variant === 'error' ? 'x' :
    variant === 'warning' ? 'triangleAlert' :
    'circleInfo';

  return (
    <div
      className={[styles.toast, styles[variant], exiting && styles.exiting].filter(Boolean).join(' ')}
      data-cell-id="subtitle-toast"
      data-variant={variant}
      role="status"
      aria-live="polite"
    >
      <span className={styles.icon} aria-hidden="true">
        <Icon name={iconName} size={16} />
      </span>
      <span className={styles.message}>{item.message}</span>
    </div>
  );
}

export function SubtitleToast({ toasts, onRemove }: SubtitleToastProps): React.JSX.Element {
  return (
    <div className={styles.container} data-cell-id="subtitle-toast-container" aria-label="Subtitle notifications">
      {toasts.map((item) => (
        <Toast key={item.id} item={item} onRemove={onRemove} />
      ))}
    </div>
  );
}
