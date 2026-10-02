import { createElement } from 'react';
import { flushSync } from 'react-dom';
import { mountReactShadow } from '@/shared/lib/shadowRoot/mountReactShadow';
import { allModuleCss } from '@/shared/lib/shadowRoot/allModuleCss';
import { buildTokenSpanCssForShadow } from '@/features/tokenize';
import { ShadowThemeProvider } from '@/features/theme';
import { CondensedAudioPill } from './CondensedAudioPill';

export interface CondensedAudioPillHandlers {
  readonly getElapsedMs: () => number;
  readonly onStop: () => void;
  readonly onTogglePause: () => void;
  readonly onDiscard: () => void;
}

export interface CondensedAudioPillHandle {
  readonly updatePosition: () => void;
  readonly setPaused: (paused: boolean) => void;
  readonly unmount: () => void;
}

export function mountCondensedAudioPill(
  video: HTMLVideoElement,
  handlers: CondensedAudioPillHandlers,
): CondensedAudioPillHandle {
  const mount = mountReactShadow(createElement('div'), {
    layer: 30,
    position: 'fixed',
    reparentOnFullscreen: true,
    css: [...allModuleCss, buildTokenSpanCssForShadow()],
  });
  const host = mount.host;
  host.style.pointerEvents = 'none';
  const updatePosition = (): void => {
    const rect = video.getBoundingClientRect();
    const pillWidth = host.getBoundingClientRect().width;
    host.style.top = `${Math.max(8, rect.top + 12)}px`;
    host.style.left = `${Math.max(8, rect.left + rect.width / 2 - pillWidth / 2)}px`;
  };
  updatePosition();
  let paused = false;
  const render = (): void => {
    mount.root.render(
      createElement(
        ShadowThemeProvider,
        { container: mount.rootEl },
        createElement(CondensedAudioPill, { paused, ...handlers }),
      ),
    );
  };
  flushSync(render);
  updatePosition();
  return {
    updatePosition,
    setPaused: (next: boolean) => {
      if (next === paused) return;
      paused = next;
      flushSync(render);
    },
    unmount: mount.unmount,
  };
}
