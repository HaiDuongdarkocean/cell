import { mountSubtitle } from './mountSubtitle';
import type { OverlayStyleConfig } from '@/entities/subtitle';


const baseStyle: OverlayStyleConfig = {
  fontSize: 24,
  textColor: '#ffffff',
  backgroundColor: '#000000',
  backgroundOpacity: 0.7,
  textOpacity: 1,
  textShadow: { preset: 'soft', color: '#000000', blur: 2, offsetX: 1, offsetY: 1 },
  fontFamily: 'sans-serif',
  fontWeight: 600,
  horizontalAlign: 'center',
  visible: true,
};

const noop = () => undefined;

describe('mountSubtitle', () => {
  it('mounts and unmounts a shadow host inside the container', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);

    const { unmount } = mountSubtitle({
      container,
      targetStyle: baseStyle,
      nativeStyle: baseStyle,
      collapsed: false,
      isPlaying: true,
      repeatActive: false,
      onPrev: noop,
      onNext: noop,
      onRepeat: noop,
      onRewind: noop,
      onForward: noop,
      onPlayPause: noop,
      onToggleCollapsed: noop,
    });

    const host = container.querySelector('div') as HTMLElement;
    expect(host).toBeInTheDocument();
    expect(host.shadowRoot).toBeTruthy();

    unmount();
    expect(container.querySelector('div')).not.toBeInTheDocument();

    document.body.removeChild(container);
  });
});
