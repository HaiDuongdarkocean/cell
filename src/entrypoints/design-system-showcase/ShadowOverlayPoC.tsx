import { useRef, useCallback } from 'react';
import { mountReactShadow } from '@/shared/lib/shadowRoot/mountReactShadow';
import { Button } from '@/shared/ui';
import { Card } from '@/shared/ui/Card';
import buttonCss from '@/shared/ui/Button.module.css?inline';
import cardCss from '@/shared/ui/Card.module.css?inline';

export function ShadowOverlayPoC(): React.JSX.Element {
  const mountRef = useRef<(() => void) | null>(null);

  const openOverlay = useCallback(() => {
    if (mountRef.current) return;

    const { unmount } = mountReactShadow(
      <div
        data-theme="light"
        style={{
          position: 'fixed',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          padding: 24,
        }}
      >
        <Card style={{ width: 320, maxWidth: '100%' }}>
          <h3 style={{ marginTop: 0 }}>Shadow Overlay PoC</h3>
          <p>This Card is rendered inside a shadow root host that is `position: fixed; inset: 0`.</p>
          <p>If the host is not trapped by any ancestor stacking context, the dimmed overlay covers the full viewport.</p>
          <Button variant="primary" onClick={() => unmount()}>
            Close overlay
          </Button>
        </Card>
      </div>,
      {
        layer: 4,
        position: 'fixed',
        css: [buttonCss, cardCss],
      },
    );

    mountRef.current = unmount;
  }, []);

  return (
    <div>
      <p>Click the button to mount a fixed full-viewport overlay inside a shadow root. The host uses `position: fixed; inset: 0` and should cover the viewport.</p>
      <Button variant="primary" onClick={openOverlay}>
        Open shadow overlay
      </Button>
    </div>
  );
}
