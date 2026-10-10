import { Icon } from '@/shared/icons/Icon';
import type { IconCatalogKey } from '@/shared/icons';
import styles from './Toast.module.css';

export type ToastKind = 'pending' | 'success' | 'error' | 'info' | 'warning';

export interface ToastItem {
  readonly id: number;
  readonly kind: ToastKind;
  readonly message: string;
  readonly leaving: boolean;
  readonly actionId?: string;
  readonly icon?: IconCatalogKey;
}

const TOAST_ICONS: Record<ToastKind, IconCatalogKey> = {
  pending: 'loader',
  success: 'circleCheck',
  error: 'circleX',
  info: 'circleInfo',
  warning: 'triangleAlert',
};

const MAX_VISIBLE = 2;

export function enqueueToast(toasts: readonly ToastItem[], toast: ToastItem): ToastItem[] {
  const next = [...toasts, toast];
  const showing = next.filter((item) => !item.leaving);
  if (showing.length <= MAX_VISIBLE) return next;
  const oldest = showing[0];
  return next.map((item) => (item === oldest ? { ...item, leaving: true } : item));
}

export function upsertToast(toasts: readonly ToastItem[], toast: ToastItem): ToastItem[] {
  if (toast.actionId) {
    const existing = toasts.find((item) => item.actionId === toast.actionId && !item.leaving);
    if (existing) {
      return toasts.map((item) =>
        item.id === existing.id ? { ...item, kind: toast.kind, message: toast.message, icon: toast.icon } : item,
      );
    }
  }
  return enqueueToast(toasts, toast);
}

export interface ToastStackProps {
  toasts: readonly ToastItem[];
  onExited: (id: number) => void;
}

export function ToastStack({ toasts, onExited }: ToastStackProps): React.JSX.Element {
  return (
    <div className={styles.stack} role="status" aria-live="polite">
      {toasts.map((toast) => {
        const iconName = toast.icon ?? TOAST_ICONS[toast.kind];
        return (
          <div
            key={toast.id}
            data-kind={toast.kind}
            className={`${styles.toast}${toast.leaving ? ` ${styles.leaving}` : ''}`}
            onAnimationEnd={() => {
              if (toast.leaving) onExited(toast.id);
            }}
          >
            <span
              key={iconName}
              className={`${styles.icon}${toast.kind === 'pending' ? ` ${styles.iconSpin}` : ''}`}
              aria-hidden="true"
            >
              <Icon name={iconName} size="xs" />
            </span>
            <span className={styles.message}>{toast.message}</span>
          </div>
        );
      })}
    </div>
  );
}
