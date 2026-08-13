import { useEffect, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import { createElement } from 'react';
import { Button } from '@/shared/ui';
import tokensCss from '@/shared/styles/tokens.css?raw';
import componentsCss from '@/shared/styles/components.css?raw';
import scrollbarsShadowCss from '@/shared/styles/scrollbars-shadow.css?raw';
import buttonCss from '@/shared/ui/Button.module.css?inline';

const HOST_ID = 'cell-shadow-button-poc-host';

function mountShadowButton(host: HTMLElement): () => void {
  const shadow = host.attachShadow({ mode: 'open' });

  // Inject tokens + component global classes + scrollbars + Button.module.css
  const style = document.createElement('style');
  style.textContent = `${tokensCss.replace(/:root\b/g, ':host')}\n${componentsCss}\n${scrollbarsShadowCss}\n${buttonCss}`;
  shadow.appendChild(style);

  const rootEl = document.createElement('div');
  rootEl.setAttribute('data-theme', 'light');
  shadow.appendChild(rootEl);

  const root = createRoot(rootEl);
  root.render(createElement(Button, { variant: 'primary' }, 'Shadow Button'));

  return () => {
    root.unmount();
    host.remove();
  };
}

export function ShadowButtonPoC(): React.JSX.Element {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return undefined;

    const host = document.createElement('div');
    host.id = HOST_ID;
    containerRef.current.appendChild(host);
    const cleanup = mountShadowButton(host);

    return cleanup;
  }, []);

  return (
    <div>
      <p>Below is a Button mounted inside a shadow root. The preview reuses the same token and component CSS inside the isolated boundary.</p>
      <div
        ref={containerRef}
        style={{
          padding: 'var(--space-6)',
          border: 'var(--border-width-hairline) dashed var(--color-border)',
        }}
      />
    </div>
  );
}
