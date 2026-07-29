import { useEffect, useRef } from 'react';
import { createNavClusterButton } from '@/features/subtitle/ui/navClusterButton';
import { NAV_CLUSTER_CSS } from '@/features/subtitle/ui/navClusterCss';
import navClusterModuleCss from '@/features/subtitle/ui/NavCluster.module.css?inline';
import tokensCss from '@/shared/styles/tokens.css?raw';

/**
 * Render a sample nav cluster in the design-system showcase.
 * Mounts the cluster in an open shadow root so the preview is isolated from
 * host/global page styles (e.g. the ShadowButtonPoC hostile CSS) and matches
 * the content-script look.
 */
export function NavClusterPreview(): React.JSX.Element {
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return undefined;

    host.innerHTML = '';
    const shadow = host.attachShadow({ mode: 'open' });

    const style = document.createElement('style');
    style.textContent = `${tokensCss.replace(/:root\b/g, ':host')}\n${NAV_CLUSTER_CSS}\n${navClusterModuleCss}`;
    shadow.appendChild(style);

    const cluster = document.createElement('div');
    cluster.className = 'nav-cluster';
    cluster.style.left = '50%';
    cluster.style.top = '50%';

    const grip = document.createElement('div');
    grip.className = 'nav-cluster-grip';

    const main = document.createElement('div');
    main.className = 'nav-cluster-main';
    main.append(
      createNavClusterButton({ icon: 'prev', ariaLabel: 'Previous sentence', testId: 'nav-prev' }),
      createNavClusterButton({ icon: 'repeat', ariaLabel: 'Repeat current sentence', testId: 'nav-repeat' }),
      createNavClusterButton({ icon: 'next', ariaLabel: 'Next sentence', testId: 'nav-next' }),
    );

    const secondary = document.createElement('div');
    secondary.className = 'nav-cluster-secondary';
    secondary.append(
      createNavClusterButton({ icon: 'rewind', ariaLabel: 'Rewind 5 seconds', testId: 'nav-rewind' }),
      createNavClusterButton({ icon: 'play', ariaLabel: 'Play video', testId: 'nav-play' }),
      createNavClusterButton({ icon: 'forward', ariaLabel: 'Forward 10 seconds', testId: 'nav-forward' }),
    );

    const noSub = document.createElement('div');
    noSub.className = 'nav-cluster-no-sub';

    cluster.append(grip, main, secondary, noSub);
    shadow.appendChild(cluster);

    const syncTheme = (): void => {
      const theme = document.documentElement.getAttribute('data-theme') ?? 'dark';
      host.setAttribute('data-theme', theme);
    };
    syncTheme();

    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.type === 'attributes' && mutation.attributeName === 'data-theme') {
          syncTheme();
          break;
        }
      }
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

    return () => {
      observer.disconnect();
      host.innerHTML = '';
    };
  }, []);

  return (
    <div
      ref={hostRef}
      style={{
        position: 'relative',
        height: 160,
        border: '1px dashed var(--color-border)',
        borderRadius: 'var(--radius-card)',
        overflow: 'hidden',
        background: 'var(--color-surface)',
      }}
    />
  );
}
