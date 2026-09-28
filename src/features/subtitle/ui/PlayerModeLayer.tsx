import { Component } from 'react';
import type { ReactNode } from 'react';
import { t } from '@/shared/i18n';
import { PlayerModeOverlay } from './PlayerModeOverlay';
import type { PlayerModeOverlayProps } from './PlayerModeOverlay';

export function PlayerModeLayer(props: PlayerModeOverlayProps): React.JSX.Element {
  return (
    <PlayerModeErrorBoundary>
      <PlayerModeOverlay {...props} />
    </PlayerModeErrorBoundary>
  );
}

class PlayerModeErrorBoundary extends Component<
  { children: ReactNode },
  { error: Error | null }
> {
  state: { error: Error | null } = { error: null };

  static getDerivedStateFromError(error: Error): { error: Error } {
    return { error };
  }

  componentDidCatch(error: Error): void {
     
    console.error('[PlayerModeErrorBoundary]', error.message, error.stack);
  }

  render(): ReactNode {
    if (this.state.error) {
      // max-int: intentional top-most overlay
      return (
        <div style={{ position: 'fixed', inset: 0, background: '#1a1a1a', color: '#ff4444', padding: 20, fontSize: 14, fontFamily: 'monospace', zIndex: 2147483647, overflow: 'auto' }}>
          <div style={{ marginBottom: 8, color: '#fff', fontSize: 16 }}>{t('subtitle.playerMode.crashed')}</div>
          <div>{this.state.error.message}</div>
          <pre style={{ marginTop: 8, whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>{this.state.error.stack}</pre>
          <div style={{ marginTop: 12, color: '#aaa' }}>{t('subtitle.playerMode.crashHint')}</div>
        </div>
      );
    }
    return this.props.children;
  }
}
