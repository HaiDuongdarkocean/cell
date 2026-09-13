import { useCallback, useState } from 'react';
import type { ToastItem, ToastVariant } from './SubtitleToast';

export interface SubtitleToasts {
  toasts: ToastItem[];
  addToast: (message: string, variant?: ToastVariant) => void;
  clearToasts: () => void;
  removeToast: (id: string) => void;
}

export function useToasts(): SubtitleToasts {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const addToast = useCallback((message: string, variant?: ToastVariant): void => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    setToasts((prev) => [...prev, { id, message, variant }]);
  }, []);

  const clearToasts = useCallback((): void => setToasts([]), []);

  const removeToast = useCallback((id: string): void => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return { toasts, addToast, clearToasts, removeToast };
}
