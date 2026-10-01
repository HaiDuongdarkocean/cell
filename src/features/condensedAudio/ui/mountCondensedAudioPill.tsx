import { createElement } from 'react';
import { flushSync } from 'react-dom';
import { mountReactShadow } from '@/shared/lib/shadowRoot/mountReactShadow';
import { allModuleCss } from '@/shared/lib/shadowRoot/allModuleCss';
import { buildTokenSpanCssForShadow } from '@/features/tokenize';
import { ShadowThemeProvider } from '@/features/theme';
import { CondensedAudioPill } from './CondensedAudioPill';

export interface CondensedAudioPillHandle {
  readonly updatePosition: () => void;
  readonly unmount: () => void;
}

export function mountCondensedAudioPill(
  video: HTMLVideoElement,
  startedAt: number,
  onStop: () => void,
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
    host.style.top = `${Math.max(8, rect.top + 12)}px`;
    host.style.left = `${rect.left + rect.width / 2}px`;
    host.style.transform = 'translateX(-50%)';
  };
  updatePosition();
  flushSync(() => {
    mount.root.render(
      createElement(
        ShadowThemeProvider,
        { container: mount.rootEl },
        createElement(CondensedAudioPill, { startedAt, onStop }),
      ),
    );
  });
  return { updatePosition, unmount: mount.unmount };
}
