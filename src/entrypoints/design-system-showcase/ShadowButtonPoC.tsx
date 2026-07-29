import { useEffect, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import { createElement } from 'react';
import { Button } from '@/shared/ui';
import tokensCss from '@/shared/styles/tokens.css?raw';
import componentsCss from '@/shared/styles/components.css?raw';
import buttonCss from '@/shared/ui/Button.module.css?inline';

const HOST_ID = 'cell-shadow-button-poc-host';

function mountShadowButton(host: HTMLElement): () => void {
  const shadow = host.attachShadow({ mode: 'open' });

  // Inject tokens + component global classes + Button.module.css
  const style = document.createElement('style');
  style.textContent = `${tokensCss.replace(/:root\b/g, ':host')}\n${componentsCss}\n${buttonCss}`;
  shadow.appendChild(style);

  const rootEl = document.createElement('div');
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

    // Inject hostile CSS into the main document to test isolation
    const hostileStyle = document.createElement('style');
    hostileStyle.textContent = `
      button, .btn { all: unset !important; background: red !important; color: yellow !important; border: 5px solid red !important; }
    `;
    document.head.appendChild(hostileStyle);

    const host = document.createElement('div');
    host.id = HOST_ID;
    containerRef.current.appendChild(host);
    const cleanup = mountShadowButton(host);

    return () => {
      cleanup();
      hostileStyle.remove();
    };
  }, []);

  return (
    <div>
      <p>Below is a Button mounted inside a shadow root. The host page injects hostile CSS to override buttons. If the button keeps Cell styling (blue pill, white text), CSS isolation works.</p>
      <div ref={containerRef} style={{ padding: 24, border: '1px dashed gray' }} />
    </div>
  );
}
