import { useEffect, useState } from 'react';
import { t } from '@/shared/i18n';
import { Icon } from '@/shared/icons/Icon';
import type { IconCatalogKey } from '@/shared/icons';
import styles from './SubtitleToast.module.css';

export type ToastVariant = 'success' | 'error' | 'warning' | 'info' | 'pending';

export interface ToastItem {
  id: string;
  message: string;
  variant?: ToastVariant;
  duration?: number;
  actionId?: string;
  icon?: IconCatalogKey;
}

export interface SubtitleToastProps {
  toasts: ToastItem[];
  onRemove?: (id: string) => void;
}

function Toast({ item, onRemove }: { item: ToastItem; onRemove?: (id: string) => void }): React.JSX.Element {
  const [exiting, setExiting] = useState(false);
  const variant = item.variant ?? 'info';
  const duration = item.duration ?? 3000;

  useEffect(() => {
    if (variant === 'pending') return;
    const timer = setTimeout(() => setExiting(true), Math.max(0, duration - 300));
    const removeTimer = setTimeout(() => onRemove?.(item.id), duration);
    return () => {
      clearTimeout(timer);
      clearTimeout(removeTimer);
    };
  }, [item.id, item.duration, duration, variant, onRemove]);

  const iconName =
    item.icon ??
    (variant === 'pending' ? 'loader' :
    variant === 'success' ? 'circleCheck' :
    variant === 'error' ? 'circleX' :
    variant === 'warning' ? 'triangleAlert' :
    'circleInfo');

  return (
    <div
      className={[styles.toast, styles[variant], exiting && styles.exiting].filter(Boolean).join(' ')}
      data-cell-id="subtitle-toast"
      data-variant={variant}
      role="status"
      aria-live="polite"
    >
      <span
        key={iconName}
        className={[styles.icon, variant === 'pending' && styles.iconSpin].filter(Boolean).join(' ')}
        aria-hidden="true"
      >
        <Icon name={iconName}  />
      </span>
      <span className={styles.message}>{item.message}</span>
    </div>
  );
}

export function SubtitleToast({ toasts, onRemove }: SubtitleToastProps): React.JSX.Element {
  return (
    <div className={styles.container} data-cell-id="subtitle-toast-container" aria-label={t('subtitle.toast.aria')}>
      {toasts.map((item) => (
        <Toast key={item.id} item={item} onRemove={onRemove} />
      ))}
    </div>
  );
}
