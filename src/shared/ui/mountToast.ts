import { createElement, Fragment, type ComponentType, type ReactNode } from 'react';
import { mountReactShadow, type ShadowMount } from '@/shared/lib/shadowRoot/mountReactShadow';
import { allModuleCss } from '@/shared/lib/shadowRoot/allModuleCss';
import type { IconCatalogKey } from '@/shared/icons';
import { ToastStack, upsertToast, type ToastItem, type ToastKind } from './Toast';

export interface ToastHandle {
  readonly id: number;
  update: (message: string, kind?: ToastKind, icon?: IconCatalogKey) => void;
}

export interface ToastHost {
  showToast: (message: string, kind?: ToastKind, opts?: ShowToastOptions) => ToastHandle;
}

export interface ShowToastOptions {
  actionId?: string;
  icon?: IconCatalogKey;
}

export interface CreateToastHostOptions {
  provider?: ComponentType<{ container: HTMLElement; children?: ReactNode }>;
  ttlMs?: number;
}

const DEFAULT_TTL_MS = 3000;

export function createToastHost(options: CreateToastHostOptions = {}): ToastHost {
  const ttlMs = options.ttlMs ?? DEFAULT_TTL_MS;
  let mount: ShadowMount | null = null;
  let toasts: ToastItem[] = [];
  let nextId = 0;
  const timers = new Map<number, ReturnType<typeof setTimeout>>();

  function render(): void {
    if (toasts.length === 0) {
      mount?.unmount();
      mount = null;
      return;
    }
    if (!mount) {
      mount = mountReactShadow(createElement(Fragment), {
        position: 'fixed',
        css: allModuleCss,
        reparentOnFullscreen: true,
      });
      mount.host.classList.add('js-cell-toast-host');
      mount.host.style.zIndex = 'var(--z-overlay-top)';
      mount.host.style.pointerEvents = 'none';
    }
    const stack = createElement(ToastStack, { toasts, onExited });
    mount.root.render(options.provider
      ? createElement(options.provider, { container: mount.rootEl }, stack)
      : stack);
  }

  function onExited(id: number): void {
    toasts = toasts.filter((toast) => toast.id !== id);
    timers.delete(id);
    render();
  }

  function armExpiry(id: number): void {
    const timer = timers.get(id);
    if (timer) clearTimeout(timer);
    timers.set(id, setTimeout(() => {
      const toast = toasts.find((item) => item.id === id);
      if (!toast || toast.leaving) return;
      toasts = toasts.map((item) => (item.id === id ? { ...item, leaving: true } : item));
      render();
    }, ttlMs));
  }

  return {
    showToast(message, kind = 'success', opts = {}) {
      const id = nextId++;
      toasts = upsertToast(toasts, { id, kind, message, leaving: false, actionId: opts.actionId, icon: opts.icon });
      const resolved = toasts.find((item) => item.actionId && item.actionId === opts.actionId) ??
        toasts[toasts.length - 1]!;
      render();
      if (resolved.kind !== 'pending') armExpiry(resolved.id);
      return {
        id: resolved.id,
        update(nextMessage, nextKind = 'success', nextIcon) {
          toasts = toasts.map((item) =>
            item.id === resolved.id
              ? { ...item, message: nextMessage, kind: nextKind, icon: nextIcon }
              : item,
          );
          render();
          if (nextKind !== 'pending') armExpiry(resolved.id);
        },
      };
    },
  };
}
