import { useCallback, useState } from 'react';
import type { IconCatalogKey } from '@/shared/icons';
import type { ToastItem, ToastVariant } from './SubtitleToast';

export interface AddToastOptions {
  actionId?: string;
  duration?: number;
  icon?: IconCatalogKey;
}

export interface SubtitleToasts {
  toasts: ToastItem[];
  addToast: (message: string, variant?: ToastVariant, opts?: AddToastOptions) => void;
  clearToasts: () => void;
  removeToast: (id: string) => void;
}

export function useToasts(): SubtitleToasts {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const addToast = useCallback((message: string, variant?: ToastVariant, opts?: AddToastOptions): void => {
    setToasts((prev) => {
      if (opts?.actionId) {
        const existing = prev.find((item) => item.actionId === opts.actionId);
        if (existing) {
          return prev.map((item) =>
            item.id === existing.id ? { ...item, message, variant, duration: opts.duration, icon: opts.icon } : item,
          );
        }
      }
      const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      return [...prev, { id, message, variant, actionId: opts?.actionId, duration: opts?.duration, icon: opts?.icon }];
    });
  }, []);

  const clearToasts = useCallback((): void => setToasts([]), []);

  const removeToast = useCallback((id: string): void => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return { toasts, addToast, clearToasts, removeToast };
}
