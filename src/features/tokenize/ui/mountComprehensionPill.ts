import { createElement, Fragment } from 'react';
import { mountReactShadow, type ShadowMount } from '@/shared/lib/shadowRoot/mountReactShadow';
import { allModuleCss } from '@/shared/lib/shadowRoot/allModuleCss';
import { ShadowThemeProvider } from '@/features/theme';
import { ComprehensionPill } from './ComprehensionPill';
import { comprehensionStore, type ComprehensionStore } from '../services/comprehensionStore';
import type { ComprehensionKind } from '@/entities/comprehension';

export interface ComprehensionPillMount {
  destroy: () => void;
}

export interface MountComprehensionPillOptions {
  store?: ComprehensionStore;
  parent?: HTMLElement;
}

export function mountComprehensionPill(options: MountComprehensionPillOptions = {}): ComprehensionPillMount {
  const store = options.store ?? comprehensionStore;
  const parent = options.parent ?? document.body;
  let mount: ShadowMount | null = null;

  const renderPill = (): void => {
    const state = store.getState();
    if (!state.media && !state.text) {
      mount?.unmount();
      mount = null;
      return;
    }
    const onSelect = (kind: ComprehensionKind): void => store.setActive(kind);
    if (!mount) {
      mount = mountReactShadow(createElement(Fragment), {
        parent,
        position: 'fixed',
        css: allModuleCss,
        reparentOnFullscreen: true,
      });
      mount.host.classList.add('js-cell-comprehension-pill-host');
      mount.host.style.zIndex = 'var(--z-overlay-top)';
    }
    mount.root.render(createElement(
      ShadowThemeProvider,
      { container: mount.rootEl },
      createElement(ComprehensionPill, { state, onSelect }),
    ));
  };

  const unsubscribe = store.subscribe(renderPill);
  renderPill();

  return {
    destroy() {
      unsubscribe();
      mount?.unmount();
      mount = null;
    },
  };
}
